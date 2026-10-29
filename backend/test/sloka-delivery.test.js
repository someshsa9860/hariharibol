// When the daily sloka is due. No database — the functions are loaded on their own.
//
//   npm test

import test from 'node:test';
import assert from 'node:assert/strict';

import { parseTimeOfDay, deliveryMinutes, isDeliveryDue, dueZones } from '../utils/sloka-delivery.js';
import { localDateString, localMinutes } from '../utils/date.js';
import { SLOKA_DELIVERY_STEP_MINUTES } from '../config/cron.js';

const STEP = SLOKA_DELIVERY_STEP_MINUTES;

test('a time of day is hours and minutes on a 24-hour clock', () => {
  assert.equal(parseTimeOfDay('04:30'), 270);
  assert.equal(parseTimeOfDay('4:30'), 270);
  assert.equal(parseTimeOfDay('00:00'), 0);
  assert.equal(parseTimeOfDay('23:59'), 23 * 60 + 59);
  for (const bad of ['', '6', '24:00', '04:60', '4.30', 'half past four', null, undefined]) {
    assert.equal(parseTimeOfDay(bad), null, `${bad} is not a time`);
  }
});

test('a missing or unreadable setting is 04:30', () => {
  assert.equal(deliveryMinutes(null), 270);
  assert.equal(deliveryMinutes('6'), 270); // the old hour-only value
  assert.equal(deliveryMinutes('05:15'), 5 * 60 + 15);
});

test('the half hour a time falls in is the one that sends', () => {
  const due = (local, target) => isDeliveryDue({ localMinutes: local, targetMinutes: target, windowMinutes: STEP });

  assert.equal(due(4 * 60 + 30, 270), true, 'the run at exactly 04:30');
  assert.equal(due(4 * 60, 270), false, 'the run before it');
  assert.equal(due(5 * 60, 270), false, 'the run after it');
  assert.equal(due(5 * 60, 4 * 60 + 40), true, '04:40 goes at the next half hour');
});

test('every reader falls in exactly one run, whatever their offset from UTC', () => {
  // Runs are at :00 and :30 UTC. Kolkata is +5:30, Kathmandu +5:45, Adelaide +9:30, Kiritimati +14.
  for (const timezone of ['Asia/Kolkata', 'Asia/Kathmandu', 'Australia/Adelaide', 'Pacific/Kiritimati', 'America/St_Johns']) {
    const day = Date.UTC(2026, 9, 14);
    const sent = [];
    for (let at = day; at < day + 2 * 24 * 3600 * 1000; at += STEP * 60 * 1000) {
      const minutes = localMinutes(timezone, new Date(at));
      if (isDeliveryDue({ localMinutes: minutes, targetMinutes: 270, windowMinutes: STEP })) sent.push(at);
    }
    assert.equal(sent.length, 2, `${timezone}: once on each of two days, got ${sent.length}`);
  }
});

test('counted round midnight', () => {
  const due = (local, target) => isDeliveryDue({ localMinutes: local, targetMinutes: target, windowMinutes: STEP });
  assert.equal(due(10, 23 * 60 + 50), true); // 00:10 is 20 minutes after 23:50
  assert.equal(due(40, 23 * 60 + 50), false);
});

test('local minutes follow the reader’s own clock, with midnight as 0', () => {
  const at = new Date(Date.UTC(2026, 9, 14, 23, 0)); // 04:30 the next morning in Kolkata
  assert.equal(localMinutes('Asia/Kolkata', at), 270);
  assert.equal(localMinutes('UTC', new Date(Date.UTC(2026, 9, 14, 0, 5))), 5);
  assert.equal(localMinutes('Not/AZone', new Date(Date.UTC(2026, 9, 14, 1, 2))), 62);
});

test('the zones due in a run, each with its own date', () => {
  const zones = ['Asia/Kolkata', 'Asia/Calcutta', 'America/New_York', 'Pacific/Kiritimati', 'Asia/Kolkata', 'Not/AZone'];
  const run = (iso) => dueZones({ zones, at: new Date(iso), targetMinutes: 270, windowMinutes: STEP });

  // 23:00 UTC on the 17th is 04:30 on the 18th in Kolkata (and its old name), while UTC is still on the 17th.
  const kolkata = run('2026-10-17T23:00:00Z');
  assert.deepEqual([...kolkata], [['Asia/Kolkata', '2026-10-18'], ['Asia/Calcutta', '2026-10-18']]);

  // Kiritimati's 04:30 on the 18th is 14:30 UTC on the 17th.
  assert.deepEqual([...run('2026-10-17T14:30:00Z')], [['Pacific/Kiritimati', '2026-10-18']]);

  // An unknown zone is judged on UTC.
  assert.deepEqual([...run('2026-10-18T04:30:00Z')], [['Not/AZone', '2026-10-18']]);

  assert.equal(run('2026-10-17T22:30:00Z').size, 0, 'no one at 04:00 in Kolkata');
});

test('a cached formatter answers like a new one, zone by zone', () => {
  const at = new Date(Date.UTC(2026, 9, 14, 23, 0));
  for (let i = 0; i < 3; i += 1) {
    assert.equal(localDateString('Asia/Kolkata', at), '2026-10-15');
    assert.equal(localDateString('America/New_York', at), '2026-10-14');
    assert.equal(localMinutes('America/New_York', at), 19 * 60);
  }
  assert.equal(localDateString('Not/AZone', at), '2026-10-14', 'an unknown zone is UTC, and is not remembered as a zone');
});
