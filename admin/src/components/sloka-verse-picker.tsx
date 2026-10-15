import { useId, useState } from 'react';
import { Label, Select } from '@/components/ui/input';

// What `GET /api/admin/slokas/picker` sends: only verses that can be the daily
// sloka, so everything listed here will be accepted on save.
export type PickerVerse = { verseId: string; verseNumber: number; verseNumberEnd: number | null; sanskrit: string | null };
export type PickerChapter = { number: number; cantoNumber: number | null; title: string; verses: PickerVerse[] };
export type PickerBook = {
  bookNumber: number;
  title: string;
  cantos: { number: number; title: string }[]; // empty for the Gita
  chapters: PickerChapter[];
};
export type SlokaPickerData = { books: PickerBook[] };

const verseLabel = (v: PickerVerse) => `Verse ${v.verseNumber}${v.verseNumberEnd ? `–${v.verseNumberEnd}` : ''}`;

/** Where a verse sits in the tree, so editing a day opens with every step already chosen. */
function locate(books: PickerBook[], verseId: string) {
  if (!verseId) return null;
  for (const book of books) {
    const chapter = book.chapters.find((c) => c.verses.some((v) => v.verseId === verseId));
    if (chapter) return { book, chapter };
  }
  return null;
}

/** Whether the pool still holds this verse — a day's verse can be taken out of it after it was set. */
export const inPool = (books: PickerBook[], verseId: string) => locate(books, verseId) !== null;

/**
 * Book → canto (the Bhagavatam only) → chapter → verse. `value` is the chosen
 * verse id, or '' while nothing is chosen. Each step below a changed one is
 * cleared, so the verse can never belong to a chapter that is no longer shown.
 */
export function SlokaVerseSelect({ books, value, onChange }: { books: PickerBook[]; value: string; onChange: (verseId: string) => void }) {
  const id = useId();
  const [start] = useState(() => locate(books, value));
  const [bookNumber, setBookNumber] = useState(start ? String(start.book.bookNumber) : '');
  const [canto, setCanto] = useState(start?.chapter.cantoNumber != null ? String(start.chapter.cantoNumber) : '');
  const [chapter, setChapter] = useState(start ? String(start.chapter.number) : '');

  const book = books.find((b) => String(b.bookNumber) === bookNumber);
  const hasCantos = (book?.cantos.length ?? 0) > 0;
  const chapters = book && (!hasCantos || canto) ? book.chapters.filter((c) => !hasCantos || String(c.cantoNumber) === canto) : [];
  const chapterRow = chapters.find((c) => String(c.number) === chapter);
  const verse = chapterRow?.verses.find((v) => v.verseId === value);

  if (books.length === 0) {
    return <p className="text-sm text-muted-foreground">No verses are marked sloka-eligible yet. Mark some on the Verses page first.</p>;
  }

  return (
    <div className="space-y-3">
      {value && !inPool(books, value) && (
        <p role="status" className="text-sm text-amber-800 dark:text-amber-300">
          Verse {value} is no longer in the sloka pool. Choose another.
        </p>
      )}

      <div>
        <Label htmlFor={`${id}-book`}>Book</Label>
        <Select
          id={`${id}-book`}
          className="mt-1 w-full"
          value={bookNumber}
          onChange={(e) => {
            setBookNumber(e.target.value);
            setCanto('');
            setChapter('');
            onChange('');
          }}
        >
          <option value="">Choose a book…</option>
          {books.map((b) => (
            <option key={b.bookNumber} value={b.bookNumber}>
              {b.title}
            </option>
          ))}
        </Select>
      </div>

      {hasCantos && (
        <div>
          <Label htmlFor={`${id}-canto`}>Canto</Label>
          <Select
            id={`${id}-canto`}
            className="mt-1 w-full"
            value={canto}
            onChange={(e) => {
              setCanto(e.target.value);
              setChapter('');
              onChange('');
            }}
          >
            <option value="">Choose a canto…</option>
            {book!.cantos.map((c) => (
              <option key={c.number} value={c.number}>
                Canto {c.number}
                {c.title && ` — ${c.title}`}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div>
        <Label htmlFor={`${id}-chapter`}>Chapter</Label>
        <Select
          id={`${id}-chapter`}
          className="mt-1 w-full"
          disabled={!book || (hasCantos && !canto)}
          value={chapter}
          onChange={(e) => {
            setChapter(e.target.value);
            onChange('');
          }}
        >
          <option value="">Choose a chapter…</option>
          {chapters.map((c) => (
            <option key={`${c.cantoNumber}-${c.number}`} value={c.number}>
              Chapter {c.number}
              {c.title && ` — ${c.title}`} ({c.verses.length})
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor={`${id}-verse`}>Verse</Label>
        <Select id={`${id}-verse`} className="mt-1 w-full" disabled={!chapterRow} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Choose a verse…</option>
          {chapterRow?.verses.map((v) => (
            <option key={v.verseId} value={v.verseId}>
              {verseLabel(v)}
            </option>
          ))}
        </Select>
        <p className="mt-1 text-xs text-muted-foreground">Only verses in the sloka pool are listed; the number in brackets is how many each chapter has.</p>
      </div>

      {verse?.sanskrit && <p className="line-clamp-4 rounded-md border bg-muted/40 p-3 font-serif text-sm">{verse.sanskrit}</p>}
    </div>
  );
}
