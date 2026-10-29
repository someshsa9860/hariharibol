// The English quotes shown on the chanting page, and the function that puts them in the database.
//
// Each entry in quotes.js is { slug, text, reference, author, sourceName, sourceUrl }. The words are the speaker's own,
// copied from the page `sourceUrl` names, and each is short; nothing is seeded that could not be read at its source.
// `author` is always stored: whether the app shows it is the app's switch (AppConfig.showQuoteAuthor), not the data's.

import quotes from './quotes.js';

export const quoteItems = quotes.map((item, position) => ({ status: 'PUBLISHED', ...item, sortOrder: position * 10 }));

const LIMITS = { slug: 80, text: 1000, reference: 200, author: 200, sourceName: 200, sourceUrl: 500 };

/** What is wrong with a list of quotes, as plain sentences. An empty list is a clean one. */
export function checkQuotes(items) {
  const problems = [];
  const seen = new Set();
  const seenText = new Set();

  for (const item of items) {
    const at = item.slug || '(no slug)';
    const bad = (why) => problems.push(`${at}: ${why}`);

    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(item.slug || '')) bad('the slug must be lower-case words joined by hyphens');
    if (seen.has(item.slug)) bad('the slug is used twice');
    seen.add(item.slug);
    if (seenText.has(item.text)) bad('the same quote is listed twice');
    seenText.add(item.text);

    for (const field of ['text', 'reference', 'author', 'sourceName', 'sourceUrl']) {
      const value = item[field];
      if (typeof value !== 'string' || value.trim() === '') bad(`${field} is empty`);
      else if (value.length > LIMITS[field]) bad(`${field} is ${value.length} characters (at most ${LIMITS[field]})`);
      else if (value !== value.trim()) bad(`${field} has spaces at either end`);
    }
    if (typeof item.sourceUrl === 'string' && !/^https:\/\/[^\s]+$/.test(item.sourceUrl)) bad('sourceUrl must be an https link');
    if (typeof item.text === 'string' && item.text.length > 400) bad('a quote for a chanting screen should be short (at most 400 characters)');
    if (item.status !== 'PUBLISHED') bad(`status must be PUBLISHED, not "${item.status}"`);
  }
  return problems;
}

// What a later run may bring up to date on a row nobody has edited. `status` is deliberately not here: whether a quote
// is shown is an admin's decision once the row exists.
const REFRESHED = ['sortOrder', 'text', 'reference', 'author', 'sourceName', 'sourceUrl'];

/**
 * Puts the English quotes into the database. Safe to run again: a missing quote is created, a row an admin has edited
 * (`isEdited`) is kept as it is, and any other row is rewritten only where it differs from this file.
 * @returns {{ created: number, updated: number, kept: number, unchanged: number }}
 */
export async function seedQuotes(prisma) {
  const problems = checkQuotes(quoteItems);
  if (problems.length) throw new Error(`The quotes seed has ${problems.length} problem(s):\n  ${problems.join('\n  ')}`);

  const rows = await prisma.quote.findMany({ select: { id: true, slug: true, isEdited: true, ...Object.fromEntries(REFRESHED.map((f) => [f, true])) } });
  const bySlug = new Map(rows.map((row) => [row.slug, row]));
  const result = { created: 0, updated: 0, kept: 0, unchanged: 0 };
  const fresh = [];

  for (const item of quoteItems) {
    const row = bySlug.get(item.slug);
    if (!row) {
      fresh.push({ slug: item.slug, sortOrder: item.sortOrder, text: item.text, reference: item.reference, author: item.author, sourceName: item.sourceName, sourceUrl: item.sourceUrl, status: item.status });
      result.created += 1;
    } else if (row.isEdited) {
      result.kept += 1;
    } else {
      const changes = Object.fromEntries(REFRESHED.filter((f) => row[f] !== item[f]).map((f) => [f, item[f]]));
      if (Object.keys(changes).length === 0) {
        result.unchanged += 1;
      } else {
        await prisma.quote.update({ where: { id: row.id }, data: changes });
        result.updated += 1;
      }
    }
  }
  if (fresh.length) await prisma.quote.createMany({ data: fresh });
  return result;
}
