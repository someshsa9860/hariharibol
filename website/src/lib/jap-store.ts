'use client';

// What the chant counter keeps in this browser: the round in progress for each mantra (so closing the tab mid-round
// loses nothing), and today's rounds for someone with no account. Signed in, the API holds the real record.

import { localDate } from './format';

const PROGRESS = (slug: string) => `hhb.jap.${slug}`;
const TODAY = 'hhb.jap.today';
const TARGET = 'hhb.jap.target';

export const BEADS_PER_ROUND = 108;
export const DEFAULT_TARGET = 16;

export interface Progress { beads: number; rounds: number; date: string }

function read<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') as T | null;
  } catch {
    return null;
  }
}
function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* not remembered */ }
}

export function loadProgress(slug: string): Progress {
  const saved = read<Progress>(PROGRESS(slug));
  const today = localDate();
  // A round left half-done is carried to the next day, but yesterday's finished rounds are not today's.
  return saved ? { beads: saved.beads, rounds: saved.date === today ? saved.rounds : 0, date: today } : { beads: 0, rounds: 0, date: today };
}

export const saveProgress = (slug: string, progress: Progress) => write(PROGRESS(slug), progress);

export function guestRoundsToday(): number {
  const saved = read<{ date: string; rounds: number }>(TODAY);
  return saved && saved.date === localDate() ? saved.rounds : 0;
}

export function addGuestRounds(count: number): number {
  const total = guestRoundsToday() + count;
  write(TODAY, { date: localDate(), rounds: total });
  return total;
}

export const guestTarget = (): number => read<number>(TARGET) ?? DEFAULT_TARGET;
export const setGuestTarget = (value: number) => write(TARGET, value);
