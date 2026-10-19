'use client';

// Which verses, mantras and reels this reader has bookmarked. The pages the server draws know nothing about the
// reader, so the bookmark state is fetched once after sign-in and kept here; the hearts read it.

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { api } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/auth-provider';
import { useToast } from '@/components/ui/toast';

type Kind = 'verse' | 'mantra' | 'reel' | 'book';
const marks = new Map<string, string>(); // "verse:<id>" → favourite id
const listeners = new Set<() => void>();
let loadedFor: string | null = null;
let version = 0;

const emit = () => { version += 1; listeners.forEach((listener) => listener()); };
const key = (kind: Kind, id: string) => `${kind}:${id}`;

interface FavoriteRow { id: string; type: Kind; verse?: { id: string } | null; mantra?: { id: string } | null; book?: { id: string } | null; reel?: { id: string } | null }

async function load(userId: string) {
  if (loadedFor === userId) return;
  loadedFor = userId;
  try {
    const rows = await api<FavoriteRow[]>('/favorites', { auth: 'required' });
    marks.clear();
    for (const row of rows) {
      const target = row[row.type];
      if (target) marks.set(key(row.type, target.id), row.id);
    }
    emit();
  } catch {
    loadedFor = null;
  }
}

export function useFavorite(kind: Kind, id: string) {
  const { user, requireSignIn } = useAuth();
  const toast = useToast();
  useSyncExternalStore((listener) => { listeners.add(listener); return () => listeners.delete(listener); }, () => version, () => 0);

  useEffect(() => {
    if (user) void load(user.id);
    else if (loadedFor) { loadedFor = null; marks.clear(); emit(); }
  }, [user]);

  const favoriteId = marks.get(key(kind, id)) ?? null;

  const toggle = useCallback(async () => {
    if (!requireSignIn('Sign in to save this to your favourites.')) return;
    const mark = key(kind, id);
    const existing = marks.get(mark);
    try {
      if (existing) {
        marks.delete(mark);
        emit();
        await api(`/favorites/${existing}`, { method: 'DELETE', auth: 'required' });
      } else {
        marks.set(mark, 'pending');
        emit();
        const row = await api<{ id: string }>('/favorites', { method: 'POST', auth: 'required', body: { [`${kind}Id`]: id } });
        marks.set(mark, row.id);
        emit();
      }
    } catch {
      if (existing) marks.set(mark, existing); else marks.delete(mark);
      emit();
      toast('Could not update your favourites. Please try again.');
    }
  }, [id, kind, requireSignIn, toast]);

  return { isFavorite: favoriteId !== null, toggle };
}
