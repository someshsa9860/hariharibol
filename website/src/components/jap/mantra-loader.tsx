'use client';

import { MantraList } from './mantra-list';
import { ErrorState, PageLoading } from '@/components/ui/states';
import { useApi } from '@/lib/use-api';
import type { Mantra } from '@/lib/types';

export function MantraLoader() {
  const mantras = useApi<Mantra[]>('/mantras?pageSize=100');
  if (mantras.loading) return <PageLoading />;
  if (!mantras.data) return <ErrorState message="The mantras could not be loaded right now." onRetry={mantras.reload} />;
  return <MantraList mantras={mantras.data} />;
}
