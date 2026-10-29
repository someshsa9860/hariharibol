// Prayers in the app: the list by category, and one prayer in full with its verses.
//
// Only PUBLISHED prayers are ever served; a DRAFT is a 404 here, whoever asks. A prayer's title, summary and about, and
// each verse's meaning, follow the *reading* language, the same as verses: the reader's chain, stopping at English
// (`wording` in utils/prayer.js). The verses are sent in the prayer's original script together with every rendering
// stored for them; the phone shows the script the reader chose, and converts it itself where `scripts[].kind` is `rule`
// (the server decides which, `howText` in config/prayer.js, so the two never disagree). Staleness is an admin matter and
// is not sent.

import { prisma } from '../../config/database.js';
import { categories } from '../../config/prayer.js';
import * as language from '../../utils/language.js';
import { present, presentList } from '../../utils/prayer.js';
import { ok } from '../../utils/respond.js';
import { notFound } from '../../utils/errors.js';

const readerOf = (req) => language.withReadingLanguages(req.auth.user, language.fromQuery(req.valid.query.languages));
const published = { status: 'PUBLISHED' };
const inOrder = [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }];

/** GET /api/app/prayers — the published prayers by category, without their verses, and the categories that have any. */
export const list = async (req, res) => {
  const chain = language.readingChain(readerOf(req));

  const [rows, counts] = await Promise.all([
    prisma.prayer.findMany({
      where: published,
      orderBy: [{ category: 'asc' }, ...inOrder],
      include: {
        translations: { where: { languageCode: { in: chain } }, select: { languageCode: true, title: true, summary: true } },
        _count: { select: { verses: true } },
      },
    }),
    prisma.prayer.groupBy({ by: ['category'], where: published, _count: { _all: true } }),
  ]);

  const order = new Map(categories.map((c, i) => [c.id, i]));
  const items = presentList(rows, chain).sort((a, b) => (order.get(a.category) ?? 99) - (order.get(b.category) ?? 99));

  const countOf = new Map(counts.map((c) => [c.category, c._count._all]));
  return ok(res, {
    categories: categories.map((c) => ({ id: c.id, name: c.name, count: countOf.get(c.id) ?? 0 })).filter((c) => c.count > 0),
    items,
  });
};

/** GET /api/app/prayers/:id — one published prayer in full: its source, the scripts it can be read in, and every verse. The id may be the prayer's slug, which is what a routine alert carries. */
export const get = async (req, res) => {
  const key = req.valid.params.id;
  const row = await prisma.prayer.findFirst({
    where: { OR: [{ id: key }, { slug: key }], ...published },
    include: {
      translations: { select: { languageCode: true, title: true, summary: true, about: true } },
      verses: {
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
        include: { translations: { select: { languageCode: true, text: true, meaning: true } } },
      },
    },
  });
  if (!row) throw notFound('Prayer');
  return ok(res, present(row, language.readingChain(readerOf(req))));
};
