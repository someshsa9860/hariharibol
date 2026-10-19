import type { Section, Verse, I18nMap } from '@/lib/types';

/** "2.47", "1.3.28" or "2.47-48" — how a verse is cited. */
export function verseRef(verse: Pick<Verse, 'cantoNumber' | 'chapterNumber' | 'verseNumber' | 'verseNumberEnd'>): string {
  const own = verse.verseNumberEnd ? `${verse.verseNumber}-${verse.verseNumberEnd}` : `${verse.verseNumber}`;
  return [verse.cantoNumber, verse.chapterNumber, own].filter((part) => part !== null && part !== undefined).join('.');
}

/** "Bhagavad Gita 2.47" */
export function verseCitation(verse: Verse): string {
  return `${verse.book?.title ?? ''} ${verseRef(verse)}`.trim();
}

/** The title in the reader's language chain, stopping at English — the same rule the app follows. */
export function pickTitle(map: I18nMap, chain: string[], fallback: string | null): string {
  if (map) {
    for (const code of chain) if (map[code]) return map[code];
    if (map.en) return map.en;
  }
  return fallback ?? '';
}

/** The Gita's plain chapter title is Devanagari; the English heading is in the map. */
export function chapterTitle(section: Section, chain: string[]): string {
  return pickTitle(section.titleI18n, chain, section.title);
}

export function chapterSummary(section: Section, chain: string[]): string {
  return pickTitle(section.summaryI18n, chain, section.summary);
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count.toLocaleString('en-IN')} ${count === 1 ? one : many}`;
}

export function formatMoney(minor: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: minor % 100 === 0 ? 0 : 2 }).format(minor / 100);
  } catch {
    return `${currency} ${(minor / 100).toFixed(0)}`;
  }
}

/** Plain text for the first sentence or two of a long passage (meta descriptions, previews). */
export function excerpt(text: string | null | undefined, max = 160): string {
  if (!text) return '';
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 80 ? cut.lastIndexOf(' ') : max)}…`;
}

export function localDate(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function compactCount(count: number): string {
  if (count < 1000) return String(count);
  if (count < 1_000_000) return `${(count / 1000).toFixed(count < 10_000 ? 1 : 0).replace(/\.0$/, '')}K`;
  return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
}
