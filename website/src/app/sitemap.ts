import type { MetadataRoute } from 'next';
import { serverGet } from '@/lib/api/server';
import { SITE_URL } from '@/lib/config';

// The library has about 19,000 verses; a sitemap holds 50,000 URLs, but smaller files are kinder to crawlers.
const VERSES_PER_FILE = 5000;

interface Listing {
  books: { slug: string; updatedAt: string }[];
  verses: { verseId: string; updatedAt: string }[];
  mantras: { slug: string; updatedAt: string }[];
}
interface BookIndex { chapters: { number: number; cantoNumber: number | null }[]; totalChapters: number }

const load = () => serverGet<Listing>('/api/web/content/sitemap', { revalidate: 3600 }).catch(() => null);

export async function generateSitemaps() {
  const listing = await load();
  const files = Math.max(1, Math.ceil((listing?.verses.length ?? 0) / VERSES_PER_FILE));
  return Array.from({ length: files + 1 }, (_, id) => ({ id }));
}

export default async function sitemap(props: { id: Promise<string> | string }): Promise<MetadataRoute.Sitemap> {
  const id = Number(await props.id);
  const listing = await load();
  if (!listing) return [];

  // File 0: the pages, the books, their chapters and the mantras. Files 1…n: the verses.
  if (id === 0) {
    const pages = ['', '/read', '/jap', '/reels', '/sakha', '/routine', '/calendar', '/plans', '/feel', '/sources'].map((path) => ({
      url: `${SITE_URL}${path}`,
      changeFrequency: 'weekly' as const,
      priority: path === '' ? 1 : 0.8,
    }));
    const books = listing.books.map((book) => ({ url: `${SITE_URL}/read/${book.slug}`, lastModified: book.updatedAt, changeFrequency: 'monthly' as const, priority: 0.8 }));
    const chapters = (await Promise.all(
      listing.books.map(async (book) => {
        const detail = await serverGet<BookIndex>(`/api/web/content/books/${book.slug}`, { revalidate: 3600 }).catch(() => null);
        return (detail?.chapters ?? []).map((c) => ({
          url: `${SITE_URL}/read/${book.slug}/${c.cantoNumber ? `${c.cantoNumber}/` : ''}${c.number}`,
          changeFrequency: 'monthly' as const,
          priority: 0.7,
        }));
      }),
    )).flat();
    const mantras = listing.mantras.map((m) => ({ url: `${SITE_URL}/jap/${m.slug}`, lastModified: m.updatedAt, changeFrequency: 'monthly' as const, priority: 0.7 }));
    return [...pages, ...books, ...chapters, ...mantras];
  }

  return listing.verses.slice((id - 1) * VERSES_PER_FILE, id * VERSES_PER_FILE).map((verse) => ({
    url: `${SITE_URL}/verse/${verse.verseId}`,
    lastModified: verse.updatedAt,
    changeFrequency: 'yearly' as const,
    priority: 0.5,
  }));
}
