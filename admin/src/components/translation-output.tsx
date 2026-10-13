// Reading what Claude wrote: pick a language and chapter, pick a verse, and see Prabhupāda's English
// next to the translation — transliteration, translation, word meanings, purport — with how it scored
// and why. While a run is working on this language the list fills in by itself and "Follow" jumps to
// each verse as it is saved.

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Radio, ShieldCheck, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useChapter, useVerse, type ChapterIndex, type Coverage, type Overview, type Run, type VerseOutput } from '@/lib/translation';
import { cn, formatDate } from '@/lib/utils';
import { ProgressBar, ScoreBadge, ScoreDot, formatCount } from './translation-bits';
import { chapterOf } from './translation-run-panel';

export type OutputSelection = { language: string | null; chapter: number | null; verseId: string | null };

type Filter = 'all' | 'retry' | 'warnings' | 'missing';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'retry', label: 'Score 1' },
  { value: 'warnings', label: 'Warnings' },
  { value: 'missing', label: 'Not yet' },
];

const PART_LABEL: Record<string, string> = {
  translation: 'Translation',
  transliteration: 'Transliteration',
  wordMeanings: 'Word meanings',
  purport: 'Purport',
};

const VIEW_KEY = 'hhb_admin_translation_view';

function useViewMode() {
  const [mode, setMode] = useState<'both' | 'translated'>(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === 'translated' ? 'translated' : 'both';
    } catch {
      return 'both';
    }
  });
  const change = (next: 'both' | 'translated') => {
    setMode(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // A private window may refuse storage; the choice then lasts until the page is closed.
    }
  };
  return [mode, change] as const;
}

export function TranslationOutput({
  overview,
  coverage,
  selection,
  onSelect,
  liveRun,
}: {
  overview: Overview;
  coverage: Coverage | undefined;
  selection: OutputSelection;
  onSelect: (next: Partial<OutputSelection>) => void;
  liveRun: Run | undefined;
}) {
  const { languages, chapters } = overview;
  const savedBy = useMemo(() => new Map(coverage?.languages.map((item) => [item.code, item])), [coverage]);

  const language = selection.language ?? languages.find((item) => (savedBy.get(item.code)?.saved ?? 0) > 0)?.code ?? languages[0]?.code ?? null;
  const languageCoverage = language ? savedBy.get(language) : undefined;
  const chapter = selection.chapter ?? languageCoverage?.chapters.find((item) => item.saved > 0)?.chapter ?? 1;

  const live = !!liveRun && liveRun.language === language && liveRun.status === 'RUNNING';
  const index = useChapter(language, chapter, live);
  const [follow, setFollow] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  const firstSaved = index.data?.verses.find((verse) => verse.saved)?.verseId ?? null;
  const verseId = selection.verseId && chapterOf(selection.verseId) === chapter ? selection.verseId : firstSaved;

  // Follow: stay on whatever the run is working on — its chapter, then the newest verse it saved.
  const liveChapter = live && liveRun?.progress.currentVerseId ? chapterOf(liveRun.progress.currentVerseId) : null;
  useEffect(() => {
    if (follow && liveChapter && liveChapter !== chapter) onSelect({ chapter: liveChapter, verseId: null });
    // Only a change in what the run is on should move the view.
  }, [follow, liveChapter]);

  const newest = useMemo(() => {
    const saved = index.data?.verses.filter((verse) => verse.saved && verse.generatedAt) ?? [];
    return saved.sort((a, b) => (b.generatedAt ?? '').localeCompare(a.generatedAt ?? ''))[0]?.verseId ?? null;
  }, [index.data]);
  useEffect(() => {
    if (follow && newest && index.data?.chapter === chapter) onSelect({ verseId: newest });
  }, [follow, newest]);

  useEffect(() => {
    if (!live) setFollow(false);
  }, [live]);

  const pickVerse = (next: string) => {
    setFollow(false);
    onSelect({ verseId: next });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border bg-card p-4">
        <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0" role="tablist" aria-label="Language">
          {languages.map((item) => {
            const saved = savedBy.get(item.code)?.saved ?? 0;
            const selected = item.code === language;
            return (
              <button
                key={item.code}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => onSelect({ language: item.code, chapter: null, verseId: null })}
                className={cn(
                  'group flex shrink-0 items-baseline gap-2 whitespace-nowrap rounded-lg border px-3 py-1.5 text-left transition-colors',
                  selected ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-accent',
                  saved === 0 && !selected && 'text-muted-foreground'
                )}
              >
                <span className="text-sm font-medium">{item.name}</span>
                <span className="text-sm opacity-80" lang={item.code}>
                  {item.endonym}
                </span>
                <span className={cn('rounded-full px-1.5 text-[11px] tabular-nums', selected ? 'bg-primary-foreground/20' : 'bg-muted')}>{formatCount(saved)}</span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-9 gap-1.5 sm:grid-cols-[repeat(18,minmax(0,1fr))]" role="tablist" aria-label="Chapter">
          {chapters.map((number) => {
            const item = languageCoverage?.chapters.find((c) => c.chapter === number);
            const fraction = item && item.total ? item.saved / item.total : 0;
            const selected = number === chapter;
            return (
              <button
                key={number}
                type="button"
                role="tab"
                aria-selected={selected}
                title={item ? `Chapter ${number} · ${item.saved} of ${item.total} verses` : `Chapter ${number}`}
                onClick={() => onSelect({ chapter: number, verseId: null })}
                className={cn(
                  'relative h-9 overflow-hidden rounded-md border text-xs font-semibold tabular-nums transition-colors',
                  selected ? 'border-primary ring-2 ring-primary/30' : 'hover:bg-accent'
                )}
              >
                <span aria-hidden className={cn('absolute inset-x-0 bottom-0', fraction >= 1 ? 'bg-success/35' : 'bg-primary/20')} style={{ height: `${fraction * 100}%` }} />
                <span className="relative">{number}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[19rem_minmax(0,1fr)]">
        <VerseList
          index={index.data}
          loading={index.isLoading}
          error={index.isError}
          selected={verseId}
          onPick={pickVerse}
          filter={filter}
          onFilter={setFilter}
          live={live}
          follow={follow}
          onFollow={() => setFollow((on) => !on)}
        />
        <VerseReader language={language} languageName={languages.find((item) => item.code === language)?.name ?? ''} endonym={languages.find((item) => item.code === language)?.endonym ?? ''} verseId={verseId} onPick={pickVerse} chapterEmpty={index.data ? index.data.saved === 0 : false} />
      </div>
    </div>
  );
}

// ── The list of verses in the chapter ────────────────────────────────────────────────────────────────

function VerseList({
  index,
  loading,
  error,
  selected,
  onPick,
  filter,
  onFilter,
  live,
  follow,
  onFollow,
}: {
  index: ChapterIndex | undefined;
  loading: boolean;
  error: boolean;
  selected: string | null;
  onPick: (verseId: string) => void;
  filter: Filter;
  onFilter: (filter: Filter) => void;
  live: boolean;
  follow: boolean;
  onFollow: () => void;
}) {
  const selectedRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const verses = (index?.verses ?? []).filter((verse) => {
    if (filter === 'retry') return verse.correctness === 1;
    if (filter === 'warnings') return verse.warnings > 0;
    if (filter === 'missing') return !verse.saved;
    return true;
  });

  return (
    <section className="overflow-hidden rounded-xl border bg-card lg:sticky lg:top-4">
      <header className="space-y-2 border-b p-4">
        {index ? (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Chapter {index.chapter}</p>
                <p className="truncate font-semibold" title={index.titleEn ?? undefined}>
                  {index.title || index.titleEn || '—'}
                </p>
                {index.title && index.titleEn && index.title !== index.titleEn && <p className="truncate text-xs text-muted-foreground">{index.titleEn}</p>}
              </div>
              {live && (
                <Button size="sm" variant={follow ? 'default' : 'outline'} onClick={onFollow} title="Jump to each verse as it is saved">
                  <Radio className={cn(follow && 'animate-pulse')} /> Follow
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <ProgressBar percent={index.total ? (index.saved / index.total) * 100 : 0} tone={index.saved >= index.total ? 'success' : 'primary'} className="h-1.5" />
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {index.saved}/{index.total}
              </span>
            </div>
          </>
        ) : (
          <Skeleton className="h-14 w-full" />
        )}
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => onFilter(item.value)}
              className={cn('rounded-full border px-2.5 py-0.5 text-xs transition-colors', filter === item.value ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent')}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      <div className="max-h-[32rem] overflow-y-auto lg:max-h-[calc(100vh-17rem)]">
        {loading && !index ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : error && !index ? (
          <p className="p-4 text-sm text-destructive">Could not read this chapter from storage.</p>
        ) : verses.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">{filter === 'all' ? 'No verses.' : 'Nothing matches this filter.'}</p>
        ) : (
          <ul>
            {verses.map((verse) => (
              <li key={verse.verseId}>
                <button
                  ref={verse.verseId === selected ? selectedRef : undefined}
                  type="button"
                  onClick={() => onPick(verse.verseId)}
                  aria-current={verse.verseId === selected}
                  className={cn(
                    'flex w-full gap-3 border-b border-border/60 px-4 py-2.5 text-left transition-colors last:border-0 hover:bg-accent/60',
                    verse.verseId === selected && 'bg-accent'
                  )}
                >
                  <ScoreDot score={verse.saved ? verse.correctness : null} className="mt-1.5" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-medium tabular-nums">{verse.ref}</span>
                      {verse.warnings > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[11px] text-amber-700 dark:text-amber-400" title={`${verse.warnings} warnings`}>
                          <AlertTriangle className="h-3 w-3" />
                          {verse.warnings}
                        </span>
                      )}
                      {verse.saved && !verse.byClaude && <Badge variant="outline">imported</Badge>}
                    </span>
                    <span className={cn('line-clamp-2 text-xs', verse.saved ? 'text-muted-foreground' : 'italic text-muted-foreground/60')}>
                      {verse.saved ? verse.preview || '—' : 'Not translated yet'}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// ── One verse ────────────────────────────────────────────────────────────────────────────────────────

function VerseReader({ language, languageName, endonym, verseId, onPick, chapterEmpty }: { language: string | null; languageName: string; endonym: string; verseId: string | null; onPick: (verseId: string) => void; chapterEmpty: boolean }) {
  const verse = useVerse(language, verseId);
  const [mode, setMode] = useViewMode();
  const data = verse.data;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if ((event.key === 'ArrowLeft' || event.key === 'k') && data?.previous) onPick(data.previous);
      if ((event.key === 'ArrowRight' || event.key === 'j') && data?.next) onPick(data.next);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [data, onPick]);

  if (!verseId) {
    return (
      <section className="grid min-h-64 place-items-center rounded-xl border border-dashed bg-card p-8 text-center">
        <div className="max-w-xs space-y-1">
          <Sparkles className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="font-medium">{chapterEmpty ? 'Nothing translated in this chapter yet' : 'Pick a verse'}</p>
          <p className="text-sm text-muted-foreground">
            {chapterEmpty ? 'Start a run, or choose another chapter. Verses appear here as they are saved.' : 'Choose a verse on the left to read it beside the original.'}
          </p>
        </div>
      </section>
    );
  }

  if (verse.isLoading && !data) return <Skeleton className="h-[32rem] w-full rounded-xl" />;
  if (verse.isError && !data) {
    return <section className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive">Could not read this verse from storage.</section>;
  }
  if (!data) return null;

  const translated = data.translated;
  const side = mode === 'both' && translated !== null;

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <VerseHeader data={data} mode={mode} onMode={setMode} onPick={onPick} languageName={languageName} />

      <div className="space-y-8 p-4 sm:p-6">
        {side && (
          <div className="hidden grid-cols-2 gap-6 text-xs font-medium uppercase tracking-wide text-muted-foreground lg:grid">
            <span>Prabhupāda · English</span>
            <span>
              {languageName} · <span lang={language ?? undefined}>{endonym}</span>
            </span>
          </div>
        )}

        {!translated && (
          <p className="rounded-md border border-dashed bg-muted/40 px-4 py-3 text-sm text-muted-foreground">This verse has not been translated into {languageName} yet. The English original is shown.</p>
        )}

        <Block title="Transliteration" show={data.source.transliteration.length > 0 || !!translated?.transliteration.length}>
          <Rows left={data.source.transliteration} right={translated?.transliteration} side={side} language={language} translatedOnly={mode === 'translated' && !!translated} italic />
        </Block>

        <Block title="Translation" show>
          <Rows left={[data.source.translation]} right={translated ? [translated.translation] : undefined} side={side} language={language} translatedOnly={mode === 'translated' && !!translated} emphasis />
        </Block>

        <Block title="Word meanings" show={data.source.wordMeanings.length > 0 || !!translated?.wordMeanings.length}>
          <WordMeanings source={data.source.wordMeanings} translated={translated?.wordMeanings} side={side} language={language} translatedOnly={mode === 'translated' && !!translated} />
        </Block>

        <Block title="Purport" show={data.source.purport.length > 0 || !!translated?.purport.length}>
          <Rows left={data.source.purport} right={translated?.purport} side={side} language={language} translatedOnly={mode === 'translated' && !!translated} />
        </Block>
      </div>
    </section>
  );
}

function VerseHeader({ data, mode, onMode, onPick, languageName }: { data: VerseOutput; mode: 'both' | 'translated'; onMode: (mode: 'both' | 'translated') => void; onPick: (verseId: string) => void; languageName: string }) {
  const { ai, problems } = data;
  const parts = ai?.partScores ? Object.entries(ai.partScores) : [];

  return (
    <header className="space-y-3 border-b bg-muted/30 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="outline" disabled={!data.previous} onClick={() => data.previous && onPick(data.previous)} aria-label="Previous verse" title="Previous verse (←)">
            <ChevronLeft />
          </Button>
          <Button size="icon" variant="outline" disabled={!data.next} onClick={() => data.next && onPick(data.next)} aria-label="Next verse" title="Next verse (→)">
            <ChevronRight />
          </Button>
          <h3 className="ml-2 text-lg font-semibold">
            Bhagavad-gītā <span className="tabular-nums">{data.ref}</span>
          </h3>
        </div>
        {data.translated && (
          <div className="inline-flex rounded-lg bg-muted p-1 text-xs font-medium" role="group" aria-label="Layout">
            {([['both', 'Side by side'], ['translated', `${languageName} only`]] as const).map(([value, label]) => (
              <button key={value} type="button" aria-pressed={mode === value} onClick={() => onMode(value)} className={cn('rounded-md px-3 py-1 transition-colors', mode === value ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {ai ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <ScoreBadge score={ai.correctness} />
            {problems && problems.length === 0 && (
              <Badge variant="success" className="gap-1" title="The saved text passed the structural checks again just now">
                <ShieldCheck className="h-3 w-3" /> Checks passed
              </Badge>
            )}
            {parts.map(([part, score]) => (
              <span key={part} className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs text-muted-foreground">
                <ScoreDot score={score as 1 | 2 | 3} className="h-2 w-2" />
                {PART_LABEL[part] ?? part} <b className="text-foreground">{score}</b>
              </span>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Translated by Claude · <span className="font-mono">{ai.model}</span> · version <span className="font-mono">{ai.version}</span> · {formatDate(ai.generatedAt)}
          </p>
          {ai.note && <p className="rounded-md border bg-background px-3 py-2 text-sm">{ai.note}</p>}
          {ai.warnings.length > 0 && (
            <details className="group rounded-md border border-warning/50 bg-warning/15 px-3 py-2 text-sm">
              <summary className="flex cursor-pointer list-none items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" /> {ai.warnings.length} {ai.warnings.length === 1 ? 'warning' : 'warnings'}
                <span className="text-xs font-normal text-muted-foreground group-open:hidden">show</span>
              </summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                {ai.warnings.map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            </details>
          )}
        </>
      ) : data.translated ? (
        <p className="text-xs text-muted-foreground">This translation did not come from Claude (it was imported), so it has no score.</p>
      ) : null}

      {problems && problems.length > 0 && (
        <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <p className="font-medium">The saved text fails the structural checks</p>
          <ul className="mt-1 list-disc pl-5">
            {problems.map((problem, i) => (
              <li key={i}>{problem}</li>
            ))}
          </ul>
        </div>
      )}
    </header>
  );
}

function Block({ title, show, children }: { title: string; show: boolean; children: React.ReactNode }) {
  if (!show) return null;
  return (
    <div className="space-y-3">
      <h4 className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
        <span className="h-px flex-1 bg-border" />
      </h4>
      {children}
    </div>
  );
}

/** Paragraphs, each English one beside its translation. They are paired by position, so a long one grows both. */
function Rows({ left, right, side, language, translatedOnly, italic, emphasis }: { left: string[]; right?: string[]; side: boolean; language: string | null; translatedOnly: boolean; italic?: boolean; emphasis?: boolean }) {
  const lines = translatedOnly ? (right ?? []) : left;
  const count = side ? Math.max(left.length, right?.length ?? 0) : lines.length;
  const text = cn('whitespace-pre-line break-words', italic && 'italic', emphasis ? 'text-base font-medium leading-8' : 'text-[15px] leading-7');

  if (count === 0) return <p className="text-sm text-muted-foreground">—</p>;

  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) =>
        side ? (
          <div key={i} className="grid gap-x-6 gap-y-1 lg:grid-cols-2">
            <p className={cn(text, 'text-muted-foreground')}>{left[i] ?? ''}</p>
            <p className={text} lang={language ?? undefined}>
              {right?.[i] ?? <span className="text-muted-foreground/50">—</span>}
            </p>
          </div>
        ) : (
          <p key={i} className={text} lang={translatedOnly ? (language ?? undefined) : undefined}>
            {lines[i]}
          </p>
        )
      )}
    </div>
  );
}

function WordMeanings({ source, translated, side, language, translatedOnly }: { source: { word: string; meaning: string }[]; translated?: { word: string; meaning: string }[]; side: boolean; language: string | null; translatedOnly: boolean }) {
  const rows = translatedOnly ? (translated ?? []) : source;
  const count = side ? Math.max(source.length, translated?.length ?? 0) : rows.length;
  if (count === 0) return <p className="text-sm text-muted-foreground">—</p>;

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th className="w-10 px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">Word</th>
            <th className="px-3 py-2 font-medium">Meaning</th>
            {side && (
              <>
                <th className="border-l px-3 py-2 font-medium">Word</th>
                <th className="px-3 py-2 font-medium">Meaning</th>
              </>
            )}
          </tr>
        </thead>
        <tbody className="divide-y">
          {Array.from({ length: count }).map((_, i) => {
            const own = translatedOnly ? translated?.[i] : source[i];
            const other = translated?.[i];
            const lang = translatedOnly ? (language ?? undefined) : undefined;
            return (
              <tr key={i} className="align-top">
                <td className="px-3 py-2 text-xs tabular-nums text-muted-foreground">{i + 1}</td>
                <td className={cn('px-3 py-2 font-medium italic', side && 'text-muted-foreground')} lang={lang}>
                  {own?.word}
                </td>
                <td className={cn('px-3 py-2', side && 'text-muted-foreground')} lang={lang}>
                  {own?.meaning}
                </td>
                {side && (
                  <>
                    <td className="border-l px-3 py-2 font-medium italic" lang={language ?? undefined}>
                      {other?.word}
                    </td>
                    <td className="px-3 py-2" lang={language ?? undefined}>
                      {other?.meaning ?? <span className="text-muted-foreground/50">—</span>}
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
