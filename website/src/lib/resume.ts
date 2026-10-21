'use client';

// Where a guest left off in each book. Signed in, the API keeps this (PUT /progress); this is the same idea for
// someone with no account, kept in the browser.

const KEY = 'hhb.resume';

export interface ResumePoint {
  slug: string;
  title: string;
  cantoNumber: number | null;
  chapterNumber: number | null;
  verseNumber: number;
  at: number;
}

export function readResume(): ResumePoint[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as ResumePoint[];
  } catch {
    return [];
  }
}

export function saveResume(point: Omit<ResumePoint, 'at'>): void {
  try {
    const rest = readResume().filter((item) => item.slug !== point.slug);
    localStorage.setItem(KEY, JSON.stringify([{ ...point, at: Date.now() }, ...rest].slice(0, 12)));
  } catch {
    // Not remembered; reading is unaffected.
  }
}
