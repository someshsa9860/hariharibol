// The routine tab's data and rules. It lives in this browser first (so it works offline and for anyone with no
// account) and is mirrored to the account in the background — POST /routine/sync — so it follows a person to a new
// phone. This file holds no React: the shapes, the day's list, and how a ticked item compares with its time.

export type Category = 'devotion' | 'work' | 'home' | 'errand';
export type Slot = 'morning' | 'afternoon' | 'evening' | 'anytime';

export interface Task { id: string; day: string; title: string; category: Category; slot: Slot; windowStart?: number; windowEnd?: number; isDone: boolean; doneAt?: number }
export interface DailyItem { id: string; title: string; category: Category; slot: Slot; windowStart?: number; windowEnd?: number; since: string; until: string }
export interface Check { itemId: string; day: string; doneAt?: number | null }

export interface RoutineState {
  tasks: Task[];
  daily: DailyItem[];
  checks: Check[];
  // What the server has not been told yet.
  dirtyTasks: string[];
  dirtyDaily: string[];
  dirtyChecks: { itemId: string; day: string }[];
  removedTasks: string[];
  removedChecks: { itemId: string; day: string }[];
  syncedFor: string | null;
}

export const EMPTY: RoutineState = { tasks: [], daily: [], checks: [], dirtyTasks: [], dirtyDaily: [], dirtyChecks: [], removedTasks: [], removedChecks: [], syncedFor: null };

export const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'devotion', label: 'Devotion' }, { value: 'work', label: 'Work' }, { value: 'home', label: 'Home' }, { value: 'errand', label: 'Errand' },
];
export const SLOTS: { value: Slot; label: string }[] = [
  { value: 'morning', label: 'Morning' }, { value: 'afternoon', label: 'Afternoon' }, { value: 'evening', label: 'Evening' }, { value: 'anytime', label: 'Anytime' },
];

// Standard routines, with the time each usually has (minutes after midnight).
export const PRESETS: { title: string; category: Category; slot: Slot; start: number; end: number }[] = [
  { title: 'Wake up', category: 'devotion', slot: 'morning', start: 300, end: 330 },
  { title: 'Morning chanting', category: 'devotion', slot: 'morning', start: 330, end: 480 },
  { title: 'Exercise', category: 'home', slot: 'morning', start: 480, end: 540 },
  { title: 'Breakfast', category: 'home', slot: 'morning', start: 540, end: 570 },
  { title: 'Lunch', category: 'home', slot: 'afternoon', start: 780, end: 840 },
  { title: 'Break chanting', category: 'devotion', slot: 'afternoon', start: 900, end: 930 },
  { title: 'Evening chanting', category: 'devotion', slot: 'evening', start: 1080, end: 1170 },
  { title: 'Dinner', category: 'home', slot: 'evening', start: 1230, end: 1290 },
  { title: 'Scripture reading', category: 'devotion', slot: 'evening', start: 1290, end: 1350 },
  { title: 'Sleep', category: 'home', slot: 'evening', start: 1350, end: 1380 },
];

export const newId = () => `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h >= 12 ? 'pm' : 'am';
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${suffix}`;
}

export const parseTime = (value: string): number | undefined => {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : undefined;
};
export const timeValue = (minutes?: number) => (minutes === undefined ? '' : `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`);

export interface Row {
  kind: 'task' | 'daily';
  id: string;
  title: string;
  category: Category;
  slot: Slot;
  windowStart?: number;
  windowEnd?: number;
  done: boolean;
  doneAt?: number | null;
}

/** Everything on the list for one day, in the order of the day. */
export function rowsFor(state: RoutineState, day: string): Row[] {
  const rows: Row[] = [];
  for (const item of state.daily) {
    if (item.since > day || (item.until && item.until < day)) continue;
    const check = state.checks.find((c) => c.itemId === item.id && c.day === day);
    rows.push({ kind: 'daily', id: item.id, title: item.title, category: item.category, slot: item.slot, windowStart: item.windowStart, windowEnd: item.windowEnd, done: Boolean(check), doneAt: check?.doneAt });
  }
  for (const task of state.tasks) {
    if (task.day !== day) continue;
    rows.push({ kind: 'task', id: task.id, title: task.title, category: task.category, slot: task.slot, windowStart: task.windowStart, windowEnd: task.windowEnd, done: task.isDone, doneAt: task.doneAt });
  }
  const order: Record<Slot, number> = { morning: 0, afternoon: 1, evening: 2, anytime: 3 };
  return rows.sort((a, b) => (a.windowStart ?? 10_000 + order[a.slot]) - (b.windowStart ?? 10_000 + order[b.slot]) || a.title.localeCompare(b.title));
}

export type Timing = 'early' | 'onTime' | 'late';

/** How a ticked item compares with its time — always shown with a word as well as a colour. */
export function timingOf(row: Row): Timing | null {
  if (!row.done || row.doneAt === null || row.doneAt === undefined || row.windowStart === undefined || row.windowEnd === undefined) return null;
  if (row.doneAt < row.windowStart) return 'early';
  if (row.doneAt > row.windowEnd) return 'late';
  return 'onTime';
}

export const TIMING_LABEL: Record<Timing, string> = { early: 'Early', onTime: 'On time', late: 'Late' };

/** The seven days around today for the date strip: three before, today, three after. */
export function stripDays(centre: string): string[] {
  const base = new Date(`${centre}T12:00:00`);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i - 3);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
}

export const nowMinutes = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };

export function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
