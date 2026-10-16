// The Routine tab, mirrored from the phone.
//
// The phone owns the list; this is its copy on the account. A sync is one
// round trip: the phone sends what it changed since the last one, the changes
// are applied in a single transaction, and the routine as it now stands comes
// back. There is no per-row conflict handling beyond "the last to arrive wins" —
// it is one person's own list, edited on their own phones.

import { prisma } from '../../config/database.js';
import { ok } from '../../utils/respond.js';
import * as language from '../../utils/language.js';
import { DEFAULT_LANGUAGE } from '../../config/constants.js';

/** A stored row in the shape the phone keeps it in. Absent beats null for an optional number. */
function present(row, fields) {
  const out = {};
  for (const field of fields) {
    if (row[field] !== null && row[field] !== undefined) out[field] = row[field];
  }
  return out;
}

const TASK_FIELDS = ['id', 'day', 'title', 'category', 'slot', 'windowStart', 'windowEnd', 'isDone', 'doneAt'];
const DAILY_FIELDS = ['id', 'title', 'category', 'slot', 'windowStart', 'windowEnd', 'since', 'until'];

/** The routine for one user: all daily items, and tasks and ticks from `since` on. */
async function snapshot(userId, since) {
  const dayFilter = since ? { day: { gte: since } } : {};
  const [tasks, daily, checks] = await Promise.all([
    prisma.routineTask.findMany({
      where: { userId, ...dayFilter },
      orderBy: [{ day: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    }),
    prisma.routineDailyItem.findMany({ where: { userId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
    prisma.routineCheck.findMany({ where: { userId, ...dayFilter } }),
  ]);

  return {
    tasks: tasks.map((row) => present(row, TASK_FIELDS)),
    daily: daily.map((row) => present(row, DAILY_FIELDS)),
    checks: checks.map((row) => ({ itemId: row.itemId, day: row.day, doneAt: row.doneAt })),
  };
}

/** GET /api/app/routine */
export const read = async (req, res) => {
  return ok(res, await snapshot(req.auth.user.id, req.valid.query.since));
};

/** The columns a task or daily item stores, from what the phone sent. */
function columns(row, extra) {
  return {
    title: row.title,
    category: row.category,
    slot: row.slot,
    windowStart: row.windowStart ?? null,
    windowEnd: row.windowEnd ?? null,
    ...extra,
  };
}

/** POST /api/app/routine/sync */
export const sync = async (req, res) => {
  const userId = req.auth.user.id;
  const { since, tasks, daily, checks, removedTasks, removedChecks } = req.valid.body;

  // Removals first, so a row removed and added back in one request (an undo
  // that raced the sync) ends up present.
  await prisma.$transaction([
    prisma.routineTask.deleteMany({ where: { userId, id: { in: removedTasks } } }),
    ...removedChecks.map(({ itemId, day }) =>
      prisma.routineCheck.deleteMany({ where: { userId, itemId, day } })
    ),

    ...daily.map((item) => {
      const data = columns(item, { since: item.since, until: item.until });
      return prisma.routineDailyItem.upsert({
        where: { userId_id: { userId, id: item.id } },
        create: { userId, id: item.id, ...data },
        update: data,
      });
    }),

    ...tasks.map((task) => {
      const data = columns(task, { day: task.day, isDone: task.isDone, doneAt: task.isDone ? (task.doneAt ?? null) : null });
      return prisma.routineTask.upsert({
        where: { userId_id: { userId, id: task.id } },
        create: { userId, id: task.id, ...data },
        update: data,
      });
    }),

    ...checks.map((check) => {
      const doneAt = check.doneAt ?? null;
      return prisma.routineCheck.upsert({
        where: { userId_itemId_day: { userId, itemId: check.itemId, day: check.day } },
        create: { userId, itemId: check.itemId, day: check.day, doneAt },
        update: { doneAt },
      });
    }),
  ]);

  return ok(res, await snapshot(userId, since));
};

/**
 * GET /api/app/routine/nudges
 *
 * The verse behind each standard routine's reminder, for the app to schedule local
 * notifications from: the task's name is the title and `text` the body. A kind has several
 * verses, in the order they were seeded; the app takes a different one each day. The text is
 * the verse's translation in the reader's language when that verse and language are in the
 * database, and the seeded English otherwise — so a reminder is never empty.
 *
 * `voiceScript` and `voiceUrl` are for the voice message of a later release: the script still
 * has `{name}` in it, and the url is null until a message has been made for this person.
 */
export const nudges = async (req, res) => {
  const chain = language.readingChain(req.auth.user);

  const kinds = await prisma.routineKind.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    include: { nudges: { where: { isActive: true }, orderBy: { position: 'asc' } } },
  });

  const verseIds = [...new Set(kinds.flatMap((kind) => kind.nudges.map((nudge) => nudge.verseId)).filter(Boolean))];
  const verses = verseIds.length
    ? await prisma.verse.findMany({
        where: { verseId: { in: verseIds } },
        select: {
          verseId: true,
          translations: {
            where: { isPublished: true, languageCode: { in: chain } },
            orderBy: { displayOrder: 'asc' },
            select: { languageCode: true, type: true, meaning: true },
          },
        },
      })
    : [];
  const translationOf = new Map(verses.map((verse) => [verse.verseId, language.pickTranslation(verse.translations, chain)]));

  return ok(res, {
    kinds: kinds.map((kind) => ({
      key: kind.key,
      voiceScript: kind.voiceScript,
      voiceUrl: null,
      nudges: kind.nudges.map((nudge) => {
        const translation = nudge.verseId ? translationOf.get(nudge.verseId) : null;
        const own = translation?.meaning?.trim();
        return {
          id: nudge.id,
          verseId: nudge.verseId,
          reference: nudge.reference,
          text: own || nudge.text,
          languageCode: own ? translation.languageCode : DEFAULT_LANGUAGE,
        };
      }),
    })),
  });
};
