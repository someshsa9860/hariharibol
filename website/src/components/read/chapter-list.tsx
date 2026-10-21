import Link from 'next/link';
import { chapterSummary, chapterTitle, plural } from '@/lib/format';
import { chapterHref } from '@/lib/links';
import type { Section } from '@/lib/types';

export function ChapterList({ slug, chapters, chain, cantoNumber }: { slug: string; chapters: Section[]; chain: string[]; cantoNumber?: number | null }) {
  return (
    <ol className="chapter-list">
      {chapters.map((chapter) => {
        const summary = chapterSummary(chapter, chain);
        return (
          <li key={chapter.id}>
            <Link href={chapterHref(slug, cantoNumber ?? chapter.cantoNumber, chapter.number)} className="chapter-row card-hover">
              <span className="chapter-no">{chapter.number}</span>
              <span className="chapter-text">
                <strong>{chapterTitle(chapter, chain) || `Chapter ${chapter.number}`}</strong>
                {summary && <small>{summary}</small>}
              </span>
              <span className="chapter-count">{plural(chapter.totalVerses, 'verse')}</span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
