import type { Metadata } from 'next';
import { MantraList } from '@/components/jap/mantra-list';
import { TodayPanel } from '@/components/jap/today-panel';
import { MantraLoader } from '@/components/jap/mantra-loader';
import { serverGet } from '@/lib/api/server';
import type { Mantra } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Jap — mantras and the chant counter',
  description: 'Chant the Hare Krishna mahamantra and other mantras with a round counter: 108 to a round, today’s target, your streak — and the Sanskrit, transliteration and meaning beside it.',
  alternates: { canonical: '/jap' },
};

export default async function JapPage() {
  const mantras = await serverGet<Mantra[]>('/api/app/mantras', { query: { pageSize: 100 }, revalidate: 0 }).catch(() => null);

  return (
    <div className="page">
      <header className="page-title">
        <p className="eyebrow">Practice</p>
        <h1>Jap</h1>
        <p>Chant with a counter that keeps your rounds. Open a mantra to begin — no account needed.</p>
      </header>
      <TodayPanel mantras={(mantras ?? []).map((m) => ({ id: m.id, slug: m.slug, name: m.name }))} />
      <h2 className="subhead">Mantras</h2>
      {mantras ? <MantraList mantras={mantras} /> : <MantraLoader />}
    </div>
  );
}
