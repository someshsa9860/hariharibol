// The AI batch passes — the only place in the codebase that calls a model.
//
// This is what makes the cost rule work. Both passes run over the corpus, once,
// and write their results into tables the app then reads with an ordinary
// query. Serving a user a sloka chosen for their mood costs an indexed lookup;
// the model was paid for months earlier, and paid for once no matter how many
// people are served.
//
// Two safeguards, because a batch pass is the easiest place to spend money by
// accident:
//
//   - `limit` is required and modest. A pass that walks 18,700 verses in one
//     job is a pass nobody can stop halfway.
//   - the budget check in services/ai/index.js stops the whole thing once the
//     month's cap is reached, so a prompt change that triples token use shows
//     up as a halted job rather than an invoice.

const { prisma } = require('../../config/database');
const logger = require('../../config/logger');
const ai = require('../../services/ai');
const { SLOKA_ELIGIBLE_BOOK_NUMBERS } = require('../../config/constants');

const ISSUE_MAP_SYSTEM = `You are helping a Vaishnav devotional app connect verses to the
struggles its users report. You will be given one verse from the Bhagavad Gita or Srimad
Bhagavatam and a list of struggles.

Return JSON: { "issues": [{ "slug": "...", "weight": 0-100 }] }

Rules:
- Only include a struggle the verse genuinely speaks to. An empty list is a correct answer
  and is much better than a loose one.
- weight is how directly it speaks to it: 90+ means the verse addresses it head on, 50 means
  it is relevant, below 30 do not include it at all.
- Never invent a slug. Use only the slugs given.
- Judge the verse as devotional scripture, in the sense the acharyas read it. Do not treat it
  as a historical or literary artefact.`;

const EXPLANATION_SYSTEM = `You are writing a short plain-language note for a Vaishnav
devotional app, to sit alongside a verse from the Bhagavad Gita or Srimad Bhagavatam.

Return JSON: { "text": "..." }

Rules:
- Two or three sentences. Plain, warm, direct.
- Explain what the verse is saying and why it helps someone struggling today.
- This is NOT commentary and must never read as though an acharya wrote it. No claims about
  what a particular teacher taught, no invented citations.
- Do not quote or paraphrase any published translation.
- Write as a devotee to a devotee, never as a scholar describing a tradition from outside.`;

/**
 * Proposes verse-to-issue mappings.
 *
 * Note what it writes: rows in VerseIssue, which an editor then reviews. The
 * pool this fills is what someone in the middle of krodha is handed, and a
 * loose mapping there is worse than no personalisation at all — so the prompt
 * is written to prefer an empty answer over a stretched one.
 */
async function issueMap(job) {
  const { bookNumber, limit = 100, dryRun = false } = job.data;

  const issues = await prisma.issue.findMany({
    where: { isPublished: true },
    select: { id: true, slug: true, name: true, description: true, category: true },
  });
  const bySlug = new Map(issues.map((issue) => [issue.slug, issue]));

  const issueList = issues
    .map((issue) => `- ${issue.slug} (${issue.category}): ${issue.name}. ${issue.description || ''}`)
    .join('\n');

  const verses = await prisma.verse.findMany({
    where: {
      isSlokaEligible: true,
      bookNumber: bookNumber ? bookNumber : { in: SLOKA_ELIGIBLE_BOOK_NUMBERS },
      issueLinks: { none: {} },
    },
    select: {
      id: true,
      verseId: true,
      sanskrit: true,
      transliteration: true,
      translations: {
        where: { isPublished: true, languageCode: 'en' },
        select: { meaning: true },
        take: 1,
      },
    },
    take: limit,
  });

  let mapped = 0;
  let empty = 0;
  const proposals = [];

  for (const verse of verses) {
    const meaning = verse.translations[0]?.meaning;
    // Without a translation the model has only Sanskrit to go on, and its
    // guesses get noticeably worse. Skipping is the honest option.
    if (!meaning) continue;

    try {
      const result = await ai.complete({
        operation: ai.OPERATIONS.VERSE_ISSUE_MAP,
        system: ISSUE_MAP_SYSTEM,
        prompt: `Verse ${verse.verseId}\n\n${meaning}\n\nStruggles:\n${issueList}`,
        json: true,
        targetType: 'Verse',
        targetId: verse.id,
        maxTokens: 300,
        temperature: 0.2,
      });

      const suggested = (result.json?.issues || []).filter(
        (row) => bySlug.has(row.slug) && row.weight >= 30
      );

      if (!suggested.length) {
        empty += 1;
        continue;
      }

      proposals.push({ verseId: verse.verseId, issues: suggested });

      if (!dryRun) {
        await prisma.verseIssue.createMany({
          data: suggested.map((row) => ({
            verseId: verse.id,
            issueId: bySlug.get(row.slug).id,
            weight: Math.round(row.weight),
          })),
          skipDuplicates: true,
        });
      }

      mapped += 1;
    } catch (err) {
      logger.error({ err: err.message, verseId: verse.verseId }, 'issue mapping failed');
      // A budget stop is not a per-verse failure — stop the whole pass.
      if (err.code === 'AI_BUDGET_EXHAUSTED') break;
    }

    await job.updateProgress({ mapped, empty, total: verses.length });
  }

  logger.info({ mapped, empty, dryRun }, 'issue mapping pass finished');
  return { mapped, empty, dryRun, proposals: dryRun ? proposals : undefined };
}

/**
 * Fills VerseExplanation for verses that have none in the target language.
 *
 * Written to VerseExplanation, never to VerseTranslation. That separation is
 * the whole reason the two tables exist: an acharya's purport and a generated
 * note must never be able to appear as the same kind of thing.
 *
 * Unpublished on creation — an editor reads it before anyone else does.
 */
async function explanations(job) {
  const { languageCode = 'en', bookNumber, limit = 100 } = job.data;

  const verses = await prisma.verse.findMany({
    where: {
      isSlokaEligible: true,
      ...(bookNumber ? { bookNumber } : { bookNumber: { in: SLOKA_ELIGIBLE_BOOK_NUMBERS } }),
      explanations: { none: { languageCode } },
    },
    select: {
      id: true,
      verseId: true,
      translations: {
        where: { isPublished: true, languageCode: 'en' },
        select: { meaning: true },
        take: 1,
      },
    },
    take: limit,
  });

  let written = 0;

  for (const verse of verses) {
    const meaning = verse.translations[0]?.meaning;
    if (!meaning) continue;

    try {
      const result = await ai.complete({
        operation: ai.OPERATIONS.VERSE_EXPLANATION,
        system: EXPLANATION_SYSTEM,
        prompt: `Verse ${verse.verseId}\n\n${meaning}\n\nWrite the note in ${languageCode}.`,
        json: true,
        targetType: 'Verse',
        targetId: verse.id,
        maxTokens: 300,
        temperature: 0.5,
      });

      const text = result.json?.text?.trim();
      if (!text) continue;

      await prisma.verseExplanation.upsert({
        where: { verseId_languageCode: { verseId: verse.id, languageCode } },
        update: { text, source: 'AI' },
        create: { verseId: verse.id, languageCode, text, source: 'AI', isPublished: false },
      });

      written += 1;
    } catch (err) {
      logger.error({ err: err.message, verseId: verse.verseId }, 'explanation failed');
      if (err.code === 'AI_BUDGET_EXHAUSTED') break;
    }

    await job.updateProgress({ written, total: verses.length });
  }

  logger.info({ written, languageCode }, 'explanation pass finished');
  return { written, languageCode };
}

module.exports = async function aiProcessor(job) {
  switch (job.name) {
    case 'issue-map':
      return issueMap(job);
    case 'explanations':
      return explanations(job);
    default:
      throw new Error(`Unknown AI job: ${job.name}`);
  }
};
