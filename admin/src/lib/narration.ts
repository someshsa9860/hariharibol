// Everything the Narration page asks of the API (backend/routes/admin/narration.js) and how it stays current. Built like
// lib/scenes.ts: the database row is the truth, every view here is a query, and the websocket only makes the queries
// current sooner — the polling intervals cover a socket that is not there.

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api } from './api';
import { useOnReconnect, useSocketEvent, useSocketStatus, type SocketStatus } from './socket';
import type { FeedLine, RunStatus } from './translation';

export const ACTIVE: RunStatus[] = ['QUEUED', 'RUNNING', 'PAUSED'];

export type PauseReason = 'credit' | 'auth' | 'config' | 'storage' | 'unavailable' | 'rate_limit' | 'busy' | 'error' | 'source';
export type Target = { engine: string; model: string; voice: string };
export type ResultCell = Target & { key: string; done: number; skipped: number; failed: number; stopped: boolean; error: string | null; characters: number; seconds: number };

export type NarrationRun = {
  id: string;
  kind: 'NARRATION' | 'COMPARE';
  book: string;
  bookTitle: string;
  language: string;
  languageName: string;
  engine: string | null;
  engineLabel: string | null;
  model: string | null;
  voice: string | null;
  targets: Target[] | null;
  results: ResultCell[] | null;
  chapters: number[];
  chapterLabels: string[];
  verseIds: string[] | null;
  force: boolean;
  status: RunStatus;
  pauseReason: PauseReason | null;
  statusMessage: string | null;
  stopReason: string | null;
  errorVerseId: string | null;
  resumeAt: string | null;
  cancelRequested: boolean;
  progress: { total: number; done: number; skipped: number; failed: number; percent: number; currentVerseId: string | null; etaSeconds: number | null; secondsPerVerse: number | null };
  usage: { characters: number; audioSeconds: number; calls: number; costUsd: number | null };
  attempts: number;
  requestedBy: { id: string; name: string } | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  heartbeatAt: string | null;
  stalled: boolean;
};

export type EngineInfo = {
  id: string;
  label: string;
  company: string;
  keyEnv: string;
  configured: boolean;
  models: string[];
  voices: string[];
  /** Not checked against the company's own price list unless `verified`; null when no price is known. */
  price: { usdPerMillionChars: number | null; verified: boolean; source: string | null };
  limits: { requestsPerMinute: number; bytesPerRequest: number };
};
export type LanguageInfo = { id: string; label: string };
export type ChapterInfo = { id: number; canto: number | null; label: string };

export type NarrationOverview = {
  settings: {
    engines: EngineInfo[];
    languages: LanguageInfo[];
    defaults: { engine: string; model: string; voice: string; language: string };
    defaultBook: string;
    pipelineVersion: string;
    maxTargets: number;
    outputFolder: string;
    storage: { ok: boolean; describe?: string; error?: string };
    workerOnline: boolean | null;
  };
  books: { id: string; title: string; chapters: ChapterInfo[] }[];
  active: NarrationRun[];
};

export type NarrationEstimate = Target & {
  book: string;
  language: string;
  chapters: number;
  sampledChapters: number;
  sampled: boolean;
  verses: number;
  alreadyMade: number;
  versesWithoutText: number;
  characters: number;
  requests: number;
  priced: boolean;
  priceVerified: boolean;
  costUsd: number | null;
  minutesAtLimit: number;
};

export type Clip = Target & { id: string; book: string; language: string; verseId: string; s3Key: string; contentType: string; bytes: number; seconds: number; characters: number; runId: string | null; updatedAt: string; url?: string | null };
export type CompareCell = Target & { key: string; clip: Clip | null };
export type Comparison = { run: NarrationRun; verseId: string | null; cells: CompareCell[]; feed: FeedLine[] };

export type RunPage = { items: NarrationRun[]; page: number; pageSize: number; total: number; totalPages: number };

const ROOT = '/api/admin/narration';
export const keys = {
  all: ['narration'] as const,
  overview: ['narration', 'overview'] as const,
  runs: ['narration', 'runs'] as const,
  run: (id: string) => ['narration', 'run', id] as const,
  compare: (id: string) => ['narration', 'compare', id] as const,
};

function pollMs(socket: SocketStatus, busy: boolean) {
  if (socket === 'live') return 30_000;
  return busy ? 4_000 : 15_000;
}

export function useNarrationOverview() {
  const socket = useSocketStatus();
  return useQuery({
    queryKey: keys.overview,
    queryFn: async () => (await api.get<NarrationOverview>(`${ROOT}/overview`)).data,
    refetchInterval: (query) => pollMs(socket, (query.state.data?.active.length ?? 0) > 0),
  });
}

export type EstimateInput = { book: string; language: string; chapters: number[] | null } & Target & { force: boolean };

export function useNarrationEstimate(input: EstimateInput, enabled: boolean) {
  const { book, language, chapters, engine, model, voice, force } = input;
  return useQuery({
    queryKey: ['narration', 'estimate', book, language, chapters?.join(',') ?? 'all', engine, model, voice, force],
    queryFn: async () =>
      (await api.get<NarrationEstimate>(`${ROOT}/estimate`, { book, language, engine, model, voice, force: force ? 'true' : 'false', ...(chapters ? { chapters: chapters.join(',') } : {}) })).data,
    enabled,
    staleTime: 30_000,
    retry: false,
    placeholderData: (prev) => prev,
  });
}

export function useNarrationRuns(page: number, kind?: 'NARRATION' | 'COMPARE') {
  const socket = useSocketStatus();
  return useQuery({
    queryKey: [...keys.runs, kind ?? 'all', page],
    queryFn: async (): Promise<RunPage> => {
      const res = await api.get<NarrationRun[]>(`${ROOT}/runs`, { page, pageSize: 10, ...(kind ? { kind } : {}) });
      const meta = (res.meta ?? {}) as Record<string, number>;
      return { items: res.data, page: meta.page ?? 1, pageSize: meta.pageSize ?? res.data.length, total: meta.total ?? res.data.length, totalPages: meta.totalPages ?? 1 };
    },
    placeholderData: (prev) => prev,
    refetchInterval: (query) => pollMs(socket, query.state.data?.items.some((run) => ACTIVE.includes(run.status)) ?? false),
  });
}

export function useNarrationRun(id: string | null) {
  const socket = useSocketStatus();
  return useQuery({
    queryKey: keys.run(id ?? ''),
    queryFn: async () => (await api.get<{ run: NarrationRun; feed: FeedLine[] }>(`${ROOT}/runs/${id}`)).data,
    enabled: !!id,
    refetchInterval: (query) => pollMs(socket, query.state.data ? ACTIVE.includes(query.state.data.run.status) : false),
  });
}

/** A comparison with a short-lived address for each clip, so it is asked for again now and then while it is open. */
export function useComparison(id: string | null) {
  const socket = useSocketStatus();
  return useQuery({
    queryKey: keys.compare(id ?? ''),
    queryFn: async () => (await api.get<Comparison>(`${ROOT}/compare/${id}`)).data,
    enabled: !!id,
    retry: false,
    refetchInterval: (query) => (query.state.data && ACTIVE.includes(query.state.data.run.status) ? pollMs(socket, true) : 10 * 60_000),
  });
}

// ── Writes ─────────────────────────────────────────────────────────────────────────────────────────

export type StartNarrationInput = Partial<Target> & { book?: string; language?: string; chapters?: number[]; force?: boolean };
export type StartCompareInput = { book?: string; language?: string; verseId: string; targets: Target[] };

function putRun(queryClient: QueryClient, run: NarrationRun) {
  applyRun(queryClient, run);
  void queryClient.invalidateQueries({ queryKey: keys.runs });
  void queryClient.invalidateQueries({ queryKey: keys.overview });
}

export function useStartNarration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: StartNarrationInput) => (await api.post<NarrationRun>(`${ROOT}/runs`, input)).data,
    onSuccess: (run) => putRun(queryClient, run),
  });
}

export function useStartCompare() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: StartCompareInput) => (await api.post<NarrationRun>(`${ROOT}/compare`, input)).data,
    onSuccess: (run) => putRun(queryClient, run),
  });
}

export function useResumeNarration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.post<NarrationRun>(`${ROOT}/runs/${id}/resume`, {})).data,
    onSuccess: (run) => putRun(queryClient, run),
  });
}

export function useCancelNarration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.post<NarrationRun>(`${ROOT}/runs/${id}/cancel`, {})).data,
    onSuccess: (run) => putRun(queryClient, run),
  });
}

// ── Keeping the cache current ──────────────────────────────────────────────────────────────────────

const FEED_LIMIT = 200;

function applyRun(queryClient: QueryClient, run: NarrationRun) {
  queryClient.setQueryData<{ run: NarrationRun; feed: FeedLine[] }>(keys.run(run.id), (prev) => (prev ? { ...prev, run } : prev));
  queryClient.setQueryData<Comparison>(keys.compare(run.id), (prev) => (prev ? { ...prev, run } : prev));
  queryClient.setQueryData<NarrationOverview>(keys.overview, (prev) => {
    if (!prev) return prev;
    const rest = prev.active.filter((item) => item.id !== run.id);
    if (!ACTIVE.includes(run.status)) return { ...prev, active: rest };
    const known = prev.active.some((item) => item.id === run.id);
    return { ...prev, active: known ? prev.active.map((item) => (item.id === run.id ? run : item)) : [...rest, run] };
  });
  queryClient.setQueriesData<RunPage>({ queryKey: keys.runs }, (prev) => {
    if (!prev || !prev.items.some((item) => item.id === run.id)) return prev;
    return { ...prev, items: prev.items.map((item) => (item.id === run.id ? run : item)) };
  });
}

/** Subscribes the page to the run, activity and clip events and applies them to the query cache. Mount it once, at the top. */
export function useNarrationLive() {
  const queryClient = useQueryClient();

  useSocketEvent<NarrationRun>('narration.run', (run) => {
    if (!run?.id) return;
    const before = queryClient.getQueryData<NarrationOverview>(keys.overview)?.active.find((item) => item.id === run.id);
    applyRun(queryClient, run);
    if (!before || before.status !== run.status) {
      void queryClient.invalidateQueries({ queryKey: keys.runs });
      void queryClient.invalidateQueries({ queryKey: keys.overview });
    }
    // A comparison's cells change when a voice finishes; its clips need their addresses.
    if (run.kind === 'COMPARE' && (!before || before.progress.done !== run.progress.done || !ACTIVE.includes(run.status))) {
      void queryClient.invalidateQueries({ queryKey: keys.compare(run.id) });
    }
  });

  useSocketEvent<FeedLine & { runId: string }>('narration.activity', (line) => {
    if (!line?.runId) return;
    const { runId, ...entry } = line;
    queryClient.setQueryData<{ run: NarrationRun; feed: FeedLine[] }>(keys.run(runId), (prev) => {
      if (!prev || prev.feed.some((item) => item.at === entry.at && item.text === entry.text)) return prev;
      return { ...prev, feed: [entry, ...prev.feed].slice(0, FEED_LIMIT) };
    });
  });

  // Anything that happened while the socket was down was missed; ask for all of it again.
  useOnReconnect(() => {
    void queryClient.invalidateQueries({ queryKey: keys.all });
  });
}
