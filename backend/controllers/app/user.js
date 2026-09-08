// The signed-in person's own profile and settings.

import { prisma } from '../../config/database.js';
import * as authService from '../../services/auth.js';
import * as audit from '../../services/audit.js';
import { ok } from '../../utils/respond.js';
import { badRequest } from '../../utils/errors.js';
import { isValidTimezone } from '../../utils/date.js';

const PROFILE_SELECT = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
  authProvider: true,
  appLanguage: true,
  mantraLanguage: true,
  readingLanguage: true,
  timezone: true,
  isPremium: true,
  premiumSince: true,
  premiumUntil: true,
  createdAt: true,
};

/** GET /api/app/me */
export const me = async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.auth.user.id },
    select: {
      ...PROFILE_SELECT,
      role: { select: { slug: true, name: true } },
      sadhanaProfile: { select: { dailyRoundTarget: true, reminderTime: true, startedAt: true } },
    },
  });

  return ok(res, {
    ...user,
    // The app hides the admin entry point unless this is true, and the API
    // enforces it again on every admin route regardless.
    canAccessAdmin: req.auth.permissions.size > 0,
  });
};

/** PATCH /api/app/me */
export const update = async (req, res) => {
  const { name, avatarUrl, timezone } = req.valid.body;

  if (timezone && !isValidTimezone(timezone)) {
    throw badRequest(`Not a recognised timezone: ${timezone}`);
  }

  const user = await prisma.user.update({
    where: { id: req.auth.user.id },
    data: { name, avatarUrl, timezone },
    select: PROFILE_SELECT,
  });

  // The cached auth payload carries the timezone and the language choices; a
  // stale cache would send the next sloka to the wrong hour.
  await authService.invalidateUser(user.id);
  return ok(res, user);
};

/**
 * PATCH /api/app/me/languages
 *
 * The three choices are independent and may all differ or all match. They are
 * set together because changing one usually means reconsidering the others, and
 * because the app presents them on a single screen.
 */
export const updateLanguages = async (req, res) => {
  const { appLanguage, mantraLanguage, readingLanguage } = req.valid.body;

  // Each is checked against the Language table for the *specific* slot it is
  // being used in — Sanskrit is a fine mantra language and a poor app language.
  const codes = [appLanguage, mantraLanguage, readingLanguage].filter(Boolean);
  const known = await prisma.language.findMany({
    where: { code: { in: codes }, isActive: true },
  });
  const byCode = new Map(known.map((row) => [row.code, row]));

  const checks = [
    [appLanguage, 'isAppLanguage', 'an app language'],
    [mantraLanguage, 'isMantraLanguage', 'a mantra language'],
    [readingLanguage, 'isReadingLanguage', 'a reading language'],
  ];

  for (const [code, flag, label] of checks) {
    if (!code) continue;
    const language = byCode.get(code);
    if (!language) throw badRequest(`Unknown or inactive language: ${code}`);
    if (!language[flag]) throw badRequest(`${language.englishName} cannot be used as ${label}`);
  }

  const user = await prisma.user.update({
    where: { id: req.auth.user.id },
    data: { appLanguage, mantraLanguage, readingLanguage },
    select: PROFILE_SELECT,
  });

  await authService.invalidateUser(user.id);
  return ok(res, user);
};

/**
 * GET /api/app/me/summary
 * The numbers the profile screen shows. Counted rather than stored, because
 * none of them is read often enough to be worth a denormalised column.
 */
export const summary = async (req, res) => {
  const userId = req.auth.user.id;

  const [days, rounds, tasks, favorites, slokas] = await Promise.all([
    prisma.sadhanaDay.count({ where: { userId, roundsCompleted: { gt: 0 } } }),
    prisma.sadhanaDay.aggregate({ where: { userId }, _sum: { roundsCompleted: true } }),
    prisma.sadhanaTask.count({ where: { userId, status: 'DONE' } }),
    prisma.favorite.count({ where: { userId } }),
    prisma.userDailySloka.count({ where: { userId, seenAt: { not: null } } }),
  ]);

  return ok(res, {
    chantingDays: days,
    totalRounds: rounds._sum.roundsCompleted || 0,
    tasksCompleted: tasks,
    favorites,
    slokasRead: slokas,
  });
};

/** PATCH /api/app/me/sadhana-profile — standing practice preferences. */
export const updateSadhanaProfile = async (req, res) => {
  const { dailyRoundTarget, reminderTime } = req.valid.body;
  const userId = req.auth.user.id;

  const profile = await prisma.sadhanaProfile.upsert({
    where: { userId },
    update: { dailyRoundTarget, reminderTime },
    create: { userId, dailyRoundTarget, reminderTime },
  });

  await audit.record(req, {
    action: 'sadhana.profile.update',
    entityType: 'SadhanaProfile',
    entityId: profile.id,
    after: { dailyRoundTarget, reminderTime },
  });

  return ok(res, profile);
};
