'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/icon';
import { Spinner, EmptyState } from '@/components/ui/states';
import { BookCard } from '@/components/home/book-card';
import { MantraCard } from '@/components/home/mantra-card';
import { api, describeError } from '@/lib/api/client';
import { usePrefs } from '@/lib/prefs/prefs-provider';
import { ShareButton, verseTarget } from '@/components/share/share-button';
import { verseCitation } from '@/lib/format';
import { verseHref } from '@/lib/links';
import type { Book, Mantra, Verse } from '@/lib/types';

type VerseHit = Verse & { searchMatch?: { field: string; snippet: string } };
interface Overview {
  query: string;
  corrected: string | null;
  verses: VerseHit[];
  verseTotal: number;
  mantras: Mantra[];
  mantraTotal: number;
  books: Book[];
  bookTotal: number;
  total: number;
}

/** The API marks the matched words as [brackets]; show them highlighted, never as HTML. */
function Highlighted({ text }: { text: string }) {
  return <>{text.split(/(\[[^\]]+\])/).map((part, i) => (part.startsWith('[') && part.endsWith(']') ? <mark key={i}>{part.slice(1, -1)}</mark> : part))}</>;
}

export function SearchView({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const { readingLanguage } = usePrefs();
  const [text, setText] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) { setData(null); return; }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    api<Overview>('/search', { query: { q: term }, signal: controller.signal })
      .then(setData)
      .catch((failure) => { if (!(failure instanceof DOMException)) setError(describeError(failure)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, readingLanguage]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setQuery(text);
    router.replace(text.trim() ? `/search?q=${encodeURIComponent(text.trim())}` : '/search');
  };

  return (
    <div className="page-narrow search-page">
      <header className="page-title"><h1>Search</h1></header>
      <form className="search-box" role="search" onSubmit={submit}>
        <Icon name="search" />
        <input className="input" type="search" autoFocus value={text} onChange={(event) => setText(event.target.value)} placeholder="A word, a verse like “BG 2.47”, a mantra…" aria-label="Search" />
        <button className="btn btn-primary">Search</button>
      </form>

      {loading && <div className="center-state"><Spinner /></div>}
      {error && <div className="notice notice-error" role="alert">{error}</div>}
      {!loading && !error && query.trim().length >= 2 && data && data.total === 0 && (
        <EmptyState title="Nothing found" motif="conch">Try fewer words, or another spelling — “krishna” and “kṛṣṇa” find the same verses.</EmptyState>
      )}
      {!loading && data && data.total > 0 && (
        <>
          {data.corrected && <p className="corrected">Showing results for <strong>{data.corrected}</strong></p>}
          {data.verses.length > 0 && (
            <section className="result-group" aria-label="Verses">
              <h2>Verses <span className="badge">{data.verseTotal}</span></h2>
              {data.verses.map((verse) => (
                <div key={verse.id} className="has-share">
                  <Link href={verseHref(verse.verseId)} className="result card card-hover">
                    <strong>{verseCitation(verse)}</strong>
                    {verse.sanskrit && <span className="deva" lang="sa">{verse.sanskrit.split('\n')[0]}</span>}
                    <span className="snippet">{verse.searchMatch?.snippet ? <Highlighted text={verse.searchMatch.snippet} /> : verse.translation?.meaning}</span>
                  </Link>
                  <span className="share-corner"><ShareButton target={verseTarget(verse)} ariaLabel={`Share ${verseCitation(verse)}`} /></span>
                </div>
              ))}
            </section>
          )}
          {data.mantras.length > 0 && (
            <section className="result-group" aria-label="Mantras">
              <h2>Mantras <span className="badge">{data.mantraTotal}</span></h2>
              <div className="h-scroll">{data.mantras.map((mantra) => <MantraCard key={mantra.id} mantra={mantra} />)}</div>
            </section>
          )}
          {data.books.length > 0 && (
            <section className="result-group" aria-label="Books">
              <h2>Books <span className="badge">{data.bookTotal}</span></h2>
              <div className="h-scroll">{data.books.map((book) => <BookCard key={book.id} book={book} />)}</div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
