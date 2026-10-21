import type { Metadata } from 'next';
import { Sources } from '@/components/about/sources';

export const metadata: Metadata = {
  title: 'Sources & disclaimer',
  description: 'Where the texts on HariHariBol come from, how the other languages are prepared, and whom to write to about rights or a mistake.',
  alternates: { canonical: '/sources' },
};

export default function SourcesPage() {
  return (
    <div className="page-narrow">
      <header className="page-title">
        <p className="eyebrow">About</p>
        <h1>Sources &amp; disclaimer</h1>
        <p>
          HariHariBol offers the sacred texts for daily reading and chanting. We are grateful to the ācāryas,
          translators and scholars whose work makes this possible. This page sets out where the texts come from and how
          they are presented.
        </p>
      </header>
      <Sources />
    </div>
  );
}
