// Search across the library.
//
// Postgres `contains` with a case-insensitive match, deliberately: at this
// corpus size — around 18,700 verses — it is fast enough with the right
// indexes, and it needs no extra service to run, back up or pay for.
//
// When it stops being enough, the next step is a Postgres full-text index on
// the translation text, not a separate search cluster. Nothing here would have
// to move.

const { prisma } = require('../../config/database');
const present = require('../../utils/present');
const language = require('../../utils/language');
const { ok } = require('../../utils/respond');

const LIMIT = 20;

exports.search = async (req, res) => {
  const user = req.auth.user;
  const { q, type } = req.valid.query;
  const readingChain = language.readingChain(user);

  const wants = (kind) => !type || type === kind;

  // A dotted verse id is a direct lookup, not a search. Someone typing 1.2.47
  // wants that verse, not every verse mentioning it.
  const looksLikeVerseId = /^\d+(\.\d+){1,3}$/.test(q);

  const [verses, mantras, books] = await Promise.all([
    wants('verse')
      ? prisma.verse.findMany({
          where: looksLikeVerseId
            ? { verseId: q }
            : {
                book: { isPublished: true },
                OR: [
                  { sanskrit: { contains: q, mode: 'insensitive' } },
                  { transliteration: { contains: q, mode: 'insensitive' } },
                  {
                    translations: {
                      some: {
                        isPublished: true,
                        languageCode: { in: readingChain },
                        meaning: { contains: q, mode: 'insensitive' },
                      },
                    },
                  },
                ],
              },
          take: LIMIT,
          include: present.includes.verse(readingChain),
        })
      : [],

    wants('mantra')
      ? prisma.mantra.findMany({
          where: {
            isPublished: true,
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { sanskrit: { contains: q, mode: 'insensitive' } },
              { transliteration: { contains: q, mode: 'insensitive' } },
              { tags: { has: q.toLowerCase() } },
            ],
          },
          take: LIMIT,
          include: present.includes.mantra(language.mantraChain(user), readingChain),
        })
      : [],

    wants('book')
      ? prisma.book.findMany({
          where: {
            isPublished: true,
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { description: { contains: q, mode: 'insensitive' } },
              { tags: { has: q.toLowerCase() } },
            ],
          },
          take: LIMIT,
        })
      : [],
  ]);

  return ok(res, {
    query: q,
    verses: await present.verses(verses, user),
    mantras: await present.mantras(mantras, user),
    books: await present.books(books, user),
    total: verses.length + mantras.length + books.length,
  });
};
