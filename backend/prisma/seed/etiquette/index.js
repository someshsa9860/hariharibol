// The English devotee etiquette, one file per category, and the function that puts it in the database.
//
// Each file is a list of { slug, title, summary, body, reference, author, sourceName, sourceUrl } in the order a
// reader should meet them; the category and the sort order come from where the file is listed below. An entry may
// carry `status: 'EXCLUDED'` and an `excludedReason`: it is kept in the database, so the record is complete and an
// admin can see what was left out and why, and is never shown to a reader or sent as a push.
//
// The wording is our own. What is taken from a source is the rule it teaches, never its sentences, and every entry
// names the page it is drawn from (see sources.js), the verse or teaching in `reference` (for the Bhagavad-gītā and
// the Śrīmad-Bhāgavatam, the verse number), and whose words it is in `author` (the names are in sources.js too).
// Nothing here names the author of the books we cite: the app does not show his name yet
// (AppConfig.showAuthorName), so a text, a reference, an author or a source name that carried it would show it
// anyway; `checkItems` refuses one.

import { categories, CATEGORY_IDS } from '../../../config/etiquette.js';
import temple from './temple.js';
import deity from './deity.js';
import prasad from './prasad.js';
import holyName from './holy-name.js';
import guruVaishnava from './guru-vaishnava.js';
import speechMind from './speech-mind.js';
import dailyLife from './daily-life.js';
import scripture from './scripture.js';
import holyPlaces from './holy-places.js';

const FILES = {
  temple,
  deity,
  prasad,
  'holy-name': holyName,
  'guru-vaishnava': guruVaishnava,
  'speech-mind': speechMind,
  'daily-life': dailyLife,
  scripture,
  'holy-places': holyPlaces,
};

// A category's items are 100 apart from the next category's, so ordering by `sortOrder` alone reads in the app's order.
const CATEGORY_STEP = 100;

export const etiquetteItems = categories.flatMap((category, categoryIndex) =>
  (FILES[category.id] || []).map((item, position) => ({
    status: 'PUBLISHED',
    ...item,
    category: category.id,
    sortOrder: categoryIndex * CATEGORY_STEP + position,
  }))
);

const LIMITS = { slug: 80, title: 160, summary: 220, body: 4000, reference: 200, author: 200, sourceName: 200, sourceUrl: 500, excludedReason: 500 };
const HIDDEN_NAME = /prabhup/i;

/** What is wrong with a list of items, as plain sentences. An empty list is a clean one. */
export function checkItems(items) {
  const problems = [];
  const seen = new Set();

  for (const item of items) {
    const at = item.slug || '(no slug)';
    const bad = (why) => problems.push(`${at}: ${why}`);

    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(item.slug || '')) bad('the slug must be lower-case words joined by hyphens');
    if (seen.has(item.slug)) bad('the slug is used twice');
    seen.add(item.slug);

    if (!CATEGORY_IDS.includes(item.category)) bad(`unknown category "${item.category}"`);

    for (const field of ['title', 'summary', 'body', 'reference', 'author', 'sourceName', 'sourceUrl']) {
      const value = item[field];
      if (typeof value !== 'string' || value.trim() === '') bad(`${field} is empty`);
      else if (value.length > LIMITS[field]) bad(`${field} is ${value.length} characters (at most ${LIMITS[field]})`);
      else if (value !== value.trim()) bad(`${field} has spaces at either end`);
      if (typeof value === 'string' && HIDDEN_NAME.test(value)) bad(`${field} names the author of the books we cite, whose name the app does not show yet`);
    }

    if (typeof item.sourceUrl === 'string' && !/^https:\/\/[^\s]+$/.test(item.sourceUrl)) bad('sourceUrl must be an https link');

    if (item.status === 'EXCLUDED') {
      if (!item.excludedReason) bad('an excluded item needs an excludedReason');
      else if (item.excludedReason.length > LIMITS.excludedReason) bad('excludedReason is too long');
    } else if (item.status === 'PUBLISHED') {
      if (item.excludedReason) bad('only an excluded item has an excludedReason');
    } else {
      bad(`status must be PUBLISHED or EXCLUDED, not "${item.status}"`);
    }
  }

  return problems;
}

// What a run may fill in on an item that already exists, and only where that item has no value for it (a row made
// before the author column existed has none). Nothing else on an existing row is written: an admin's edit stays, and so
// does wording the seed has since changed. `status` is not here either: whether an item is shown is an admin's decision
// once the row exists, and a restored or excluded item must stay as they left it.
const FILLABLE = ['category', 'sortOrder', 'title', 'summary', 'body', 'reference', 'author', 'sourceName', 'sourceUrl'];

const blank = (value) => value === null || value === undefined || value === '';

/**
 * Puts the English etiquette into the database. Safe to run again: a missing item is created, and an item already there
 * is left as it is except that a blank field is filled from this file.
 * @returns {{ created: number, filled: number, kept: number }} `filled` counts the items that had a blank field filled,
 *   `kept` the items that needed nothing.
 */
export async function seedEtiquette(prisma) {
  const problems = checkItems(etiquetteItems);
  if (problems.length) throw new Error(`The etiquette seed has ${problems.length} problem(s):\n  ${problems.join('\n  ')}`);

  const rows = await prisma.etiquette.findMany({ select: { id: true, slug: true, ...Object.fromEntries(FILLABLE.map((f) => [f, true])) } });
  const bySlug = new Map(rows.map((row) => [row.slug, row]));

  const result = { created: 0, filled: 0, kept: 0 };
  const fresh = [];

  for (const item of etiquetteItems) {
    const row = bySlug.get(item.slug);
    if (!row) {
      fresh.push({
        slug: item.slug,
        category: item.category,
        sortOrder: item.sortOrder,
        title: item.title,
        summary: item.summary,
        body: item.body,
        reference: item.reference,
        author: item.author,
        sourceName: item.sourceName,
        sourceUrl: item.sourceUrl,
        status: item.status,
        excludedReason: item.excludedReason ?? null,
      });
      continue;
    }

    const blanks = Object.fromEntries(FILLABLE.filter((field) => blank(row[field]) && !blank(item[field])).map((field) => [field, item[field]]));
    if (Object.keys(blanks).length) {
      await prisma.etiquette.update({ where: { id: row.id }, data: blanks });
      result.filled += 1;
    } else {
      result.kept += 1;
    }
  }

  if (fresh.length > 0) {
    const made = await prisma.etiquette.createMany({ data: fresh, skipDuplicates: true });
    result.created = made.count;
  }

  return result;
}
