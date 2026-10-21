// What a payment is worth to us, in rupees.
//
// A reader in the US pays in dollars, one in Dubai in dirhams. For each payment we
// keep what they were charged (`amountMinor` + `currency`) and work out, once, at
// the moment it is recorded:
//
//   gross      what the payer paid
//   commission what the platform kept
//   net        gross - commission, what we earn
//
// each in the payer's currency and in INR, with the rate used. They are never
// recomputed afterwards, so a closed month does not move when exchange rates do.
//
// Commission: the stores do not put their cut in the notifications we receive, so it
// is our configured rate (PLAY_COMMISSION_RATE / APPLE_COMMISSION_RATE /
// RAZORPAY_FEE_RATE) times the price, and the payment says so (`commissionSource`
// RATE). A figure the store reported would be passed in as `storeCommissionMinor`
// and saved as STORE. A free trial is worth nothing: every amount is 0.

import { prisma } from '../../config/database.js';
import env from '../../config/env.js';
import logger from '../../config/logger.js';
import * as fx from './fx.js';

// How many decimal places a currency has: 2 for rupees and dollars, 0 for yen, 3 for dinars.
function exponent(currency) {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
  } catch {
    return 2;
  }
}

// Whole units (as a store sends them: units + nanos, or milliunits) to minor units.
const unitsToMinor = (units, currency) => Math.round(units * 10 ** exponent(currency));

function commissionRate(provider) {
  if (provider === 'GOOGLE_PLAY') return env.PLAY_COMMISSION_RATE;
  if (provider === 'APPLE_APP_STORE') return env.APPLE_COMMISSION_RATE;
  return env.RAZORPAY_FEE_RATE;
}

// Pure: the arithmetic. `rate` is INR per one whole unit of `currency`, or null when unknown.
function compute({ provider, amountMinor, currency, isTrial = false, fxRate = null, storeCommissionMinor = null, rate }) {
  if (isTrial || amountMinor === 0) {
    return {
      isTrial: true,
      commissionMinor: 0,
      netMinor: 0,
      grossInrMinor: 0,
      commissionInrMinor: 0,
      netInrMinor: 0,
      commissionSource: 'NONE',
      commissionRate: null,
    };
  }

  const fromStore = Number.isInteger(storeCommissionMinor);
  const usedRate = fromStore ? null : (rate ?? commissionRate(provider));
  const commissionMinor = fromStore ? storeCommissionMinor : Math.round(amountMinor * usedRate);
  const netMinor = amountMinor - commissionMinor;

  // Minor units of one currency to paise: scale by the exponent difference, times the rate.
  const toPaise = (minor) => Math.round((minor / 10 ** exponent(currency)) * fxRate * 100);
  const known = fxRate != null;

  return {
    isTrial: false,
    commissionMinor,
    netMinor,
    grossInrMinor: known ? toPaise(amountMinor) : null,
    commissionInrMinor: known ? toPaise(commissionMinor) : null,
    // Net is gross - commission in paise, so the three always add up exactly.
    netInrMinor: known ? toPaise(amountMinor) - toPaise(commissionMinor) : null,
    commissionSource: fromStore ? 'STORE' : 'RATE',
    commissionRate: usedRate,
  };
}

// The columns to write on a Payment for this charge. Looks the exchange rate up
// (cached per day and currency); when no rate can be had the INR columns stay null
// and the nightly job fills them in.
async function revenueFields({ provider, amountMinor, currency, isTrial = false, paidAt = new Date(), storeCommissionMinor = null }) {
  const isFree = isTrial || amountMinor === 0;
  const found = isFree ? null : await fx.rateToInr(currency, paidAt);
  const out = compute({
    provider,
    amountMinor,
    currency,
    isTrial,
    fxRate: found?.rate ?? null,
    storeCommissionMinor,
  });
  return {
    ...out,
    fxRate: found?.rate ?? (isFree ? 1 : null),
    fxSource: found?.source ?? (isFree ? 'NONE' : null),
    fxDate: found?.date ?? null,
  };
}

// Payments recorded while no exchange rate could be had: convert them now, with the
// rate of the day they were paid and the commission rate they were given.
async function backfillMissing({ limit = 500 } = {}) {
  const rows = await prisma.payment.findMany({
    where: { status: { in: ['SUCCEEDED', 'REFUNDED'] }, grossInrMinor: null, isTrial: false, amountMinor: { gt: 0 } },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  let filled = 0;
  for (const row of rows) {
    const found = await fx.rateToInr(row.currency, row.paidAt ?? row.createdAt);
    if (!found) continue;
    const out = compute({
      provider: row.provider,
      amountMinor: row.amountMinor,
      currency: row.currency,
      fxRate: found.rate,
      rate: row.commissionRate != null ? Number(row.commissionRate) : undefined,
      storeCommissionMinor: row.commissionSource === 'STORE' ? row.commissionMinor : null,
    });
    await prisma.payment.update({
      where: { id: row.id },
      data: { ...out, fxRate: found.rate, fxSource: found.source, fxDate: found.date },
    });
    filled += 1;
  }
  logger.info({ checked: rows.length, filled }, 'payment fx backfill finished');
  return { checked: rows.length, filled };
}

export { backfillMissing, exponent, unitsToMinor, commissionRate, compute, revenueFields };
