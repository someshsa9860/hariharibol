import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { cache } from 'react';
import { ChapterReader } from '@/components/read/chapter-reader';
import { Icon } from '@/components/ui/icon';
import { serverGetOrNull } from '@/lib/api/server';
import { languagesQuery, readingLanguage } from '@/lib/prefs/server';
import { chapterSummary, chapterTitle, excerpt, pickTitle } from '@/lib/format';
import { chapterHref } from '@/lib/links';
import { SITE_URL } from '@/lib/config';
import type { Book, Section, Verse } from '@/lib/types';

interface WebBook extends Book { cantos: Section[]; chapters: Section[] }
interface ChapterData { chapter: Section; verses: Verse[] }

type Props = { params: Promise<{ slug: string; path: string[] }> };

/** /read/gita/2 → chapter 2; /read/sb/1/3 → canto 1, chapter 3. Anything else is not a page. */
function parsePath(path: string[]): { canto: number | null; chapter: number } | null {
  if (path.length < 1 || path.length > 2 || path.some((part) => !/^\d{1,4}$/.test(part))) return null;
  const numbers = path.map(Number);
  return numbers.length === 2 ? { canto: numbers[0], chapter: numbers[1] } : { canto: null, chapter: numbers[0] };
}

// `cache` (per request, plain arguments) so the metadata and the page share one fetch of each. The book stays uncached
// across requests: its answer carries signed cover and audio links, even though this page only reads the chapter list.
const loadBook = cache((slug: string, lang: string) => serverGetOrNull<WebBook>(`/api/web/content/books/${slug}`, { query: { lang }, revalidate: 0 }));
const loadChapter = cache((slug: string, canto: number | null, chapter: number, lang: string) =>
  serverGetOrNull<ChapterData>(`/api/app/books/${slug}/chapters/${chapter}`, {
    query: { canto: canto ?? undefined, languages: languagesQuery(lang) },
    revalidate: 0,
  }));

// In the reader's language like the page (a crawler has no cookie, so it still gets English).
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, path } = await params;
  const where = parsePath(path);
  if (!where) return { title: 'Chapter not found' };
  const lang = await readingLanguage();
  const chain = [lang, 'en'];
  const [book, data] = await Promise.all([loadBook(slug, lang).catch(() => null), loadChapter(slug, where.canto, where.chapter, lang).catch(() => null)]);
  if (!book || !data) return { title: 'Chapter not found' };
  const name = chapterTitle(data.chapter, chain);
  const title = `${pickTitle(book.titleI18n, chain, book.title)} ${where.canto ? `${where.canto}.` : ''}${where.chapter}${name ? ` — ${name}` : ''}`;
  const description = excerpt(chapterSummary(data.chapter, chain) || data.verses[0]?.translation?.meaning, 170) || `Read ${title} with the Sanskrit and meaning.`;
  const url = `/read/${slug}/${path.join('/')}`;
  return { title, description, alternates: { canonical: url }, openGraph: { title, description, url: `${SITE_URL}${url}` } };
}

export default async function ChapterPage({ params }: Props) {
  const { slug, path } = await params;
  const where = parsePath(path);
  if (!where) notFound();
  const lang = await readingLanguage();
  const chain = [lang, 'en'];

  const [book, data] = await Promise.all([loadBook(slug, lang), loadChapter(slug, where.canto, where.chapter, lang)]);
  if (!book || !data) notFound();

  const cantoMode = book.totalCantos > 0;
  const bookTitle = pickTitle(book.titleI18n, chain, book.title);
  const canto = cantoMode ? book.cantos.find((c) => c.number === where.canto) : null;
  const index = book.chapters.findIndex((c) => c.number === where.chapter && (c.cantoNumber ?? null) === where.canto);
  const previous = index > 0 ? book.chapters[index - 1] : null;
  const next = index >= 0 && index < book.chapters.length - 1 ? book.chapters[index + 1] : null;
  const title = chapterTitle(data.chapter, chain);
  const summary = chapterSummary(data.chapter, chain);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Read', item: `${SITE_URL}/read` },
      { '@type': 'ListItem', position: 2, name: book.title, item: `${SITE_URL}/read/${slug}` },
      { '@type': 'ListItem', position: 3, name: `Chapter ${where.chapter}`, item: `${SITE_URL}/read/${slug}/${path.join('/')}` },
    ],
  };

  return (
    <div className="page-read">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/read">Read</Link><Icon name="right" size={14} />
        <Link href={`/read/${slug}`}>{bookTitle}</Link><Icon name="right" size={14} />
        <span>{canto ? `Canto ${canto.number} · ` : ''}Chapter {where.chapter}</span>
      </nav>

      <header className="chapter-head">
        <p className="eyebrow">{bookTitle}{canto ? ` · Canto ${canto.number}` : ''} · Chapter {where.chapter}</p>
        <h1>{title || `Chapter ${where.chapter}`}</h1>
        {summary && <p className="muted">{summary}</p>}
      </header>

      <ChapterReader verses={data.verses} bookSlug={slug} bookTitle={bookTitle} cantoNumber={where.canto} chapterNumber={where.chapter} />

      <nav className="chapter-nav" aria-label="Chapters">
        {previous ? (
          <Link className="card card-hover" href={chapterHref(slug, previous.cantoNumber, previous.number)} rel="prev">
            <small><Icon name="left" size={14} /> Previous</small>
            <strong>{previous.cantoNumber ? `${previous.cantoNumber}.` : ''}{previous.number} · {chapterTitle(previous, chain)}</strong>
          </Link>
        ) : <span />}
        {next ? (
          <Link className="card card-hover next" href={chapterHref(slug, next.cantoNumber, next.number)} rel="next">
            <small>Next <Icon name="right" size={14} /></small>
            <strong>{next.cantoNumber ? `${next.cantoNumber}.` : ''}{next.number} · {chapterTitle(next, chain)}</strong>
          </Link>
        ) : <span />}
      </nav>
    </div>
  );
}
