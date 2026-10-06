// Transactional email. Templates are EJS files under views/emails — the same
// views/ directory that holds the server-rendered pages, because both are
// things the server renders as HTML rather than returns as JSON.

import path from 'node:path';
import nodemailer from 'nodemailer';
import ejs from 'ejs';

import env from '../config/env.js';
import logger from '../config/logger.js';

const TEMPLATE_DIR = path.join(import.meta.dirname, '..', 'views', 'emails');

let transport = null;

function getTransport() {
  if (transport) return transport;
  if (!env.SMTP_HOST) {
    logger.warn('smtp is not configured — emails are logged instead of sent');
    return null;
  }
  transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  return transport;
}

async function render(template, data) {
  return ejs.renderFile(path.join(TEMPLATE_DIR, `${template}.ejs`), {
    ...data,
    webBaseUrl: env.WEB_BASE_URL,
    year: new Date().getFullYear(),
  });
}

// Never throws. A failed email must not fail the request that triggered it —
// the caller has already done the thing the email is about.
async function send({ to, subject, template, data }) {
  try {
    const html = await render(template, data || {});
    const mailer = getTransport();

    if (!mailer) {
      logger.info({ to, subject, template }, 'email not sent (no smtp configured)');
      return { sent: false };
    }

    const info = await mailer.sendMail({ from: env.MAIL_FROM, to, subject, html });
    logger.info({ to, subject, messageId: info.messageId }, 'email sent');
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    logger.error({ err: err.message, to, template }, 'email failed');
    return { sent: false, error: err.message };
  }
}

export { send, render };
