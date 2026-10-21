import { CALENDAR_ICONS } from '@/lib/calendar-icons';

// The drawing for a kind of day (Ekadashi, Chaturthi, …), coloured by the text colour around it.
export function CalendarIcon({ kind, className = 'h-4 w-4' }: { kind: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
      dangerouslySetInnerHTML={{ __html: CALENDAR_ICONS[kind] ?? CALENDAR_ICONS.FESTIVAL }}
    />
  );
}
