// Bounces, complaints and deliveries of marketing email coming back to us. Two senders:
//   * Amazon SES through an SNS topic (the configuration set's event destination): SNS posts JSON as text/plain, signed with a
//     certificate Amazon hosts. A SubscriptionConfirmation is confirmed only for our own topic (MARKETING_SNS_TOPIC_ARN).
//   * any other SMTP provider: `{ type: 'bounce'|'complaint'|'delivery', email, permanent?, messageId? }` with the shared
//     secret MARKETING_WEBHOOK_SECRET in X-Marketing-Secret.
//
// Always answered 200 once the sender is authentic: a 4xx/5xx makes SNS retry for hours.

import crypto from 'node:crypto';

import { prisma } from '../../config/database.js';
import env from '../../config/env.js';
import logger from '../../config/logger.js';
import * as consent from '../../services/marketing-consent.js';
import * as run from '../../services/marketing-run.js';
import { eventsOf, validCertUrl, validSubscribeUrl, verifySignature } from '../../utils/marketing-sns.js';
import { ok } from '../../utils/respond.js';
import { badRequest, forbidden } from '../../utils/errors.js';

const certs = new Map();

/** The SNS signing certificate (PEM), fetched once per URL. Replaceable by a test. */
export const deps = {
  fetchText: async (url) => {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`${response.status} from ${new URL(url).hostname}`);
    return response.text();
  },
};

async function certFor(url) {
  if (!certs.has(url)) certs.set(url, await deps.fetchText(url));
  return certs.get(url);
}

/** Applies one bounce / complaint / delivery to the delivery it is about and to the suppression list. → the campaign id or null. */
export async function applyEvent(event) {
  const byMessage = event.messageId ? await prisma.marketingDelivery.findFirst({ where: { providerMessageId: event.messageId } }) : null;
  const delivery = byMessage;
  const now = new Date();
  const emails = event.emails.length ? event.emails : [];

  if (event.type === 'bounce') {
    // A permanent bounce stops all writing to the address; a transient one (a full mailbox) is only noted.
    if (event.permanent) for (const email of emails) await consent.suppress('EMAIL', email, 'HARD_BOUNCE', 'reported by the mail provider');
    if (delivery) {
      await prisma.marketingDelivery.update({
        where: { id: delivery.id },
        data: event.permanent ? { status: 'BOUNCED', bouncedAt: now, error: String(event.detail ?? 'bounced').slice(0, 500) } : { error: `Temporary: ${String(event.detail ?? '').slice(0, 480)}` },
      });
    }
  } else if (event.type === 'complaint') {
    for (const email of emails) {
      await consent.suppress('EMAIL', email, 'COMPLAINT', 'marked as spam');
      const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true } });
      if (user) await consent.setEmailEnabled(user.id, false, 'sns');
    }
    if (delivery) await prisma.marketingDelivery.update({ where: { id: delivery.id }, data: { complainedAt: now } });
  } else if (event.type === 'delivery' && delivery && delivery.status === 'SENT') {
    await prisma.marketingDelivery.update({ where: { id: delivery.id }, data: { status: 'DELIVERED', deliveredAt: now } });
  }

  if (delivery) {
    const { row } = await run.recount(delivery.campaignId);
    run.publishCampaign(row);
    return delivery.campaignId;
  }
  return null;
}

const same = (a, b) => {
  const x = Buffer.from(String(a ?? ''));
  const y = Buffer.from(String(b ?? ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

/** POST /api/webhooks/marketing-email */
export const receive = async (req, res) => {
  // The generic adapter.
  const secret = req.get('x-marketing-secret');
  if (secret !== undefined) {
    if (!env.MARKETING_WEBHOOK_SECRET || !same(secret, env.MARKETING_WEBHOOK_SECRET)) throw forbidden('Secret did not match');
    const body = typeof req.body === 'string' ? safeJson(req.body) : req.body;
    const type = String(body?.type || '').toLowerCase();
    if (!['bounce', 'complaint', 'delivery'].includes(type) || !body?.email) throw badRequest('Expected { type, email }');
    await applyEvent({ type, permanent: body.permanent !== false, messageId: body.messageId ?? null, emails: [String(body.email)], detail: body.detail ?? null });
    return ok(res, { received: true });
  }

  // Amazon SNS.
  if (!env.MARKETING_SNS_TOPIC_ARN) throw forbidden('Marketing email events are not configured');
  const message = typeof req.body === 'string' ? safeJson(req.body) : req.body;
  if (!message?.Type || !message.TopicArn) throw badRequest('Not an SNS message');
  if (message.TopicArn !== env.MARKETING_SNS_TOPIC_ARN) throw forbidden('Not our topic');
  if (!validCertUrl(message.SigningCertURL)) throw forbidden('Unexpected signing certificate');
  let pem;
  try {
    pem = await certFor(message.SigningCertURL);
  } catch (err) {
    logger.warn({ err: err.message }, 'could not fetch the SNS signing certificate');
    throw badRequest('The signing certificate could not be fetched');
  }
  if (!verifySignature(message, pem)) throw forbidden('Signature did not verify');

  if (message.Type === 'SubscriptionConfirmation') {
    if (validSubscribeUrl(message.SubscribeURL)) {
      await deps.fetchText(message.SubscribeURL).catch((err) => logger.warn({ err: err.message }, 'could not confirm the SNS subscription'));
    }
    return ok(res, { confirmed: true });
  }
  if (message.Type !== 'Notification') return ok(res, { ignored: message.Type });

  const ses = safeJson(message.Message);
  const events = eventsOf(ses);
  for (const event of events) {
    try {
      await applyEvent(event);
    } catch (err) {
      logger.error({ err: err.message, type: event.type }, 'marketing email event failed');
    }
  }
  return ok(res, { received: events.length });
};

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
