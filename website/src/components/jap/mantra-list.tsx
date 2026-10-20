'use client';

import { useMemo, useState } from 'react';
import { MantraCard } from '@/components/home/mantra-card';
import { EmptyState } from '@/components/ui/states';
import type { Mantra } from '@/lib/types';

export function MantraList({ mantras }: { mantras: Mantra[] }) {
  const categories = useMemo(() => [...new Set(mantras.map((m) => m.category).filter(Boolean))] as string[], [mantras]);
  const [category, setCategory] = useState<string | null>(null);
  const shown = category ? mantras.filter((m) => m.category === category) : mantras;

  return (
    <>
      {categories.length > 1 && (
        <div className="chip-row" role="group" aria-label="Mantra categories">
          <button className="chip" aria-pressed={category === null} onClick={() => setCategory(null)}>All</button>
          {categories.map((c) => <button key={c} className="chip" aria-pressed={category === c} onClick={() => setCategory(c)}>{c}</button>)}
        </div>
      )}
      {shown.length === 0 ? <EmptyState title="No mantras here yet" motif="sun" /> : (
        <ul className="mantra-grid">{shown.map((m) => <li key={m.id}><MantraCard mantra={m} /></li>)}</ul>
      )}
    </>
  );
}
