// The content of a marketing email, as data: an ordered list of blocks, never HTML. Pure (no I/O), so `npm test`
// covers it. The admin editor writes this shape, the AI is asked for exactly this shape (BLOCKS_SCHEMA), and
// services/marketing-render.js turns it into the mail, escaping every value, so nothing a person or a model types can
// put markup in a reader's inbox.
//
//   { type: 'heading',   text, level?: 1|2 }
//   { type: 'paragraph', text }
//   { type: 'verse',     text, sanskrit?, source? }
//   { type: 'button',    label, link }          link = the position (1..maxLinks) of a tracked destination of the campaign
//   { type: 'image',     url, alt, link? }
//   { type: 'divider' }
//   { type: 'spacer',    size?: 'small'|'medium'|'large' }
//
// Text may hold merge fields, `{{firstName|friend}}`: a name from MERGE_FIELDS and, after a bar, what to write when the
// reader has no value for it. A field that is not in the list is refused when the template is saved, not found out at
// send time.

import { marketing } from '../config/marketing.js';

export const BLOCK_TYPES = ['heading', 'paragraph', 'verse', 'button', 'image', 'divider', 'spacer'];
export const SPACER_SIZES = ['small', 'medium', 'large'];

/** Merge fields: `sample` is what the preview shows, `label` is what the editor offers. */
export const MERGE_FIELDS = {
  greeting: { label: 'Greeting (Hari Bol + first name)', sample: 'Hari Bol Somesh' },
  firstName: { label: 'First name', sample: 'Somesh' },
  favoriteMantra: { label: 'Favourite mantra', sample: 'Hare Krishna Mahamantra' },
  avgRounds: { label: 'Rounds a day', sample: '12' },
  streak: { label: 'Days in a row', sample: '9' },
  daysSinceChant: { label: 'Days since last chanting', sample: '3' },
  lastBook: { label: 'Book last read', sample: 'Bhagavad-gita' },
  versesRead: { label: 'Verses read', sample: '140' },
  plan: { label: 'Plan', sample: 'Free' },
};

export const LIMITS = {
  subject: 150,
  preheader: 150,
  heading: 120,
  paragraph: 2000,
  verse: 600,
  sanskrit: 600,
  source: 120,
  button: 40,
  alt: 120,
  url: 500,
};

const FIELD = /\{\{\s*([A-Za-z]\w*)\s*(?:\|([^{}]*))?\}\}/g;

/** The merge fields a text uses, in order: `[{ name, fallback }]`. */
export function fieldsIn(text) {
  return [...String(text ?? '').matchAll(FIELD)].map((m) => ({ name: m[1], fallback: (m[2] ?? '').trim() }));
}

/** What is wrong with the merge fields of a text: a list of messages, empty when it is fine. */
export function fieldProblems(text, where = 'text') {
  const problems = [];
  const stripped = String(text ?? '').replace(FIELD, '');
  if (/\{\{|\}\}/.test(stripped)) problems.push(`${where} has a "{{" or "}}" that is not a merge field`);
  for (const { name } of fieldsIn(text)) {
    if (!MERGE_FIELDS[name]) problems.push(`${where} uses {{${name}}}, which is not a merge field (use ${Object.keys(MERGE_FIELDS).join(', ')})`);
  }
  return problems;
}

/**
 * Fills the merge fields from a context card `{ firstName, favoriteMantra, … }`. A field with no value takes its
 * fallback, or nothing. Values are plain strings; the renderer escapes them.
 */
export function fill(text, card = {}) {
  return String(text ?? '')
    .replace(FIELD, (_, name, fallback) => {
      const value = card[name];
      if (value === undefined || value === null || String(value).trim() === '') return (fallback ?? '').trim();
      return String(value);
    })
    // A fallback-less empty field can leave "Hello ," or double spaces behind; tidy only those.
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([,.!?;:])/g, '$1')
    .trim();
}

const str = (v) => (typeof v === 'string' ? v.trim() : '');

function textProblem(value, max, name, required = true) {
  const v = str(value);
  if (!v) return required ? `${name} is empty` : null;
  if (v.length > max) return `${name} is ${v.length} characters; the most is ${max}`;
  return null;
}

/** An https URL, or a path the site serves (/…), or null with a reason. */
export function checkUrl(value) {
  const v = str(value);
  if (!v) return 'is empty';
  if (v.length > LIMITS.url) return `is longer than ${LIMITS.url} characters`;
  if (/^\/(?!\/)/.test(v)) return null;
  try {
    const u = new URL(v);
    if (u.protocol !== 'https:') return 'must start with https://';
    return null;
  } catch {
    return 'is not a link';
  }
}

/**
 * Checks and tidies a block list. → `{ ok, blocks, errors }`: `blocks` holds only the known keys of each block, trimmed;
 * `errors` is a list of plain messages naming the block (1-based).
 */
export function validateBlocks(input, { maxLinks = marketing.maxLinks } = {}) {
  const errors = [];
  if (!Array.isArray(input)) return { ok: false, blocks: [], errors: ['The content must be a list of blocks.'] };
  if (input.length === 0) return { ok: false, blocks: [], errors: ['The email has no blocks.'] };
  if (input.length > marketing.maxBlocks) errors.push(`The email has ${input.length} blocks; the most is ${marketing.maxBlocks}.`);

  const blocks = [];
  input.forEach((raw, i) => {
    const at = `Block ${i + 1}`;
    if (!raw || typeof raw !== 'object' || !BLOCK_TYPES.includes(raw.type)) {
      errors.push(`${at} is not a known block (${BLOCK_TYPES.join(', ')}).`);
      return;
    }
    const problem = (text, max, name, required = true) => {
      const p = textProblem(text, max, `${at} ${name}`, required);
      if (p) errors.push(`${p}.`);
      for (const f of fieldProblems(text, `${at} ${name}`)) errors.push(`${f}.`);
    };
    const linkProblem = (link, required) => {
      if (link === undefined || link === null || link === '') {
        if (required) errors.push(`${at} needs a link slot (1 to ${maxLinks}).`);
        return;
      }
      if (!Number.isInteger(link) || link < 1 || link > maxLinks) errors.push(`${at} link slot must be a whole number from 1 to ${maxLinks}.`);
    };

    switch (raw.type) {
      case 'heading': {
        problem(raw.text, LIMITS.heading, 'heading');
        blocks.push({ type: 'heading', text: str(raw.text), level: raw.level === 2 ? 2 : 1 });
        break;
      }
      case 'paragraph': {
        problem(raw.text, LIMITS.paragraph, 'text');
        blocks.push({ type: 'paragraph', text: str(raw.text) });
        break;
      }
      case 'verse': {
        problem(raw.text, LIMITS.verse, 'verse');
        problem(raw.sanskrit, LIMITS.sanskrit, 'Sanskrit', false);
        problem(raw.source, LIMITS.source, 'source', false);
        blocks.push({ type: 'verse', text: str(raw.text), ...(str(raw.sanskrit) && { sanskrit: str(raw.sanskrit) }), ...(str(raw.source) && { source: str(raw.source) }) });
        break;
      }
      case 'button': {
        problem(raw.label, LIMITS.button, 'button label');
        linkProblem(raw.link, true);
        blocks.push({ type: 'button', label: str(raw.label), link: raw.link });
        break;
      }
      case 'image': {
        const bad = checkUrl(raw.url);
        if (bad) errors.push(`${at} picture link ${bad}.`);
        else if (!/^https:\/\//.test(str(raw.url))) errors.push(`${at} picture link must start with https:// (a mail program cannot load a path).`);
        problem(raw.alt, LIMITS.alt, 'picture description', false);
        linkProblem(raw.link, false);
        blocks.push({ type: 'image', url: str(raw.url), alt: str(raw.alt), ...(raw.link ? { link: raw.link } : {}) });
        break;
      }
      case 'divider':
        blocks.push({ type: 'divider' });
        break;
      case 'spacer':
        blocks.push({ type: 'spacer', size: SPACER_SIZES.includes(raw.size) ? raw.size : 'medium' });
        break;
      default:
        break;
    }
  });

  return { ok: errors.length === 0, blocks, errors };
}

/** Subject and preheader: a one-line text with merge fields allowed. → list of messages. */
export function validateLine(value, max, name, required = true) {
  const problems = [];
  const p = textProblem(value, max, name, required);
  if (p) problems.push(`${p}.`);
  if (/[\r\n]/.test(String(value ?? ''))) problems.push(`${name} must be on one line.`);
  for (const f of fieldProblems(value, name)) problems.push(`${f}.`);
  return problems;
}

/** Which link slots (1..n) a block list points at. */
export function linkSlotsUsed(blocks) {
  const slots = new Set();
  for (const b of blocks || []) if (Number.isInteger(b.link)) slots.add(b.link);
  return [...slots].sort((a, b) => a - b);
}

/** Every merge field a variant uses, so a preview can warn about the ones a segment cannot fill. */
export function fieldsUsed(variant) {
  const names = new Set();
  const add = (t) => fieldsIn(t).forEach((f) => names.add(f.name));
  add(variant?.subject);
  add(variant?.preheader);
  for (const b of variant?.blocks || []) [b.text, b.label, b.sanskrit, b.source, b.alt].forEach(add);
  return [...names];
}

/** The same shape, as a JSON schema, for a model asked to write a template (services/marketing-ai.js). */
export const BLOCKS_SCHEMA = {
  type: 'object',
  properties: {
    subject: { type: 'string' },
    preheader: { type: 'string' },
    blocks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: BLOCK_TYPES },
          text: { type: 'string' },
          level: { type: 'integer' },
          sanskrit: { type: 'string' },
          source: { type: 'string' },
          label: { type: 'string' },
          link: { type: 'integer' },
          url: { type: 'string' },
          alt: { type: 'string' },
          size: { type: 'string' },
        },
        required: ['type'],
      },
    },
  },
  required: ['subject', 'blocks'],
};

/**
 * What a model's answer is made into before it is checked: unknown keys dropped, an empty optional key removed, so that a
 * model that writes `"sanskrit": ""` is not refused for it.
 */
export function cleanModelBlocks(blocks) {
  if (!Array.isArray(blocks)) return blocks;
  return blocks.map((b) => {
    if (!b || typeof b !== 'object') return b;
    const out = { type: b.type };
    for (const key of ['text', 'level', 'sanskrit', 'source', 'label', 'link', 'url', 'alt', 'size']) {
      const v = b[key];
      if (v === undefined || v === null || v === '' || (key === 'link' && v === 0)) continue;
      out[key] = v;
    }
    return out;
  });
}
