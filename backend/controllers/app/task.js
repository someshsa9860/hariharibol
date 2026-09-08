// The day's task list.
//
// Moving a task to another day does not edit the task. The original is marked
// MOVED and a fresh row is created on the target day pointing back at it
// through `movedFromId`. That is deliberate: a task dragged forward five days
// in a row would otherwise silently rewrite five days of history, and the
// productivity report would show a week of clean completions that never
// happened. `deferCount` carries across, so the report can say honestly that
// something has been avoided five times.

const { prisma } = require('../../config/database');
const sadhana = require('./sadhana');
const { ok, created, noContent } = require('../../utils/respond');
const { notFound, forbidden, badRequest } = require('../../utils/errors');
const { localDateString, shiftDays, isValidDateString } = require('../../utils/date');

async function ownedTask(id, userId) {
  const task = await prisma.sadhanaTask.findUnique({ where: { id }, include: { day: true } });
  if (!task) throw notFound('Task');
  if (task.userId !== userId) throw forbidden('That is not your task');
  return task;
}

/** GET /api/app/sadhana/tasks */
exports.list = async (req, res) => {
  const user = req.auth.user;
  const date = req.valid.query.date || localDateString(user.timezone);
  const day = await sadhana.ensureDay(user, date);

  const tasks = await prisma.sadhanaTask.findMany({
    where: { sadhanaDayId: day.id },
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
  });

  return ok(res, { date, tasks });
};

/** POST /api/app/sadhana/tasks */
exports.create = async (req, res) => {
  const user = req.auth.user;
  const { title, note, date } = req.valid.body;
  const day = await sadhana.ensureDay(user, date);

  // Appended to the end of the list rather than the top: a list that reorders
  // itself while someone is writing on it is annoying to use.
  const last = await prisma.sadhanaTask.findFirst({
    where: { sadhanaDayId: day.id },
    orderBy: { displayOrder: 'desc' },
    select: { displayOrder: true },
  });

  const task = await prisma.sadhanaTask.create({
    data: {
      userId: user.id,
      sadhanaDayId: day.id,
      title,
      note: note || null,
      displayOrder: (last?.displayOrder ?? -1) + 1,
    },
  });

  await sadhana.recountDay(day.id);
  return created(res, task);
};

/** PATCH /api/app/sadhana/tasks/:id — title, note, order, and done/undone. */
exports.update = async (req, res) => {
  const user = req.auth.user;
  const { title, note, status, displayOrder } = req.valid.body;
  const task = await ownedTask(req.valid.params.id, user.id);

  if (task.status === 'MOVED') {
    throw badRequest('That task was moved to another day. Edit the copy on that day instead.');
  }

  const data = { title, note, displayOrder };
  if (status) {
    data.status = status;
    // Cleared when a task is un-ticked, so a report cannot show a completion
    // time for something that is not complete.
    data.doneAt = status === 'DONE' ? new Date() : null;
  }

  const updated = await prisma.sadhanaTask.update({ where: { id: task.id }, data });
  await sadhana.recountDay(task.sadhanaDayId);

  return ok(res, updated);
};

/**
 * POST /api/app/sadhana/tasks/:id/move
 * Carries a task to another day — tomorrow unless one is given. Both days keep
 * an honest record: this one shows a task that was planned and not finished,
 * and the target day gets a fresh task that knows how long it has been carried.
 */
exports.move = async (req, res) => {
  const user = req.auth.user;
  const task = await ownedTask(req.valid.params.id, user.id);

  if (task.status === 'MOVED') throw badRequest('That task has already been moved');
  if (task.status === 'DONE') throw badRequest('That task is already done');

  const currentDate = task.day.date.toISOString().slice(0, 10);
  const targetDate = req.valid.body.date || shiftDays(currentDate, 1);

  if (!isValidDateString(targetDate)) throw badRequest('Expected a date as YYYY-MM-DD');
  if (targetDate <= currentDate) throw badRequest('A task can only be moved forward');

  const targetDay = await sadhana.ensureDay(user, targetDate);

  const [, copy] = await prisma.$transaction([
    prisma.sadhanaTask.update({ where: { id: task.id }, data: { status: 'MOVED' } }),
    prisma.sadhanaTask.create({
      data: {
        userId: user.id,
        sadhanaDayId: targetDay.id,
        title: task.title,
        note: task.note,
        movedFromId: task.id,
        deferCount: task.deferCount + 1,
      },
    }),
  ]);

  await Promise.all([sadhana.recountDay(task.sadhanaDayId), sadhana.recountDay(targetDay.id)]);

  return created(res, { movedTo: targetDate, task: copy });
};

/** DELETE /api/app/sadhana/tasks/:id */
exports.remove = async (req, res) => {
  const user = req.auth.user;
  const task = await ownedTask(req.valid.params.id, user.id);

  await prisma.sadhanaTask.delete({ where: { id: task.id } });
  await sadhana.recountDay(task.sadhanaDayId);

  return noContent(res);
};

/**
 * GET /api/app/sadhana/tasks/carried
 * What keeps coming back. Tasks with the highest defer count, which is usually
 * the most useful thing the practice report has to say.
 */
exports.carried = async (req, res) => {
  const tasks = await prisma.sadhanaTask.findMany({
    where: { userId: req.auth.user.id, status: 'PENDING', deferCount: { gt: 0 } },
    orderBy: [{ deferCount: 'desc' }, { createdAt: 'asc' }],
    take: 20,
    include: { day: { select: { date: true } } },
  });

  return ok(res, tasks);
};
