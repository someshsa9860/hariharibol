// When no verse has been set for today, the home page still shows one: a well-loved verse chosen by the day of the year,
// so the same verse shows all day and a different one tomorrow. Verse ids are the Gita's ("1.<chapter>.<verse>").
const FALLBACK_VERSES = ['1.2.47', '1.2.48', '1.4.34', '1.18.66', '1.9.34', '1.2.14', '1.6.5', '1.12.13', '1.3.35', '1.2.20'];

export function fallbackVerseId(date = new Date()): string {
  const start = Date.UTC(date.getFullYear(), 0, 0);
  const day = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - start) / 86_400_000);
  return FALLBACK_VERSES[day % FALLBACK_VERSES.length];
}
