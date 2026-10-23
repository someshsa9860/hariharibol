// The daily devotee etiquette push: `etiquette.deliver`, every 15 minutes.
//
// Each run pushes to the readers whose own local delivery time (07:15 unless the setting says otherwise) fell in the
// last 15 minutes, so everyone gets it at 07:15 wherever they are. The delivery time is a multiple of the 15-minute
// step, which is what makes each reader fall in exactly one run's window. The etiquette is the day's, the same for
// everyone whose local date it is (services/etiquette.js `dayFor`); a row in `EtiquetteDelivery` for the reader and
// the date is what stops a second send, not the schedule.
//
// Only readers who can be pushed are looked at — not banned, with a device of the reader's app that has a push token —
// and only published etiquette is ever sent: an excluded item is never the day's.

import { prisma } from '../../config/database.js';
import logger from '../../config/logger.js';
import { etiquette } from '../../config/etiquette.js';
import { ETIQUETTE_DEFAULT_DELIVERY_TIME, SETTING_KEYS } from '../../config/constants.js';
import * as notify from '../../services/notify.js';
import * as settings from '../../services/setting.js';
import * as service from '../../services/etiquette.js';
import { parseTimeOfDay, isDeliveryDue } from '../../utils/sloka-delivery.js';
import { etiquettePush } from '../../utils/etiquette.js';
import { localDateString, localMinutes, toDateColumn } from '../../utils/date.js';

const BATCH_SIZE = 500;

/** The setting's minutes after midnight; a missing or unreadable value is 07:15. */
const targetOf = (setting) => parseTimeOfDay(setting) ?? parseTimeOfDay(ETIQUETTE_DEFAULT_DELIVERY_TIME);

export default async function deliver() {
  const targetMinutes = targetOf(await settings.get(SETTING_KEYS.ETIQUETTE_DELIVERY_TIME));
  const now = new Date();
  const days = new Map(); // local date → the day's etiquette, looked up once per date in this run
  let sent = 0;
  let cursor = null;

  for (;;) {
    const users = await prisma.user.findMany({
      where: { isBanned: false, devices: { some: { app: 'main', fcmToken: { not: null }, isBanned: false } } },
      select: { id: true, name: true, timezone: true, readingLanguage: true, appLanguage: true },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!users.length) break;
    cursor = users[users.length - 1].id;

    for (const user of users) {
      const due = isDeliveryDue({ localMinutes: localMinutes(user.timezone, now), targetMinutes, windowMinutes: etiquette.deliveryStepMinutes });
      if (!due) continue;

      const date = localDateString(user.timezone, now);
      const already = await prisma.etiquetteDelivery.findUnique({ where: { userId_date: { userId: user.id, date: toDateColumn(date) } }, select: { id: true } });
      if (already) continue;

      if (!days.has(date)) days.set(date, await service.dayFor(date));
      const day = days.get(date);
      if (!day) continue; // nothing is published

      try {
        const { title, body, data } = etiquettePush({ item: day.etiquette, user });
        await notify.toUser(user.id, { type: 'ETIQUETTE', title, body, data });
        await prisma.etiquetteDelivery.create({ data: { userId: user.id, date: toDateColumn(date), etiquetteId: day.etiquetteId } });
        sent += 1;
      } catch (err) {
        if (err?.code === 'P2002') continue; // another run got there first
        logger.warn({ err: err.message, userId: user.id }, 'devotee etiquette push failed');
      }
    }
  }

  logger.info({ sent }, 'devotee etiquette delivered');
  return { sent };
}
