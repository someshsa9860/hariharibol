// The marketing email sender: a pooled SMTP transport with its own account and From address, apart from the one-at-a-time
// transactional mailer (services/mailer.js), so a bad campaign cannot cost the sign-in codes their reputation.
//
// Provider-neutral: any SMTP server works; production uses Amazon SES in ap-south-1 through its SMTP interface. SES reports
// bounces and complaints through an SNS topic (controllers/webhook/marketing-email.js), and the message id in the SMTP reply
// is what ties such a report to a delivery.
//
// Unlike the transactional mailer this THROWS on failure: the run decides what each failure means (utils/marketing-send.js).

import nodemailer from 'nodemailer';

import env from '../config/env.js';
import * as settings from './setting.js';
import { SETTING_KEYS } from '../config/constants.js';
import { sesMessageId } from '../utils/marketing-send.js';

let transport = null;
let injected = null;

const host = () => env.MARKETING_SMTP_HOST || env.SMTP_HOST || '';

export const isConfigured = () => Boolean(injected || host());

function getTransport() {
  if (injected) return injected;
  if (transport) return transport;
  const port = env.MARKETING_SMTP_PORT || env.SMTP_PORT;
  const user = env.MARKETING_SMTP_HOST ? env.MARKETING_SMTP_USER : env.SMTP_USER;
  const pass = env.MARKETING_SMTP_HOST ? env.MARKETING_SMTP_PASS : env.SMTP_PASS;
  transport = nodemailer.createTransport({
    host: host(),
    port,
    secure: port === 465,
    pool: true,
    maxConnections: 5,
    maxMessages: 200,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
    auth: user ? { user, pass } : undefined,
  });
  return transport;
}

/** A test hands in a stand-in (nodemailer's jsonTransport, say). Pass null to go back to the real one. */
export function useTransport(stand) {
  injected = stand;
}

export function closeTransport() {
  transport?.close?.();
  transport = null;
}

/** "Name <address>" for the From header: the address from MARKETING_MAIL_FROM (else MAIL_FROM), the name from the setting if set. */
export async function fromHeader() {
  const base = env.MARKETING_MAIL_FROM || env.MAIL_FROM;
  const name = (await settings.get(SETTING_KEYS.MARKETING_FROM_NAME, '')) || '';
  if (!name.trim()) return base;
  const m = /<([^>]+)>/.exec(base);
  const address = m ? m[1] : base;
  return `"${name.trim().replace(/"/g, '')}" <${address}>`;
}

export async function replyTo() {
  return ((await settings.get(SETTING_KEYS.MARKETING_REPLY_TO, '')) || '').trim() || undefined;
}

/**
 * Sends one email. → `{ messageId, providerMessageId }` (the second is the SES id when the reply carries one).
 * Throws the transport's error, which `classifyMailError` reads.
 */
export async function send({ to, subject, html, text, headers, from, replyTo: reply }) {
  const mailer = getTransport();
  const info = await mailer.sendMail({ from, to, subject, html, text, headers, ...(reply ? { replyTo: reply } : {}) });
  return { messageId: info.messageId, providerMessageId: sesMessageId(info) || String(info.messageId || '').replace(/^<|>$/g, '').split('@')[0] || null };
}

/** Whether the account logs in (the Setup card). → `{ ok, error }`. */
export async function verify() {
  if (!isConfigured()) return { ok: false, error: 'No SMTP server is set (MARKETING_SMTP_HOST or SMTP_HOST).' };
  try {
    await getTransport().verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err?.message || err).slice(0, 300) };
  }
}
