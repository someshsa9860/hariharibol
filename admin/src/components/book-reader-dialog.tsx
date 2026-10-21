import { useEffect, useMemo, useState } from 'react';
import { Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiRequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useResource, useResourceMutation } from '@/lib/use-resource';

type Entry = { word: string | null; meaning: string };

type Translation = {
  id: string;
  languageCode: string;
  type: string;
  meaning: string;
  purport: string | null;
  transliteration: string | null;
  wordMeanings: Entry[] | null;
  isPublished: boolean;
  translator: { name: string };
};

type ReaderVerse = {
  id: string;
  verseId: string;
  verseNumber: number;
  verseNumberEnd: number | null;
  sanskrit: string | null;
  transliteration: string | null;
  wordMeanings: Entry[] | null;
  translations: Translation[];
};

type BookStructure = {
  id: string;
  title: string;
  cantos: { number: number; title: string }[];
  chapters: { id: string; number: number; cantoNumber: number | null; title: string }[];
};

type Target = { path: string; field: string };

const wordsToText = (list: Entry[] | null) => (list ?? []).map((w) => (w.word ? `${w.word} = ${w.meaning}` : w.meaning)).join('\n');

function textToWords(text: string): Entry[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const i = line.indexOf('=');
      return i < 0 ? { word: null, meaning: line } : { word: line.slice(0, i).trim() || null, meaning: line.slice(i + 1).trim() };
    });
}

const label = 'mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground';

/**
 * One piece of verse text. Everyone sees it; only a book auditor (`book.audit`) gets the pencil.
 * `words` edits a word-for-word list as "word = meaning" lines.
 */
function Field({
  title,
  value,
  canEdit,
  className,
  words,
  save,
}: {
  title: string;
  value: string;
  canEdit: boolean;
  className?: string;
  words?: boolean;
  save: (value: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function commit() {
    setBusy(true);
    setError('');
    try {
      await save(draft);
      setEditing(false);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  if (!value && !canEdit) return null;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        <p className={label}>{title}</p>
        {canEdit && !editing && (
          <Button variant="ghost" size="icon" className="h-6 w-6" aria-label={`Edit ${title}`} onClick={() => { setDraft(value); setEditing(true); }}>
            <Pencil className="h-3 w-3" />
          </Button>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          {words && <p className="text-xs text-muted-foreground">One word per line, as “word = meaning”.</p>}
          <Textarea rows={Math.min(14, Math.max(3, draft.split('\n').length + 1))} value={draft} onChange={(e) => setDraft(e.target.value)} />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" disabled={busy || draft === value} onClick={commit}>Save</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      ) : words ? (
        <dl className="grid gap-x-3 gap-y-0.5 text-sm sm:grid-cols-[max-content_1fr]">
          {textToWords(value).map((w, i) => (
            <div key={i} className="contents">
              <dt className="font-serif italic">{w.word}</dt>
              <dd className={w.word ? '' : 'sm:col-span-2'}>{w.meaning}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className={className}>
          {value.split(/\n{2,}/).map((p, i) => (
            <p key={i} className="whitespace-pre-line">{p}</p>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * A book read the way the website shows it — Sanskrit, transliteration, word meanings, translation,
 * purport, one chapter at a time, in the chosen language. Read-only for everyone; a book auditor
 * (`book.audit`, held by no other role, super admin included) can correct any piece in place.
 */
export function BookReaderDialog({ book, onClose }: { book: { id: string; title: string } | null; onClose: () => void }) {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('book.audit');
  const mutate = useResourceMutation('book-reader');

  const structure = useResource<BookStructure>(['book-structure', book?.id], `/api/admin/books/${book?.id}`, undefined, { enabled: !!book });
  const [chapterKey, setChapterKey] = useState('');
  const [lang, setLang] = useState('en');

  const chapters = structure.data?.chapters ?? [];
  useEffect(() => {
    if (!chapterKey && chapters.length) setChapterKey(`${chapters[0].cantoNumber ?? ''}:${chapters[0].number}`);
  }, [chapters, chapterKey]);

  const [canto, chapter] = chapterKey.split(':');
  const ready = !!book && (chapters.length === 0 ? structure.isSuccess : !!chapterKey);
  const verses = useResource<ReaderVerse[]>(
    ['book-reader', book?.id, chapterKey],
    `/api/admin/books/${book?.id}/reader`,
    chapterKey ? { ...(canto ? { canto } : {}), chapter } : undefined,
    { enabled: ready }
  );

  const languages = useMemo(() => {
    const seen = new Set<string>(['en']);
    verses.data?.forEach((v) => v.translations.forEach((t) => seen.add(t.languageCode)));
    return [...seen];
  }, [verses.data]);

  const patch = async (path: string, body: unknown) => {
    await mutate.mutateAsync({ path, method: 'patch', body });
  };

  return (
    <Dialog open={!!book} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{book?.title}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {canEdit ? 'You are a book auditor: use the pencil beside any text to correct it.' : 'Read-only. Only the book auditor role can edit the text.'}
          </p>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {chapters.length > 0 && (
            <select
              aria-label="Chapter"
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={chapterKey}
              onChange={(e) => setChapterKey(e.target.value)}
            >
              {chapters.map((c) => (
                <option key={c.id} value={`${c.cantoNumber ?? ''}:${c.number}`}>
                  {c.cantoNumber ? `${c.cantoNumber}.` : ''}{c.number} — {c.title}
                </option>
              ))}
            </select>
          )}
          <select aria-label="Language" className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={lang} onChange={(e) => setLang(e.target.value)}>
            {languages.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>

        {verses.isLoading || structure.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (verses.data ?? []).length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">No verses here.</p>
        ) : (
          <div className="space-y-6">
            {(verses.data ?? []).map((v) => {
              const t = v.translations.find((x) => x.languageCode === lang);
              // A language's own transliteration and word meanings when it has them, else the verse's.
              const ownTranslit = !!t?.transliteration;
              const ownWords = !!t?.wordMeanings?.length;
              const verseUrl = `/api/admin/verses/${v.verseId}`;
              return (
                <article key={v.id} className="rounded-lg border border-border p-4">
                  <header className="mb-3 flex items-center gap-2">
                    <Badge variant="outline" className="font-mono">{v.verseId}</Badge>
                    {t && !t.isPublished && <Badge variant="warning">Unpublished</Badge>}
                  </header>
                  <Field
                    title="Sanskrit"
                    className="font-serif text-lg leading-relaxed"
                    value={v.sanskrit ?? ''}
                    canEdit={canEdit}
                    save={(sanskrit) => patch(`${verseUrl}/content`, { sanskrit })}
                  />
                  <Field
                    title="Transliteration"
                    className="italic text-muted-foreground"
                    value={(ownTranslit ? t?.transliteration : v.transliteration) ?? ''}
                    canEdit={canEdit && (ownTranslit || !t)}
                    save={(transliteration) =>
                      ownTranslit ? patch(`${verseUrl}/translations/${t!.id}`, { transliteration }) : patch(`${verseUrl}/content`, { transliteration })
                    }
                  />
                  <Field
                    title="Word meanings"
                    words
                    value={wordsToText(ownWords ? t!.wordMeanings : v.wordMeanings)}
                    canEdit={canEdit && (ownWords || !t)}
                    save={(text) =>
                      ownWords
                        ? patch(`${verseUrl}/translations/${t!.id}`, { wordMeanings: textToWords(text) })
                        : patch(`${verseUrl}/content`, { wordMeanings: textToWords(text) })
                    }
                  />
                  {t ? (
                    <>
                      <Field
                        title={`Translation — ${t.translator.name}`}
                        className="font-medium"
                        value={t.meaning}
                        canEdit={canEdit}
                        save={(meaning) => patch(`${verseUrl}/translations/${t.id}`, { meaning })}
                      />
                      <Field
                        title="Purport"
                        className="space-y-2 text-sm leading-relaxed"
                        value={t.purport ?? ''}
                        canEdit={canEdit}
                        save={(purport) => patch(`${verseUrl}/translations/${t.id}`, { purport: purport || null })}
                      />
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No “{lang}” translation for this verse.</p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
