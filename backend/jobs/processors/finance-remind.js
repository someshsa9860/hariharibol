// "Enter this month's costs" — the month-end nudge to the super admins.
//
// Runs once a day (config/cron.js). From the last two days of a month until the first week of the next, while
// a month's costs have not been confirmed, each super admin gets a push (and an email) once a day. After that
// the admin panel's banner is the only reminder. `FinanceMonth.lastRemindedOn` stops a retried run sending twice.

import { prisma } from '../../config/database.js';
import env from '../../config/env.js';
import logger from '../../config/logger.js';
import * as notify from '../../services/notify.js';
import * as mailer from '../../services/mailer.js';
import * as finance from '../../services/finance.js';
import { localDateString } from '../../utils/date.js';

const REMIND_UNTIL_DAY = 7;

const label = (month) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });

// `at` is for tests, which stand on the last day of a month without waiting for it.
export default async function financeRemind(job = null, at = new Date()) {
  const today = localDateString(finance.TIMEZONE, at);
  const day = Number(today.slice(8, 10));
  const inFinalDays = finance.daysLeftInMonth(at) <= 2;
  if (!inFinalDays && day > REMIND_UNTIL_DAY) return { reminded: 0 };

  const [month] = (await finance.pendingMonths(at)).filter((m) => m === finance.previousMonth(finance.currentMonth(at)) || inFinalDays);
  if (!month) return { reminded: 0 };

  const row = await prisma.financeMonth.findUnique({ where: { month } });
  if (row?.lastRemindedOn?.toISOString().slice(0, 10) === today) return { reminded: 0 };

  const admins = await prisma.user.findMany({
    where: { isBanned: false, role: { slug: 'super_admin' } },
    select: { id: true, email: true },
  });

  const title = `Enter ${label(month)} costs`;
  const body = 'Add this month’s advertising, salaries and purchases, then confirm the month in Finance.';
  for (const admin of admins) {
    await notify.toUser(admin.id, { type: 'SYSTEM', title, body, data: { deeplink: 'admin:finance', month }, campaign: `finance-${month}-${today}`, source: 'finance' });
    await mailer.send({
      to: admin.email,
      subject: title,
      template: 'finance-reminder',
      data: { monthLabel: label(month), link: `${env.ADMIN_BASE_URL}/finance` },
    });
  }

  await prisma.financeMonth.upsert({
    where: { month },
    create: { month, lastRemindedOn: new Date(`${today}T00:00:00Z`) },
    update: { lastRemindedOn: new Date(`${today}T00:00:00Z`) },
  });

  logger.info({ month, admins: admins.length }, 'finance reminder sent');
  return { reminded: admins.length, month };
}
