// The quotes shown on the chanting page. Only PUBLISHED quotes are served, in the reader's *reading* language (the
// reader's chain, stopping at English; `wording` in utils/quote.js). One call returns all of them — a few hundred short
// lines — so the app can rotate them with no connection; `version` changes when any quote or translation does, which is
// how the app knows whether its copy is still the current one.

import { prisma } from '../../config/database.js';
import * as language from '../../utils/language.js';
import { present } from '../../utils/quote.js';
import { ok } from '../../utils/respond.js';

const readerOf = (req) => language.withReadingLanguages(req.auth.user, language.fromQuery(req.valid.query.languages));

/** GET /api/app/quotes */
export const list = async (req, res) => {
  const chain = language.readingChain(readerOf(req));
  const rows = await prisma.quote.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    include: { translations: { where: { isPublished: true } } },
  });
  const stamp = rows.reduce((latest, row) => Math.max(latest, row.updatedAt.getTime(), ...row.translations.map((t) => t.updatedAt.getTime())), 0);
  return ok(res, { version: `${rows.length}-${stamp}-${chain.join('.')}`, items: rows.map((row) => present(row, chain)) });
};
