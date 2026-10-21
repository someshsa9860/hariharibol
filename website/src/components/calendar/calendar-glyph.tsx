import { CALENDAR_ICONS } from '@/lib/calendar-icons';

export const KIND_LABEL: Record<string, string> = {
  EKADASHI: 'Ekadashi',
  CHATURTHI: 'Chaturthi',
  PURNIMA: 'Purnima',
  AMAVASYA: 'Amavasya',
  PRADOSH: 'Pradosh',
  SANKRANTI: 'Sankranti',
  FESTIVAL: 'Festival',
};

/** The drawing for a kind of day — a lotus for Ekadashi, a modak for Chaturthi, a lamp for a festival… */
export function CalendarGlyph({ kind, size = 18 }: { kind: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`cal-glyph cal-${kind.toLowerCase()}`}
      dangerouslySetInnerHTML={{ __html: CALENDAR_ICONS[kind] ?? CALENDAR_ICONS.FESTIVAL }}
    />
  );
}
