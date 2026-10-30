// Turns a template variant's blocks into the email a reader receives: table-based HTML with inline styles, inside the
// fixed layout (views/emails/marketing-layout.ejs), and a plain-text part. Every value is escaped here, so a block can
// hold only words — no markup reaches a reader's mail program whoever wrote the block (an admin, or a model).
//
// No I/O apart from reading the layout file. The caller supplies the reader's context card and the link for each slot.

import path from 'node:path';
import ejs from 'ejs';

import env from '../config/env.js';
import { fill } from '../utils/marketing-blocks.js';
import { notice } from '../utils/messages.js';

const LAYOUT = path.join(import.meta.dirname, '..', 'views', 'emails', 'marketing-layout.ejs');

const escape = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Text with line breaks kept: "a\nb" → "a<br>b". */
const multiline = (text) => escape(text).replace(/\r?\n/g, '<br>');

const SPACER = { small: 12, medium: 24, large: 40 };
const INK = '#2b2218';

function blockHtml(block, card, hrefOf) {
  switch (block.type) {
    case 'heading': {
      const size = block.level === 2 ? 20 : 26;
      return `<h${block.level === 2 ? 2 : 1} class="ink" style="margin:0 0 14px 0;font-size:${size}px;line-height:1.3;font-weight:700;color:${INK};">${multiline(fill(block.text, card))}</h${block.level === 2 ? 2 : 1}>`;
    }
    case 'paragraph':
      return `<p class="ink" style="margin:0 0 16px 0;color:${INK};">${multiline(fill(block.text, card))}</p>`;
    case 'verse': {
      const sanskrit = block.sanskrit ? `<div class="ink" style="font-size:20px;line-height:1.6;margin:0 0 8px 0;color:${INK};">${multiline(fill(block.sanskrit, card))}</div>` : '';
      const source = block.source ? `<div class="muted" style="font-size:13px;margin-top:8px;color:#7a6b58;">${escape(fill(block.source, card))}</div>` : '';
      return `<div class="verse" style="margin:0 0 18px 0;padding:14px 18px;border-left:4px solid #d9822b;background:#fbf0de;border-radius:6px;">${sanskrit}<div class="ink" style="font-style:italic;color:${INK};">${multiline(fill(block.text, card))}</div>${source}</div>`;
    }
    case 'button': {
      const href = hrefOf(block.link);
      return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px 0;"><tr><td style="background:#d9822b;border-radius:8px;"><a href="${escape(href)}" style="display:inline-block;padding:12px 26px;font-weight:700;font-size:16px;color:#ffffff;text-decoration:none;">${escape(fill(block.label, card))}</a></td></tr></table>`;
    }
    case 'image': {
      const img = `<img src="${escape(block.url)}" alt="${escape(fill(block.alt, card))}" width="536" style="display:block;width:100%;max-width:536px;height:auto;border:0;border-radius:8px;">`;
      const inner = block.link ? `<a href="${escape(hrefOf(block.link))}">${img}</a>` : img;
      return `<div style="margin:0 0 18px 0;">${inner}</div>`;
    }
    case 'divider':
      return '<hr class="rule" style="border:0;border-top:1px solid #eadfcc;margin:20px 0;">';
    case 'spacer':
      return `<div style="height:${SPACER[block.size] ?? SPACER.medium}px;line-height:${SPACER[block.size] ?? SPACER.medium}px;">&nbsp;</div>`;
    default:
      return '';
  }
}

function blockText(block, card, hrefOf) {
  switch (block.type) {
    case 'heading': return fill(block.text, card).toUpperCase();
    case 'paragraph': return fill(block.text, card);
    case 'verse': return [block.sanskrit && fill(block.sanskrit, card), `"${fill(block.text, card)}"`, block.source && `— ${fill(block.source, card)}`].filter(Boolean).join('\n');
    case 'button': return `${fill(block.label, card)}: ${hrefOf(block.link)}`;
    case 'image': return block.alt ? `[${fill(block.alt, card)}]${block.link ? ` ${hrefOf(block.link)}` : ''}` : '';
    case 'divider': return '----------';
    default: return '';
  }
}

/**
 * Renders one email.
 *   variant   { subject, preheader, blocks }
 *   card      the reader's context card (merge field values); `{}` for a stranger
 *   hrefOf    (slot) → the URL for a link slot; the caller decides tracked or placeholder
 *   language  the language code of the variant (the footer is worded in it)
 *   unsubscribeUrl, postalAddress, openPixel
 * → `{ subject, html, text }`
 */
export async function renderEmail({ variant, card = {}, hrefOf, language = 'en', unsubscribeUrl, postalAddress = '', openPixel = null, invitee = false }) {
  const chain = [language, 'en'];
  const subject = fill(variant.subject, card);
  const preheader = variant.preheader ? fill(variant.preheader, card) : '';
  const href = (slot) => hrefOf(slot) || '#';
  const reason = notice(invitee ? 'mktFooterInvitee' : 'mktFooterReason', chain);
  const unsubscribeLabel = notice('mktUnsubscribe', chain);

  const bodyHtml = variant.blocks.map((b) => blockHtml(b, card, href)).join('\n');
  const html = await ejs.renderFile(LAYOUT, {
    language, subject, preheader, bodyHtml, openPixel,
    logoUrl: `${env.WEB_BASE_URL}/img/logo.png`,
    footer: { reason, unsubscribeLabel, unsubscribeUrl, postalAddress },
    year: new Date().getFullYear(),
  });

  const text = [
    variant.blocks.map((b) => blockText(b, card, href)).filter(Boolean).join('\n\n'),
    '',
    '--',
    reason,
    `${unsubscribeLabel}: ${unsubscribeUrl}`,
    postalAddress,
  ].filter((line, i, all) => line !== undefined && !(line === '' && all[i - 1] === '')).join('\n');

  return { subject, html, text };
}

export { escape as escapeHtml };
