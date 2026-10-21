// Exchange rates into INR.
//
// Source 1: Frankfurter (European Central Bank reference rates, dated, free, no key).
// It has no rate for a weekend or holiday, so it answers with the last working day's,
// and it covers about 30 currencies. Source 2, when that fails or the currency is not
// covered: open.er-api.com (latest rates, free, no key, many more currencies). An admin
// can also put a `MANUAL` row in FxRate and it wins for that day.
//
// A rate is fetched once per currency per day and kept in FxRate, so every payment of
// that day converts with the same number and a month can be re-added to the paisa.

import { prisma } from '../../config/database.js';
import env from '../../config/env.js';
import logger from '../../config/logger.js';

let fetcher = (...args) => fetch(...args);
// Tests swap the network out.
const setFetch = (fn) => {
  fetcher = fn;
};

const day = (date) => new Date(`${new Date(date).toISOString().slice(0, 10)}T00:00:00.000Z`);

async function getJson(url) {
  const response = await fetcher(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function fetchRate(currency, date) {
  const iso = day(date).toISOString().slice(0, 10);
  const today = iso >= new Date().toISOString().slice(0, 10);
  try {
    const url = `${env.FX_API_URL}/${today ? 'latest' : iso}?base=${currency}&symbols=INR`;
    const body = await getJson(url);
    if (body?.rates?.INR > 0) return { rate: body.rates.INR, source: 'FRANKFURTER' };
  } catch (err) {
    logger.warn({ currency, err: err.message }, 'frankfurter rate failed');
  }
  try {
    const body = await getJson(`${env.FX_FALLBACK_URL}/${currency}`);
    if (body?.rates?.INR > 0) return { rate: body.rates.INR, source: 'OPEN_ER_API' };
  } catch (err) {
    logger.warn({ currency, err: err.message }, 'fallback rate failed');
  }
  return null;
}

/**
 * INR per one whole unit of `currency` on `date`, as { rate, source, date } — or null
 * when no source could be reached (the caller leaves the INR columns empty and the
 * nightly job tries again).
 */
async function rateToInr(currency, date = new Date()) {
  const code = String(currency || '').toUpperCase();
  const when = day(date);
  if (code === 'INR') return { rate: 1, source: 'IDENTITY', date: when };

  const cached = await prisma.fxRate.findUnique({ where: { currency_date: { currency: code, date: when } } });
  if (cached) return { rate: Number(cached.inrPerUnit), source: cached.source, date: when };

  const found = await fetchRate(code, when);
  if (!found) return null;

  await prisma.fxRate.upsert({
    where: { currency_date: { currency: code, date: when } },
    update: {},
    create: { currency: code, date: when, inrPerUnit: found.rate, source: found.source },
  });
  return { ...found, date: when };
}

export { rateToInr, setFetch, day };
