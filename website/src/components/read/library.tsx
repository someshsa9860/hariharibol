'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BookCard } from '@/components/home/book-card';
import { Icon } from '@/components/ui/icon';
import { EmptyState } from '@/components/ui/states';
import { chapterHref } from '@/lib/links';
import { readResume, type ResumePoint } from '@/lib/resume';
import type { Book } from '@/lib/types';

const FILTERS: { value: Book['type'] | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'SCRIPTURE', label: 'Scriptures' },
  { value: 'STOTRA', label: 'Stotras' },
  { value: 'AARTI', label: 'Aartis' },
  { value: 'PRAYER', label: 'Prayers' },
  { value: 'POEM', label: 'Poems' },
  { value: 'TEXT', label: 'Texts' },
];

export function Library({ books }: { books: Book[] }) {
  const [filter, setFilter] = useState<Book['type'] | 'ALL'>('ALL');
  const [resume, setResume] = useState<ResumePoint[]>([]);
  useEffect(() => setResume(readResume().slice(0, 3)), []);

  const present = useMemo(() => FILTERS.filter((f) => f.value === 'ALL' || books.some((b) => b.type === f.value)), [books]);
  const shown = filter === 'ALL' ? books : books.filter((book) => book.type === filter);

  return (
    <>
      <form action="/search" className="library-search" role="search">
        <Icon name="search" />
        <input className="input" name="q" type="search" minLength={2} placeholder="Search verses, mantras and books — try “gita karma”, “BG 2.47”, “krishna”" aria-label="Search the library" />
        <button className="btn btn-primary">Search</button>
      </form>

      {resume.length > 0 && (
        <section aria-labelledby="resume-title" className="resume-strip">
          <h2 id="resume-title">Continue reading</h2>
          <div className="h-scroll">
            {resume.map((point) => (
              <Link key={point.slug} className="resume card card-hover" href={point.chapterNumber ? chapterHref(point.slug, point.cantoNumber, point.chapterNumber, point.verseNumber) : `/read/${point.slug}#v-${point.verseNumber}`}>
                <span className="eyebrow">{point.title}</span>
                <strong>{[point.cantoNumber && `Canto ${point.cantoNumber}`, point.chapterNumber && `Chapter ${point.chapterNumber}`, `Verse ${point.verseNumber}`].filter(Boolean).join(' · ')}</strong>
                <span className="text-link">Continue <Icon name="arrow" size={16} /></span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="chip-row" role="tablist" aria-label="Kinds of book">
        {present.map((f) => (
          <button key={f.value} role="tab" className="chip" aria-selected={filter === f.value} onClick={() => setFilter(f.value)}>{f.label}</button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState title="Nothing here yet">New books are added all the time.</EmptyState>
      ) : (
        <ul className="book-grid">
          {shown.map((book) => <li key={book.id}><BookCard book={book} /></li>)}
        </ul>
      )}
    </>
  );
}
