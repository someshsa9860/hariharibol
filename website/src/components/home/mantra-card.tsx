/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { Motif } from '@/components/ui/motif';
import type { Mantra } from '@/lib/types';

export function MantraCard({ mantra }: { mantra: Mantra }) {
  return (
    <Link href={`/jap/${mantra.slug}`} className="mantra-card card card-hover">
      <div className="mantra-card-art">
        {mantra.deity?.imageUrl ? <img src={mantra.deity.imageUrl} alt="" loading="lazy" /> : <Motif kind="sun" />}
      </div>
      <div className="mantra-card-body">
        {mantra.category && <span className="badge">{mantra.category}</span>}
        <h3>{mantra.name}</h3>
        <p className="deva mantra-line" lang={mantra.textLanguage}>{mantra.text}</p>
      </div>
    </Link>
  );
}
