import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Counter } from '@/components/jap/counter';
import { Icon } from '@/components/ui/icon';
import { ShareButton } from '@/components/share/share-button';
import { serverGetOrNull } from '@/lib/api/server';
import { excerpt } from '@/lib/format';
import type { Mantra } from '@/lib/types';

type Props = { params: Promise<{ slug: string }> };
const load = (slug: string) => serverGetOrNull<Mantra>(`/api/app/mantras/${slug}`, { revalidate: 300 });

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const mantra = await load(slug).catch(() => null);
  if (!mantra) return { title: 'Mantra not found' };
  return {
    title: `${mantra.name} — chant with a counter`,
    description: excerpt(mantra.description ?? mantra.meaning) || `Chant ${mantra.name} with a round counter.`,
    alternates: { canonical: `/jap/${slug}` },
  };
}

export default async function MantraPage({ params }: Props) {
  const { slug } = await params;
  const mantra = await load(slug);
  if (!mantra) notFound();

  return (
    <div className="page-narrow jap-page">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/jap">Jap</Link><Icon name="right" size={14} /><span>{mantra.name}</span></nav>
      <header className="chapter-head">
        <p className="eyebrow">{mantra.category ?? 'Mantra'}{mantra.deity ? ` · ${mantra.deity.name}` : ''}</p>
        <h1>{mantra.name}</h1>
        {mantra.description && <p className="muted">{mantra.description}</p>}
        <ShareButton content={{ kind: 'MANTRA', targetId: mantra.slug, title: mantra.name, sanskrit: mantra.text, transliteration: null, meaning: mantra.meaning ?? mantra.description ?? null }} />
      </header>
      <Counter mantra={mantra} />
      {mantra.purport && (
        <section className="mantra-purport">
          <h2>About this mantra</h2>
          {mantra.purport.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}
        </section>
      )}
    </div>
  );
}
