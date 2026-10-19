import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChapterList } from '@/components/read/chapter-list';
import { ShortWorkReader } from '@/components/read/short-work';
import { Icon } from '@/components/ui/icon';
import { serverGetOrNull } from '@/lib/api/server';
import { languagesQuery, readingLanguage } from '@/lib/prefs/server';
import { chapterSummary, chapterTitle, excerpt, pickTitle, plural } from '@/lib/format';
import { SITE_URL } from '@/lib/config';
import type { Book, Section, Translator, Verse } from '@/lib/types';

interface WebBook extends Book {
  cantos: Section[];
  chapters: Section[];
  translators: (Translator & { isDefault: boolean })[];
}

type Props = { params: Promise<{ slug: string }> };

const load = (slug: string, lang: string) =>
  serverGetOrNull<WebBook>(`/api/web/content/books/${slug}`, { query: { lang }, revalidate: 300 });

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const book = await load(slug, 'en').catch(() => null);
  if (!book) return { title: 'Book not found' };
  return {
    title: book.title,
    description: excerpt(book.description) || `Read ${book.title} with the Sanskrit, transliteration and meaning.`,
    alternates: { canonical: `/read/${slug}` },
    openGraph: { title: book.title, url: `${SITE_URL}/read/${slug}`, images: book.coverImageUrl ? [book.coverImageUrl] : undefined },
  };
}

export default async function BookPage({ params }: Props) {
  const { slug } = await params;
  const lang = await readingLanguage();
  const book = await load(slug, lang);
  if (!book) notFound();
  const chain = [lang, 'en'];
  const title = pickTitle(book.titleI18n, chain, book.title);
  const description = pickTitle(book.descriptionI18n, chain, book.description);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Book',
    name: book.title,
    inLanguage: book.sourceLanguage ?? 'sa',
    url: `${SITE_URL}/read/${slug}`,
    description: excerpt(book.description, 300),
    numberOfPages: book.totalVerses,
  };

  // A short work (a stotra, an aarti) has no chapters: its verses are the page.
  if (book.totalChapters === 0) {
    const verses = await serverGetOrNull<Verse[]>(`/api/app/books/${slug}/verses`, {
      query: { languages: languagesQuery(lang) },
      revalidate: 300,
    });
    return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <ShortWorkReader book={{ slug, title, description }} verses={verses ?? []} />
      </>
    );
  }

  const cantoMode = book.totalCantos > 0;
  const first = book.chapters[0];

  return (
    <div className="page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/read">Read</Link>
        <Icon name="right" size={14} />
        <span>{title}</span>
      </nav>

      <header className="book-hero">
        <div>
          <p className="eyebrow">{book.type === 'SCRIPTURE' ? 'Scripture' : book.type.charAt(0) + book.type.slice(1).toLowerCase()}</p>
          <h1>{title}</h1>
          {description && <p className="book-desc">{description}</p>}
          <p className="muted book-meta">
            {[cantoMode && plural(book.totalCantos, 'canto'), plural(book.totalChapters, 'chapter'), plural(book.totalVerses, 'verse')]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {first && (
            <Link className="btn btn-primary btn-lg" href={`/read/${slug}/${cantoMode ? `${first.cantoNumber}/` : ''}${first.number}`}>
              Begin reading <Icon name="arrow" size={18} />
            </Link>
          )}
        </div>
      </header>

      {cantoMode ? (
        <div className="canto-list">
          {book.cantos.map((canto) => {
            const inCanto = book.chapters.filter((chapter) => chapter.cantoNumber === canto.number);
            return (
              <details key={canto.id} className="canto" open={book.cantos.length === 1}>
                <summary>
                  <span className="chapter-no">{canto.number}</span>
                  <span className="chapter-text">
                    <strong>{chapterTitle(canto, chain) || `Canto ${canto.number}`}</strong>
                    {chapterSummary(canto, chain) && <small>{chapterSummary(canto, chain)}</small>}
                  </span>
                  <span className="chapter-count">{plural(inCanto.length, 'chapter')}</span>
                  <Icon name="down" className="faq-icon" />
                </summary>
                <ChapterList slug={slug} chapters={inCanto} chain={chain} cantoNumber={canto.number} />
              </details>
            );
          })}
        </div>
      ) : (
        <ChapterList slug={slug} chapters={book.chapters} chain={chain} />
      )}
    </div>
  );
}
