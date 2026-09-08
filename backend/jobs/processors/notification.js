// Chanting reminders.
//
// Runs every fifteen minutes and sends to the users whose own reminder time has
// just come round. Reminder times are stored as "04:30" local to the user, not
// as an instant — someone who sets 4:30am means 4:30am wherever they are, and
// wants it to follow them when they travel.
//
// Anyone who has already met their target today is skipped. A reminder to chant
// when the rounds are done is the fastest way to get notifications turned off.

const { prisma } = require('../../config/database');
const logger = require('../../config/logger');
const notify = require('../../services/notify');
const { localDateString, toDateColumn } = require('../../utils/date');

const WINDOW_MINUTES = 15;
const BATCH_SIZE = 500;

// "04:30" in the user's zone, as minutes since their local midnight.
function localMinutes(timezone, at = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(at);
    const [hour, minute] = parts.split(':').map(Number);
    return hour * 60 + minute;
  } catch {
    return at.getUTCHours() * 60 + at.getUTCMinutes();
  }
}

function parseReminder(value) {
  const [hour, minute] = String(value).split(':').map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return hour * 60 + minute;
}

module.exports = async function notificationProcessor(job) {
  const now = new Date();
  let cursor = null;
  let sent = 0;

  for (;;) {
    const profiles = await prisma.sadhanaProfile.findMany({
      where: { reminderTime: { not: null }, user: { isBanned: false } },
      select: {
        id: true,
        reminderTime: true,
        dailyRoundTarget: true,
        user: { select: { id: true, timezone: true, name: true } },
      },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!profiles.length) break;
    cursor = profiles[profiles.length - 1].id;

    for (const profile of profiles) {
      const target = parseReminder(profile.reminderTime);
      if (target === null) continue;

      // Did this quarter hour just pass their reminder time?
      const current = localMinutes(profile.user.timezone, now);
      const elapsed = current - target;
      if (elapsed < 0 || elapsed >= WINDOW_MINUTES) continue;

      const date = localDateString(profile.user.timezone);
      const day = await prisma.sadhanaDay.findUnique({
        where: { userId_date: { userId: profile.user.id, date: toDateColumn(date) } },
        select: { roundsCompleted: true, roundTarget: true },
      });

      // Already done for the day.
      if (day && day.roundTarget > 0 && day.roundsCompleted >= day.roundTarget) continue;

      const remaining = (day?.roundTarget || profile.dailyRoundTarget) - (day?.roundsCompleted || 0);

      await notify.toUser(profile.user.id, {
        type: 'SADHANA',
        title: 'Time to chant',
        body:
          remaining > 0
            ? `${remaining} round${remaining === 1 ? '' : 's'} left today.`
            : 'Your chanting time is here.',
        data: { deeplink: 'hariharibol://sadhana' },
      });

      sent += 1;
    }

    await job.updateProgress({ sent });
  }

  logger.info({ sent }, 'chanting reminders sent');
  return { sent };
};
