'use client';

import { useCallback, useEffect, useRef } from 'react';
import { api } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/auth-provider';
import { useLocalState } from '@/lib/use-local-state';
import { EMPTY, daysAgo, newId, nowMinutes, type Category, type Check, type DailyItem, type RoutineState, type Slot, type Task } from './routine-store';

interface ServerRoutine { tasks: Task[]; daily: DailyItem[]; checks: Check[] }
export interface NewItem { title: string; category: Category; slot: Slot; windowStart?: number; windowEnd?: number }

/** The routine, kept in this browser and mirrored to the account while signed in. */
export function useRoutine() {
  const { user } = useAuth();
  const [state, setState, ready] = useLocalState<RoutineState>('hhb.routine', EMPTY);
  const syncing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const sync = useCallback(async () => {
    if (!user || syncing.current) return;
    syncing.current = true;
    const s = stateRef.current;
    const since = daysAgo(30);
    // The first time this account is seen here, everything on this browser is new to it.
    const first = s.syncedFor !== user.id;
    const tasks = s.tasks.filter((t) => first || s.dirtyTasks.includes(t.id));
    const daily = s.daily.filter((d) => first || s.dirtyDaily.includes(d.id));
    const checks = s.checks.filter((c) => first || s.dirtyChecks.some((d) => d.itemId === c.itemId && d.day === c.day));
    try {
      const body = { since, tasks: tasks.map(clean), daily: daily.map(clean), checks: checks.map((c) => ({ itemId: c.itemId, day: c.day, doneAt: c.doneAt ?? null })), removedTasks: s.removedTasks, removedChecks: s.removedChecks };
      const server = await api<ServerRoutine>('/routine/sync', { method: 'POST', auth: 'required', body });
      setState((current) => ({
        ...current,
        // Older rows the strip can no longer reach stay as they are; the rest are what the account now holds.
        tasks: [...current.tasks.filter((t) => t.day < since), ...server.tasks],
        daily: server.daily,
        checks: [...current.checks.filter((c) => c.day < since), ...server.checks],
        dirtyTasks: [], dirtyDaily: [], dirtyChecks: [], removedTasks: [], removedChecks: [], syncedFor: user.id,
      }));
    } catch {
      // Offline or refused: the changes stay marked and go with the next attempt.
    }
    syncing.current = false;
  }, [user, setState]);

  // Sync on arrival and shortly after each change.
  useEffect(() => { if (ready && user) void sync(); }, [ready, user, sync]);
  const queue = useCallback(() => {
    if (!user) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void sync(), 1200);
  }, [user, sync]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const addTask = useCallback((day: string, item: NewItem) => {
    const id = newId();
    setState((s) => ({ ...s, tasks: [...s.tasks, { id, day, ...item, isDone: false }], dirtyTasks: [...s.dirtyTasks, id] }));
    queue();
  }, [setState, queue]);

  const addDaily = useCallback((since: string, item: NewItem) => {
    const id = newId();
    setState((s) => ({ ...s, daily: [...s.daily, { id, since, until: '', ...item }], dirtyDaily: [...s.dirtyDaily, id] }));
    queue();
  }, [setState, queue]);

  const toggle = useCallback((kind: 'task' | 'daily', id: string, day: string) => {
    setState((s) => {
      if (kind === 'task') {
        return { ...s, tasks: s.tasks.map((t) => (t.id === id ? (t.isDone ? { ...t, isDone: false, doneAt: undefined } : { ...t, isDone: true, doneAt: nowMinutes() }) : t)), dirtyTasks: [...new Set([...s.dirtyTasks, id])] };
      }
      const existing = s.checks.find((c) => c.itemId === id && c.day === day);
      if (existing) {
        return { ...s, checks: s.checks.filter((c) => c !== existing), dirtyChecks: s.dirtyChecks.filter((d) => !(d.itemId === id && d.day === day)), removedChecks: [...s.removedChecks, { itemId: id, day }] };
      }
      return { ...s, checks: [...s.checks, { itemId: id, day, doneAt: nowMinutes() }], dirtyChecks: [...s.dirtyChecks, { itemId: id, day }], removedChecks: s.removedChecks.filter((d) => !(d.itemId === id && d.day === day)) };
    });
    queue();
  }, [setState, queue]);

  const remove = useCallback((kind: 'task' | 'daily', id: string, day: string) => {
    setState((s) => {
      if (kind === 'task') return { ...s, tasks: s.tasks.filter((t) => t.id !== id), dirtyTasks: s.dirtyTasks.filter((x) => x !== id), removedTasks: [...s.removedTasks, id] };
      // A daily item ends today rather than vanishing from the days already past.
      const yesterday = new Date(`${day}T12:00:00`);
      yesterday.setDate(yesterday.getDate() - 1);
      const until = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
      return { ...s, daily: s.daily.map((d) => (d.id === id ? { ...d, until } : d)), dirtyDaily: [...new Set([...s.dirtyDaily, id])] };
    });
    queue();
  }, [setState, queue]);

  return { state, ready, addTask, addDaily, toggle, remove };
}

/** The API refuses unknown fields on a row less loudly than a missing one; send exactly what it documents. */
function clean<T extends Task | DailyItem>(row: T): T {
  const copy = { ...row } as Record<string, unknown>;
  for (const key of Object.keys(copy)) if (copy[key] === undefined || copy[key] === null) delete copy[key];
  return copy as T;
}
