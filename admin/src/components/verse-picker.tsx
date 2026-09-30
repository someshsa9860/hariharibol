import { useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Link2, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select } from '@/components/ui/input';
import { SearchInput } from '@/components/search-input';
import { useResource, useResourceList } from '@/lib/use-resource';
import { useDebounced } from '@/lib/use-debounced';
import { cn } from '@/lib/utils';

// Pick a verse from any book and drop its text on the reel. The admin's own
// verse, book and translation endpoints do all the work; nothing here is
// specific to a book, so a new book appears in the picker as soon as it exists.

type Book = { id: string; title: string; bookNumber: number };
type BookDetail = {
  cantos: { id: string; number: number; title: string }[];
  chapters: { id: string; number: number; cantoNumber: number | null; title: string }[];
};

type VerseRow = {
  id: string;
  verseId: string;
  cantoNumber: number | null;
  chapterNumber: number | null;
  verseNumber: number;
  verseNumberEnd: number | null;
  sanskrit: string | null;
  book: { title: string };
};

type VerseDetail = VerseRow & {
  transliteration: string | null;
  translations: {
    id: string;
    languageCode: string;
    type: string;
    meaning: string;
    isPublished: boolean;
    translator: { name: string };
  }[];
};

export type VerseInsert = {
  verse: { id: string; verseId: string; label: string };
  /** Absent for "link only". */
  text?: string;
  kind?: 'sanskrit' | 'transliteration' | 'translation';
  /** Also record this verse as the one the reel is about. */
  link: boolean;
};

// "Bhagavad Gita 2.47" — the numbers a reader would look it up by, not the dotted id.
export function citation(verse: VerseRow) {
  const number = verse.verseNumberEnd ? `${verse.verseNumber}-${verse.verseNumberEnd}` : String(verse.verseNumber);
  const parts = [verse.cantoNumber, verse.chapterNumber, number].filter((n) => n != null);
  return `${verse.book.title} ${parts.join('.')}`;
}

export function VersePicker({
  open,
  onOpenChange,
  onInsert,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (insert: VerseInsert) => void;
}) {
  const [bookId, setBookId] = useState('');
  const [canto, setCanto] = useState('');
  const [chapter, setChapter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [link, setLink] = useState(true);
  const [added, setAdded] = useState<string[]>([]);

  const q = useDebounced(search);

  const books = useResource<Book[]>(['reel-books'], '/api/admin/books', { page: 1, pageSize: 100 }, { enabled: open });
  const book = useResource<BookDetail>(['reel-book', bookId], `/api/admin/books/${bookId}`, undefined, { enabled: open && !!bookId });
  const verses = useResourceList<VerseRow>(
    'reel-verse-picker',
    '/api/admin/verses',
    { bookId, canto, chapter, q, page, pageSize: 12 },
    { enabled: open && !!bookId }
  );
  const detail = useResource<VerseDetail>(['reel-verse', selected], `/api/admin/verses/${selected}`, undefined, {
    enabled: open && !!selected,
  });

  const cantos = book.data?.cantos ?? [];
  const chapters = (book.data?.chapters ?? []).filter((c) => !canto || c.cantoNumber === Number(canto));

  // Changing any filter starts the list from its first page again.
  const filter = (apply: () => void) => {
    apply();
    setPage(1);
    setSelected(null);
  };

  function insert(kind: NonNullable<VerseInsert['kind']> | undefined, text?: string, tag?: string) {
    const verse = detail.data;
    if (!verse) return;
    onInsert({ verse: { id: verse.id, verseId: verse.verseId, label: citation(verse) }, text, kind, link });
    setAdded((prev) => [...prev, tag ?? 'link']);
  }

  const verse = detail.data;
  // A purport is pages long and is not a caption; only the renderings of the verse itself are offered.
  const translations = verse?.translations.filter((t) => t.type !== 'COMMENTARY' && t.meaning) ?? [];
  const data = verses.data;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setAdded([]);
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Add a verse</DialogTitle>
          <DialogDescription>Choose any verse, then add its Sanskrit, transliteration or a translation as text on the reel.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 md:grid-cols-[1fr_1.1fr]">
          {/* ── find ─────────────────────────────────────────────────────── */}
          <div className="space-y-3">
            <Select
              className="w-full"
              value={bookId}
              aria-label="Book"
              onChange={(e) => filter(() => { setBookId(e.target.value); setCanto(''); setChapter(''); })}
            >
              <option value="">Choose a book…</option>
              {books.data?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </Select>

            {bookId && (cantos.length > 0 || chapters.length > 0) && (
              <div className="grid grid-cols-2 gap-2">
                {cantos.length > 0 ? (
                  <Select value={canto} aria-label="Canto" onChange={(e) => filter(() => { setCanto(e.target.value); setChapter(''); })}>
                    <option value="">All cantos</option>
                    {cantos.map((c) => (
                      <option key={c.id} value={c.number}>
                        Canto {c.number}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <span />
                )}
                <Select value={chapter} aria-label="Chapter" onChange={(e) => filter(() => setChapter(e.target.value))}>
                  <option value="">All chapters</option>
                  {chapters.map((c) => (
                    <option key={c.id} value={c.number}>
                      {c.number}. {c.title}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            {bookId && (
              <SearchInput
                value={search}
                onChange={(value) => filter(() => setSearch(value))}
                placeholder="Search Sanskrit, transliteration or number…"
              />
            )}

            {!bookId && <p className="rounded-md border border-dashed border-border px-3 py-10 text-center text-sm text-muted-foreground">Pick a book to browse its verses.</p>}
            {bookId && verses.isLoading && <Loader2 className="mx-auto my-8 h-5 w-5 animate-spin text-muted-foreground" />}
            {bookId && data && data.items.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No verses match.</p>}

            <ul className="max-h-[38vh] space-y-1 overflow-y-auto pr-1">
              {data?.items.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(row.verseId)}
                    className={cn(
                      'w-full rounded-md border px-3 py-2 text-left transition-colors',
                      selected === row.verseId ? 'border-primary bg-accent' : 'border-transparent hover:bg-muted'
                    )}
                  >
                    <span className="font-mono text-xs text-muted-foreground">{citation(row).replace(row.book.title, '').trim()}</span>
                    <span className="mt-0.5 line-clamp-2 block text-sm">{row.sanskrit ?? '—'}</span>
                  </button>
                </li>
              ))}
            </ul>

            {data && data.totalPages > 1 && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                  Prev
                </Button>
                <span>
                  Page {data.page} of {data.totalPages}
                </span>
                <Button variant="outline" size="sm" disabled={!data.hasMore} onClick={() => setPage(page + 1)}>
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* ── use ──────────────────────────────────────────────────────── */}
          <div className="max-h-[62vh] min-h-64 overflow-y-auto rounded-lg border border-border p-4">
            {!selected && <p className="py-16 text-center text-sm text-muted-foreground">Select a verse to see what can be added.</p>}
            {selected && detail.isLoading && <Loader2 className="mx-auto my-16 h-5 w-5 animate-spin text-muted-foreground" />}
            {selected && detail.isError && <p className="py-16 text-center text-sm text-destructive">Could not load this verse.</p>}

            {verse && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold">{citation(verse)}</p>
                  <p className="font-mono text-xs text-muted-foreground">{verse.verseId}</p>
                </div>

                <Source
                  label="Sanskrit"
                  text={verse.sanskrit}
                  done={added.includes('sanskrit')}
                  onAdd={() => insert('sanskrit', verse.sanskrit ?? '', 'sanskrit')}
                />
                <Source
                  label="Transliteration"
                  text={verse.transliteration}
                  done={added.includes('transliteration')}
                  onAdd={() => insert('transliteration', verse.transliteration ?? '', 'transliteration')}
                />

                {translations.map((t) => (
                  <Source
                    key={t.id}
                    label={`${t.translator.name} · ${t.languageCode.toUpperCase()}`}
                    text={t.meaning}
                    unpublished={!t.isPublished}
                    done={added.includes(t.id)}
                    onAdd={() => insert('translation', t.meaning, t.id)}
                  />
                ))}
                {translations.length === 0 && <p className="text-xs text-muted-foreground">This verse has no translations yet.</p>}

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox checked={link} onChange={(e) => setLink(e.target.checked)} />
                    Link the reel to this verse
                  </label>
                  <Button variant="outline" size="sm" onClick={() => insert(undefined)}>
                    <Link2 className="h-4 w-4" />
                    Link only
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Linking lets readers jump from the reel to the verse. The text you add is a copy — it stays as written if the verse is edited later.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{added.length > 0 && `${added.length} added to the reel`}</span>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Source({
  label,
  text,
  done,
  unpublished,
  onAdd,
}: {
  label: string;
  text: string | null;
  done: boolean;
  /** A translation that has not been published has not been reviewed either — it is shown but cannot be added. */
  unpublished?: boolean;
  onAdd: () => void;
}) {
  if (!text) return null;
  return (
    <div className="space-y-1.5 rounded-md bg-muted/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
          {unpublished && <Badge variant="warning">Unpublished</Badge>}
        </span>
        <Button variant={done ? 'ghost' : 'outline'} size="sm" className="h-7" disabled={unpublished} onClick={onAdd}>
          {done ? <Check className="h-4 w-4" /> : null}
          {done ? 'Add again' : 'Add as text'}
        </Button>
      </div>
      <p className="line-clamp-5 whitespace-pre-line text-sm leading-relaxed">{text}</p>
    </div>
  );
}
