// Everything the Translations page asks of the API (backend/routes/admin/translation.js) and how it
// stays current.
//
// The database row is the truth and the page can be refreshed or closed at any time: every view here
// is a query, nothing lives only in component state. The websocket only makes the queries current
// sooner — `useTranslationLive` patches the cache from each event, refetches everything when the
// socket comes back, and the polling intervals below cover a socket that is not there at all.

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api } from './api';
import { useOnReconnect, useSocketEvent, useSocketStatus, type SocketStatus } from './socket';

export type RunStatus = 'QUEUED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type PauseReason = 'credit' | 'auth' | 'config' | 'storage' | 'unavailable' | 'rate_limit' | 'busy' | 'error' | 'budget';

export const ACTIVE: RunStatus[] = ['QUEUED', 'RUNNING', 'PAUSED'];

export type BookId = 'bhagavat-gita' | 'srimad-bhagavatam';
export const DEFAULT_BOOK: BookId = 'bhagavat-gita';
export type BookInfo = { id: BookId; title: string; chapters: { id: number; label: string }[] };

export function isBook(value: string | null): value is BookId {
  return value === 'bhagavat-gita' || value === 'srimad-bhagavatam';
}

/** A chapter id as a reader names it: 47 in the Gita is "47"; 147 in the Bhagavatam is canto 1, chapter 47, "1.47". */
export function chapterName(book: BookId, id: number) {
  return book === 'srimad-bhagavatam' ? `${Math.floor(id / 100)}.${id % 100}` : String(id);
}

/** The canto a Bhagavatam chapter id belongs to; the Gita has none. */
export const cantoOf = (id: number) => Math.floor(id / 100);

export type PartName = 'translation' | 'transliteration' | 'wordMeanings' | 'purport';
export const PART_NAMES: PartName[] = ['translation', 'transliteration', 'wordMeanings', 'purport'];
export const PART_LABELS: Record<PartName, string> = { translation: 'Translation', transliteration: 'Transliteration', wordMeanings: 'Word meanings', purport: 'Purport' };
export type PlanEntry = { provider: string; model: string; effort: string };
/** Which provider, model and effort writes each part. A part left out is not touched by the run. */
export type Plan = Partial<Record<PartName, PlanEntry>>;
/** Parts that share a provider, model and effort: one request per verse, run in parallel with the other lanes. */
export type Lane = { key: string; provider: string; model: string; effort: string; parts: PartName[]; done?: number; total?: number; calls?: number; costMicros?: number };
export const providerName = (id: string) => (id === 'openai' ? 'OpenAI' : id === 'gemini' ? 'Gemini' : 'Claude');

export type ProviderInfo = { id: 'anthropic' | 'openai' | 'gemini'; label: string; company: string; keyEnv: string; apiKeyConfigured: boolean; defaultModel: string };

export type Run = {
  id: string;
  book: BookId;
  provider: ProviderInfo['id'];
  language: string;
  languageName: string;
  endonym: string;
  version: string;
  model: string;
  status: RunStatus;
  pauseReason: PauseReason | null;
  statusMessage: string | null;
  stopReason: string | null;
  errorVerseId: string | null;
  resumeAt: string | null;
  cancelRequested: boolean;
  chapters: number[];
  verseLimit: number | null;
  budgetUsd: number | null;
  progress: { total: number; done: number; percent: number; currentVerseId: string | null; etaSeconds: number | null; secondsPerVerse: number | null };
  scores: { 1: number; 2: number; 3: number };
  usage: { inputTokens: number; outputTokens: number; calls: number; costUsd: number };
  attempts: number;
  requestedBy: { id: string; name: string } | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  heartbeatAt: string | null;
  stalled: boolean;
  plan: Plan | null;
  lanes: Lane[] | null;
};

export type FeedLine = { at: string; kind: string; level: 'info' | 'warn' | 'success' | 'error'; text: string; verseId?: string };
export type ActivityEvent = FeedLine & { runId: string };

export type Overview = {
  settings: {
    apiKeyConfigured: boolean;
    providers: ProviderInfo[];
    defaultProvider: ProviderInfo['id'];
    storage: { ok: boolean; describe?: string; error?: string };
    workerOnline: boolean;
    model: string;
    version: string | null;
    versionError: string | null;
    effort: string;
  };
  languages: { code: string; name: string; endonym: string }[];
  chapters: number[];
  books: BookInfo[];
  active: Run[];
  /** Imports into the database that are queued or running, oldest first. */
  activeImports: ImportRun[];
};

export type Score = 1 | 2 | 3;
export type Coverage = {
  book: BookId;
  generatedAt: string | null;
  /** A fill from storage is running in the background; the counts grow as chapters are done. */
  recounting?: boolean;
  recount?: { done: number; total: number } | null;
  /** The version a new run would translate under. Null only when TRANSLATION_VERSION is malformed. */
  version: string | null;
  total: number;
  languages: {
    code: string;
    saved: number;
    /** Verses already translated under `version`, or by a person: a new run leaves these alone. */
    upToDate: number;
    byClaude: number;
    scores: { 1: number; 2: number; 3: number; unscored: number };
    versions: Record<string, number>;
    parts?: Record<string, number>;
    chapters: { chapter: number; total: number; saved: number; upToDate: number }[];
  }[];
};

export type Estimate = {
  language: string;
  book: BookId;
  provider: ProviderInfo['id'];
  chapters: number[];
  model: string;
  version: string | null;
  verses: number;
  saved: number;
  /** Of `saved`, made by Claude under another version: a run translates these again. */
  outdated: number;
  todo: number;
  willTranslate: number;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  /** Null when the chosen model has no known price: tokens are shown, cost is not. */
  costUsd: number | null;
  plan?: Plan;
  steps?: number;
  lanes?: (Lane & { todo: number; willTranslate: number; calls: number; inputTokens: number; outputTokens: number; costUsd: number | null })[];
};

export type ChapterIndex = {
  language: string;
  book: BookId;
  chapter: number;
  chapterLabel: string;
  title: string | null;
  titleEn: string | null;
  total: number;
  saved: number;
  verses: {
    verseId: string;
    ref: string;
    saved: boolean;
    byClaude: boolean;
    correctness: Score | null;
    warnings: number;
    parts?: Record<string, number> | null;
    version: string | null;
    generatedAt: string | null;
    preview: string | null;
  }[];
};

type Parts = { translation: string; purport: string[]; transliteration: string[]; wordMeanings: { word: string; meaning: string }[] };

export type VerseOutput = {
  verseId: string;
  book: BookId;
  ref: string;
  chapter: number;
  language: string;
  previous: string | null;
  next: string | null;
  source: Parts;
  translated: Parts | null;
  ai: {
    version: string;
    provider?: string;
    model: string;
    effort: string;
    generatedAt: string;
    correctness: Score | null;
    partScores: Record<string, number> | null;
    parts?: Record<string, { provider: string; model: string; effort: string; version: string; generatedAt: string; correctness: Score | null }> | null;
    note: string | null;
    warnings: string[];
  } | null;
  problems: string[] | null;
};

export type RunPage = { items: Run[]; page: number; pageSize: number; total: number; totalPages: number };

/** What Claude's runs have put in the database so far (GET /imports), one entry per language that has any. */
export type ImportStatus = {
  version: string | null;
  book: BookId;
  languages: { code: string; rows: number; current: number; published: number; versions: Record<string, number>; updatedAt: string | null }[];
};

/** One chapter of an import, or of its preview. `found: false` means storage has no file for it. */
export type ImportChapter = {
  chapter: number;
  found: boolean;
  inStorage: number;
  created: number;
  updated: number;
  unchanged: number;
  replacedVisible: number;
  issueLinksCreated: number;
  issueVersesSkipped: number;
  noTranslation: number;
  missing: string[];
  conflicts: { verseId: string; reason: string }[];
  error: string | null;
};

export type ImportResult = {
  language: string;
  book?: BookId;
  publish: boolean;
  dryRun: boolean;
  totals: {
    chapters: number;
    inStorage: number;
    created: number;
    updated: number;
    unchanged: number;
    replacedVisible: number;
    issueLinksCreated: number;
    issueVersesSkipped: number;
    noTranslation: number;
    missing: number;
    conflicts: number;
    failedChapters: number;
    versions: Record<string, number>;
  };
  chapters: ImportChapter[];
};

export type ImportRunStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export const IMPORT_ACTIVE: ImportRunStatus[] = ['QUEUED', 'RUNNING'];

/** An import the worker is doing, or did: one language's chapters copied from storage into the database. */
export type ImportRun = {
  id: string;
  language: string;
  book: BookId;
  publish: boolean;
  chapters: number[];
  status: ImportRunStatus;
  statusMessage: string | null;
  cancelRequested: boolean;
  /** `currentChapter` is the last chapter finished, not the one being worked on. */
  progress: { total: number; done: number; percent: number; currentChapter: number | null };
  /** Null until the import ends. A cancelled one keeps what the chapters it finished did. */
  result: ImportResult | null;
  requestedBy: { id: string; name: string } | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  heartbeatAt: string | null;
  stalled: boolean;
};

const ROOT = '/api/admin/translations';
export const keys = {
  all: ['translation'] as const,
  overview: ['translation', 'overview'] as const,
  coverage: (book: BookId) => ['translation', 'coverage', book] as const,
  imports: (book: BookId) => ['translation', 'imports', book] as const,
  importRun: (id: string) => ['translation', 'import-run', id] as const,
  runs: ['translation', 'runs'] as const,
  run: (id: string) => ['translation', 'run', id] as const,
  chapter: (book: BookId, language: string, chapter: number) => ['translation', 'chapter', book, language, chapter] as const,
  verse: (language: string, verseId: string) => ['translation', 'verse', language, verseId] as const,
};

// A socket that is up keeps the cache current by itself, so polling only has to catch what it might have
// dropped. Without one, polling is the whole mechanism.
function pollMs(socket: SocketStatus, busy: boolean) {
  if (socket === 'live') return 30_000;
  return busy ? 4_000 : 15_000;
}

export function useOverview() {
  const socket = useSocketStatus();
  return useQuery({
    queryKey: keys.overview,
    queryFn: async () => {
      const data = (await api.get<Overview>(`${ROOT}/overview`)).data;
      return { ...data, activeImports: data.activeImports ?? [] };
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      return pollMs(socket, (data?.active.length ?? 0) + (data?.activeImports.length ?? 0) > 0);
    },
  });
}

export function useCoverage(book: BookId) {
  return useQuery({
    queryKey: keys.coverage(book),
    queryFn: async () => (await api.get<Coverage>(`${ROOT}/coverage`, { book })).data,
    staleTime: 60_000,
    refetchInterval: (query) => (query.state.data?.recounting ? 3000 : false),
  });
}

export function useImports(book: BookId) {
  return useQuery({
    queryKey: keys.imports(book),
    queryFn: async () => (await api.get<ImportStatus>(`${ROOT}/imports`, { book })).data,
    staleTime: 30_000,
  });
}

/**
 * What an import of `language` would do, worked out by the server without writing anything (the same request with
 * `dryRun`). Always read fresh: it compares storage with the database, and either can change under the page.
 */
export function useImportPreview(book: BookId, language: string | null, publish: boolean, enabled: boolean) {
  return useQuery({
    queryKey: ['translation', 'import-preview', book, language, publish],
    queryFn: async () => (await api.post<ImportResult>(`${ROOT}/imports`, { book, language, publish, dryRun: true })).data,
    enabled: enabled && !!language,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export async function refreshCoverage(queryClient: QueryClient, book: BookId) {
  const data = (await api.get<Coverage>(`${ROOT}/coverage`, { book, refresh: true })).data;
  queryClient.setQueryData(keys.coverage(book), data);
}

export function useEstimate(
  pick: { book: BookId; provider: string; model: string; plan?: Plan | null },
  language: string | null,
  chapters: number[],
  limit: number,
  enabled: boolean
) {
  return useQuery({
    queryKey: ['translation', 'estimate', pick.book, pick.provider, pick.model, JSON.stringify(pick.plan ?? null), language, chapters.join(','), limit],
    queryFn: async () =>
      (
        await api.get<Estimate>(`${ROOT}/estimate`, {
          language,
          book: pick.book,
          provider: pick.provider || undefined,
          model: pick.model || undefined,
          plan: pick.plan ? JSON.stringify(pick.plan) : undefined,
          chapters: chapters.join(','),
          limit: limit || undefined,
        })
      ).data,
    enabled: enabled && !!language && chapters.length > 0,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
}

export function useRuns(filters: { status?: string; language?: string; book?: string; page: number }) {
  const socket = useSocketStatus();
  return useQuery({
    queryKey: [...keys.runs, filters],
    queryFn: async (): Promise<RunPage> => {
      const res = await api.get<Run[]>(`${ROOT}/runs`, { ...filters, pageSize: 10 });
      const meta = (res.meta ?? {}) as Record<string, number>;
      return {
        items: res.data,
        page: meta.page ?? 1,
        pageSize: meta.pageSize ?? res.data.length,
        total: meta.total ?? res.data.length,
        totalPages: meta.totalPages ?? 1,
      };
    },
    placeholderData: (prev) => prev,
    refetchInterval: (query) => pollMs(socket, query.state.data?.items.some((run) => ACTIVE.includes(run.status)) ?? false),
  });
}

export function useRun(id: string | null) {
  const socket = useSocketStatus();
  return useQuery({
    queryKey: keys.run(id ?? ''),
    queryFn: async () => (await api.get<{ run: Run; feed: FeedLine[] }>(`${ROOT}/runs/${id}`)).data,
    enabled: !!id,
    refetchInterval: (query) => pollMs(socket, query.state.data ? ACTIVE.includes(query.state.data.run.status) : false),
  });
}

export function useImportRun(id: string | null) {
  const socket = useSocketStatus();
  return useQuery({
    queryKey: keys.importRun(id ?? ''),
    queryFn: async () => (await api.get<{ run: ImportRun; feed: FeedLine[] }>(`${ROOT}/imports/runs/${id}`)).data,
    enabled: !!id,
    refetchInterval: (query) => pollMs(socket, query.state.data ? IMPORT_ACTIVE.includes(query.state.data.run.status) : false),
  });
}

export function useChapter(book: BookId, language: string | null, chapter: number | null, live: boolean) {
  const socket = useSocketStatus();
  return useQuery({
    queryKey: keys.chapter(book, language ?? '', chapter ?? 0),
    queryFn: async () => (await api.get<ChapterIndex>(`${ROOT}/output/${language}/chapters/${chapter}`, { book })).data,
    enabled: !!language && !!chapter,
    placeholderData: (prev) => (prev && prev.language === language ? prev : undefined),
    refetchInterval: live && socket !== 'live' ? 6_000 : false,
  });
}

export function useVerse(language: string | null, verseId: string | null) {
  return useQuery({
    queryKey: keys.verse(language ?? '', verseId ?? ''),
    queryFn: async () => (await api.get<VerseOutput>(`${ROOT}/output/${language}/verses/${encodeURIComponent(verseId ?? '')}`)).data,
    enabled: !!language && !!verseId,
    placeholderData: (prev) => (prev && prev.language === language ? prev : undefined),
  });
}

// ── Writes ─────────────────────────────────────────────────────────────────────────────────────────

export type StartInput = { language: string; book: BookId; provider: string; model?: string; plan?: Plan; chapters?: number[]; verseLimit?: number; budgetUsd?: number };

function putRun(queryClient: QueryClient, run: Run) {
  applyRun(queryClient, run);
  void queryClient.invalidateQueries({ queryKey: keys.runs });
  void queryClient.invalidateQueries({ queryKey: keys.overview });
}

export function useStartRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: StartInput) => (await api.post<Run>(`${ROOT}/runs`, input)).data,
    onSuccess: (run) => putRun(queryClient, run),
  });
}

function putImportRun(queryClient: QueryClient, run: ImportRun) {
  applyImportRun(queryClient, run);
  void queryClient.invalidateQueries({ queryKey: keys.overview });
}

export type ImportInput = { language: string; book: BookId; chapters?: number[]; publish: boolean };

/**
 * Queues the copy of a language's translated chapters from storage into the database. The server answers at once
 * with the queued run; the worker does the copying, `useImportRun` follows it, and the finished run says what
 * each chapter did.
 */
export function useImportTranslations() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ImportInput) => (await api.post<ImportRun>(`${ROOT}/imports`, { ...input, dryRun: false })).data,
    onSuccess: (run) => putImportRun(queryClient, run),
  });
}

export function useCancelImportRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.post<ImportRun>(`${ROOT}/imports/runs/${id}/cancel`, {})).data,
    onSuccess: (run) => putImportRun(queryClient, run),
  });
}

export function useResumeRun() {
  const queryClient = useQueryClient();
  return useMutation({
    // `budgetUsd` left out keeps the run's budget; null lifts it; a number replaces it.
    mutationFn: async ({ id, budgetUsd }: { id: string; budgetUsd?: number | null }) =>
      (await api.post<Run>(`${ROOT}/runs/${id}/resume`, budgetUsd === undefined ? {} : { budgetUsd })).data,
    onSuccess: (run) => putRun(queryClient, run),
  });
}

export function useCancelRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.post<Run>(`${ROOT}/runs/${id}/cancel`, {})).data,
    onSuccess: (run) => putRun(queryClient, run),
  });
}

// ── Keeping the cache current ──────────────────────────────────────────────────────────────────────

const FEED_LIMIT = 200;

/** Puts a run, as the server just described it, into every cache that shows it. */
function applyRun(queryClient: QueryClient, run: Run) {
  queryClient.setQueryData<{ run: Run; feed: FeedLine[] }>(keys.run(run.id), (prev) => (prev ? { ...prev, run } : prev));

  queryClient.setQueryData<Overview>(keys.overview, (prev) => {
    if (!prev) return prev;
    const rest = prev.active.filter((item) => item.id !== run.id);
    if (!ACTIVE.includes(run.status)) return { ...prev, active: rest };
    const known = prev.active.some((item) => item.id === run.id);
    // Keep the order the server gave (oldest first); a run we have not seen yet goes last.
    return { ...prev, active: known ? prev.active.map((item) => (item.id === run.id ? run : item)) : [...rest, run] };
  });

  queryClient.setQueriesData<RunPage>({ queryKey: keys.runs }, (prev) => {
    if (!prev || !prev.items.some((item) => item.id === run.id)) return prev;
    return { ...prev, items: prev.items.map((item) => (item.id === run.id ? run : item)) };
  });
}

/** Puts an import run, as the server just described it, into every cache that shows it. */
function applyImportRun(queryClient: QueryClient, run: ImportRun) {
  queryClient.setQueryData<{ run: ImportRun; feed: FeedLine[] }>(keys.importRun(run.id), (prev) => (prev ? { ...prev, run } : prev));

  queryClient.setQueryData<Overview>(keys.overview, (prev) => {
    if (!prev) return prev;
    const rest = prev.activeImports.filter((item) => item.id !== run.id);
    if (!IMPORT_ACTIVE.includes(run.status)) return { ...prev, activeImports: rest };
    const known = prev.activeImports.some((item) => item.id === run.id);
    // Same order as the server's (oldest first); an import we have not seen yet goes last.
    return { ...prev, activeImports: known ? prev.activeImports.map((item) => (item.id === run.id ? run : item)) : [...rest, run] };
  });
}

/** An import ended, so what the database holds has changed: the language cards and any preview are asked again. */
export function refreshAfterImport(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ['translation', 'imports'] });
  void queryClient.invalidateQueries({ queryKey: ['translation', 'import-preview'] });
}

/** Puts one activity line at the top of a run's cached feed, unless it is already there. */
function withFeedLine<T extends { feed: FeedLine[] }>(prev: T | undefined, event: ActivityEvent) {
  if (!prev) return prev;
  const { runId: _runId, ...line } = event;
  if (prev.feed.some((item) => item.at === line.at && item.text === line.text)) return prev;
  return { ...prev, feed: [line, ...prev.feed].slice(0, FEED_LIMIT) };
}

/**
 * Subscribes the calling page to the run and activity events, of translation runs and of import runs, and applies
 * them to the query cache. Mount it once, at the top of the page.
 */
export function useTranslationLive() {
  const queryClient = useQueryClient();

  useSocketEvent<Run>('translation.run', (run) => {
    if (!run?.id) return;
    const previous = queryClient.getQueryData<Overview>(keys.overview)?.active.find((item) => item.id === run.id);
    applyRun(queryClient, run);

    // A run we had not seen (started in another tab or by another admin) or one that changed state: the
    // history list and the language cards need a fresh look. Plain progress ticks need neither.
    const changed = !previous || previous.status !== run.status;
    if (changed) void queryClient.invalidateQueries({ queryKey: keys.runs });
    if (!ACTIVE.includes(run.status) && changed) void queryClient.invalidateQueries({ queryKey: ['translation', 'coverage'] });
  });

  useSocketEvent<ActivityEvent>('translation.activity', (event) => {
    if (!event?.runId) return;

    queryClient.setQueryData<{ run: Run; feed: FeedLine[] }>(keys.run(event.runId), (prev) => withFeedLine(prev, event));

    // A saved verse changes what the output viewer shows: the open chapter list and, if it is the one on
    // screen, the verse itself. Only queries that are mounted refetch.
    if (event.kind === 'verse') {
      void queryClient.invalidateQueries({ queryKey: ['translation', 'chapter'] });
      if (event.verseId) {
        void queryClient.invalidateQueries({ predicate: (query) => query.queryKey[1] === 'verse' && query.queryKey[3] === event.verseId });
      }
    }
  });

  useSocketEvent<ImportRun>('translation-import.run', (run) => {
    if (!run?.id) return;
    const previous = queryClient.getQueryData<Overview>(keys.overview)?.activeImports.find((item) => item.id === run.id);
    applyImportRun(queryClient, run);

    // An import that has just ended (or that we never saw run) may have changed what the database holds.
    if (!IMPORT_ACTIVE.includes(run.status) && (!previous || previous.status !== run.status)) refreshAfterImport(queryClient);
  });

  useSocketEvent<ActivityEvent>('translation-import.activity', (event) => {
    if (!event?.runId) return;
    queryClient.setQueryData<{ run: ImportRun; feed: FeedLine[] }>(keys.importRun(event.runId), (prev) => withFeedLine(prev, event));
  });

  // Anything that happened while the socket was down was missed; ask for all of it again.
  useOnReconnect(() => {
    void queryClient.invalidateQueries({ queryKey: keys.all });
  });
}

/** Re-renders once a second while `active`, so "started 12 s ago" and the retry countdown stay true. */
export function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}
