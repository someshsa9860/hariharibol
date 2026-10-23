// Devotee etiquette in the app: the day's item, the list by category, and one item in full.
//
// Only PUBLISHED etiquette is ever served. A DRAFT or EXCLUDED item (one kept in the database because it would speak
// ill of a faith or a deity) is a 404 here, whoever asks. Text follows the *reading* language, the same as verses:
// the reader's chain, stopping at English (`wording` in utils/etiquette.js). The day's item is the same for everyone
// whose local date it is (services/etiquette.js `dayFor`), which is also the one the 07:15 push carried.

import { prisma } from '../../config/database.js';
import { categories } from '../../config/etiquette.js';
import * as service from '../../services/etiquette.js';
import * as language from '../../utils/language.js';
import { present, wording } from '../../utils/etiquette.js';
import { localDateString } from '../../utils/date.js';
import { ok } from '../../utils/respond.js';
import { notFound } from '../../utils/errors.js';

const readerOf = (req) => language.withReadingLanguages(req.auth.user, language.fromQuery(req.valid.query.languages));
const published = { status: 'PUBLISHED' };
const translations = { where: { isPublished: true } };

/** GET /api/app/etiquette/today — the day's etiquette on the reader's own calendar. */
export const today = async (req, res) => {
  const reader = readerOf(req);
  const date = localDateString(reader.timezone || 'Asia/Kolkata');
  const day = await service.dayFor(date);
  if (!day) return ok(res, { date, item: null });
  return ok(res, { date, item: present(day.etiquette, language.readingChain(reader)) });
};

/** GET /api/app/etiquette?category= — the published items in reading order, without their long text. */
export const list = async (req, res) => {
  const chain = language.readingChain(readerOf(req));
  const { category } = req.valid.query;

  const [rows, counts] = await Promise.all([
    prisma.etiquette.findMany({
      where: { ...published, ...(category ? { category } : {}) },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
      include: { translations },
    }),
    prisma.etiquette.groupBy({ by: ['category'], where: published, _count: { _all: true } }),
  ]);

  const order = new Map(categories.map((c, i) => [c.id, i]));
  const items = rows
    .map((row) => {
      const w = wording(row, chain);
      return { id: row.id, slug: row.slug, category: row.category, title: w.title, summary: w.summary, language: w.language, sourceName: row.sourceName ?? null };
    })
    .sort((a, b) => (order.get(a.category) ?? 99) - (order.get(b.category) ?? 99));

  const countOf = new Map(counts.map((c) => [c.category, c._count._all]));
  return ok(res, {
    categories: categories.map((c) => ({ id: c.id, name: c.name, count: countOf.get(c.id) ?? 0 })).filter((c) => c.count > 0),
    items,
  });
};

/** GET /api/app/etiquette/:id — one published item in full, with its source. */
export const get = async (req, res) => {
  const row = await prisma.etiquette.findFirst({ where: { id: req.valid.params.id, ...published }, include: { translations } });
  if (!row) throw notFound('Etiquette');
  return ok(res, present(row, language.readingChain(readerOf(req))));
};
