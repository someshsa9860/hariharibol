// The words of a festival push, in the reader's language. Pure: no database, no queue — it only
// reads the festival row it is given, so `test/parana-notify.test.js` runs without either.
//
// The wrapper words ("today", "tomorrow", the Vaishnava date, the fortnight) come from NOTICES
// (utils/messages.js). The festival's own name and description are the calendar's data: they go in the
// reader's language where the admin has translated them (`words`, see utils/calendar-translation.js) and
// as saved where not. A parana row (the morning after an Ekadashi fast) is built from its times instead — see
// `paranaMessage`.

import { clockTime } from './date.js';
import { notice } from './messages.js';
import { plainWords } from './calendar-translation.js';

function titleOf(festival, days, chain, words) {
  const name = words('NAME', festival.name);
  if (days === 0) return notice('festivalToday', chain, [name]);
  if (days === 1) return notice('festivalTomorrow', chain, [name]);
  return notice('festivalInDays', chain, [name, days]);
}

// "Fast-breaking time: 6:26 AM to 8:42 AM" — the window the calendar worked out for the parana
// day (services/parana.js), times written in the reader's language. Worded "if you kept the fast
// yesterday" when the calendar holds two dates for this Ekadashi, so a reader who is keeping the
// fast today is never told to break it.
function paranaMessage(festival, chain, words) {
  const { startsAt, endsAt, place, timezone, twoDates, alsoFastToday } = festival.details;
  const ekadashi = words('NAME', festival.details.ekadashi);
  const from = clockTime(startsAt, chain, timezone);
  const to = clockTime(endsAt, chain, timezone);
  const lines = [notice(twoDates ? 'paranaBodyIfYesterday' : 'paranaBody', chain, [ekadashi, from, to, place])];
  if (alsoFastToday) lines.push(notice('paranaFastToday', chain));
  return { title: notice('paranaTitle', chain, [from, to]), body: lines.join(' ') };
}

// `days` is how far off the festival is: 0 on its own day. A parana is only ever pushed on its
// own day, and one without its times (an edited row) reads like any other festival. `words(kind, text)` is the
// calendar's translation for this reader (`wordsFor` in services/calendar-translation.js); the default is English.
export function message(festival, days, chain, words = plainWords) {
  if (days === 0 && festival.kind === 'PARANA' && festival.details?.startsAt && festival.details?.endsAt) {
    return paranaMessage(festival, chain, words);
  }
  const date = festival.date.toISOString().slice(0, 10);
  const later = festival.details?.vaishnavaDate && festival.details.vaishnavaDate !== date;
  const lines = [words('DESCRIPTION', festival.description)?.trim()];
  if (later) lines.push(notice('festivalVaishnava', chain, [festival.details.vaishnavaDate]));
  const fortnight = festival.paksha
    ? ` · ${notice(festival.paksha === 'SHUKLA' ? 'pakshaShukla' : 'pakshaKrishna', chain)}`
    : '';
  return {
    title: titleOf(festival, days, chain, words),
    body: lines.filter(Boolean).join(' ') || `${words('NAME', festival.name)}${fortnight}`,
  };
}
