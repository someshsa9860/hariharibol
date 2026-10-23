// Everything the Scenes page asks of the API (backend/routes/admin/scene.js) and how it stays current. Built like
// lib/translation.ts: the database row is the truth, every view here is a query, and the websocket only makes the
// queries current sooner — the polling intervals cover a socket that is not there.

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api } from './api';
import { useOnReconnect, useSocketEvent, useSocketStatus, type SocketStatus } from './socket';
import type { FeedLine, RunStatus } from './translation';

export type SceneRunStatus = RunStatus;
export const ACTIVE: SceneRunStatus[] = ['QUEUED', 'RUNNING', 'PAUSED'];

export type PauseReason = 'credit' | 'auth' | 'config' | 'storage' | 'unavailable' | 'rate_limit' | 'busy' | 'error';
export type ProviderId = 'anthropic' | 'openai' | 'gemini';

export type SceneRun = {
  id: string;
  book: string;
  bookTitle: string;
  provider: ProviderId;
  model: string;
  status: SceneRunStatus;
  pauseReason: PauseReason | null;
  statusMessage: string | null;
  stopReason: string | null;
  errorChapter: number | null;
  errorChapterRef: string | null;
  resumeAt: string | null;
  cancelRequested: boolean;
  chapters: number[];
  force: boolean;
  progress: { total: number; done: number; skipped: number; percent: number; currentChapter: number | null; currentRef: string | null; etaSeconds: number | null; secondsPerChapter: number | null };
  usage: { inputTokens: number; outputTokens: number; calls: number };
  attempts: number;
  requestedBy: { id: string; name: string } | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  heartbeatAt: string | null;
  stalled: boolean;
};

export type ModelInfo = { id: string; inputPerMillion: number | null; outputPerMillion: number | null; unusableReason: string | null };
export type ProviderInfo = { id: ProviderId; label: string; company: string; keyEnv: string; apiKeyConfigured: boolean; defaultModel: string; models: ModelInfo[] };
export type ChapterInfo = { id: number; canto: number | null; label: string };

export type ScenesOverview = {
  settings: {
    providers: ProviderInfo[];
    defaultProvider: ProviderId;
    model: string;
    apiKeyConfigured: boolean;
    storage: { ok: boolean; describe?: string; error?: string };
    workerOnline: boolean | null;
    /** Gemini's free-tier limits, which only a Gemini run keeps to. */
    limits: { rpm: number; tpm: number; rpd: number };
    promptVersion: string;
    outputFolder: string;
    fileExample: string;
  };
  usage: {
    /** What the worker last saw of its own minute; null when it has been idle for a couple of minutes. */
    minute: { at: string; requests: number; tokens: number; rpm: number; tpm: number } | null;
    today: { inputTokens: number; outputTokens: number; calls: number };
  };
  books: { id: string; title: string; chapters: ChapterInfo[] }[];
  active: SceneRun[];
};

export type ChapterRow = {
  id: number;
  canto: number | null;
  label: string;
  written: boolean;
  title?: string;
  scenes?: number;
  seconds?: number;
  provider?: string;
  model?: string;
  generatedAt?: string;
  inputTokens?: number;
  outputTokens?: number;
};
export type ScenesCoverage = { book: string; updatedAt: string | null; total: number; written: number; chapters: ChapterRow[] };

export type SceneEstimate = {
  requested: number;
  alreadyWritten: number;
  willWrite: number;
  sampled: number;
  inputTokensPerChapter: number;
  inputTokens: number;
  outputTokens: number;
  requests: number;
  minutes: number;
  provider: ProviderId;
  model: string;
  /** Rough, from the catalogue's prices; null for a model it has no price for. */
  costUsd: number | null;
  /** Why the model cannot run here, when it cannot. */
  unusable: string | null;
  /** Only Gemini's free tier has limits of ours; null means none. */
  limits: { rpm: number | null; tpm: number | null };
};

export type Scene = {
  number: number;
  title: string;
  verseRefs: string[];
  setting: string;
  visualPrompt: string;
  camera: string;
  mood: string;
  narration: string;
  dialogues: { speaker: string; line: string }[];
  sound: string;
  durationSec: number;
  promptText: string;
};

export type SceneFile = {
  meta: {
    book: string;
    bookTitle: string;
    canto: number | null;
    chapter: number;
    chapterId: number;
    chapterRef: string;
    chapterName: string | null;
    file: string;
    sourceLanguage: string;
    verseCount: number;
    missingHindi: string[];
    sceneCount: number;
    totalSeconds: number;
    promptVersion: string;
    provider: string;
    model: string;
    usage: { inputTokens: number; outputTokens: number };
    generatedAt: string;
  };
  chapterTitle: string;
  summary: string;
  style: string;
  characters: { name: string; look: string }[];
  scenes: Scene[];
  promptText: string;
};

export type ScenesRunPage = { items: SceneRun[]; page: number; pageSize: number; total: number; totalPages: number };

const ROOT = '/api/admin/scenes';
export const keys = {
  all: ['scenes'] as const,
  overview: ['scenes', 'overview'] as const,
  chapters: ['scenes', 'chapters'] as const,
  runs: ['scenes', 'runs'] as const,
  run: (id: string) => ['scenes', 'run', id] as const,
  output: (chapter: number) => ['scenes', 'output', chapter] as const,
};

function pollMs(socket: SocketStatus, busy: boolean) {
  if (socket === 'live') return 30_000;
  return busy ? 4_000 : 15_000;
}

export function useScenesOverview() {
  const socket = useSocketStatus();
  return useQuery({
    queryKey: keys.overview,
    queryFn: async () => (await api.get<ScenesOverview>(`${ROOT}/overview`)).data,
    // The worker's minute and today's tokens only come from here, so a busy page asks more often even with a socket.
    refetchInterval: (query) => ((query.state.data?.active.length ?? 0) > 0 ? (socket === 'live' ? 10_000 : 4_000) : pollMs(socket, false)),
  });
}

export function useChapters(busy: boolean) {
  const socket = useSocketStatus();
  return useQuery({
    queryKey: keys.chapters,
    queryFn: async () => (await api.get<ScenesCoverage>(`${ROOT}/chapters`)).data,
    staleTime: 15_000,
    refetchInterval: busy ? (socket === 'live' ? 20_000 : 6_000) : false,
  });
}

/** `model` blank asks for the provider's default. */
export function useSceneEstimate(chapters: number[], force: boolean, provider: ProviderId, model: string, enabled: boolean) {
  const modelName = model.trim();
  return useQuery({
    queryKey: ['scenes', 'estimate', chapters.join(','), force, provider, modelName],
    queryFn: async () =>
      (await api.get<SceneEstimate>(`${ROOT}/estimate`, { chapters: chapters.join(','), force: force ? 'true' : 'false', provider, ...(modelName ? { model: modelName } : {}) })).data,
    enabled: enabled && chapters.length > 0,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
}

export function useSceneRuns(page: number) {
  const socket = useSocketStatus();
  return useQuery({
    queryKey: [...keys.runs, page],
    queryFn: async (): Promise<ScenesRunPage> => {
      const res = await api.get<SceneRun[]>(`${ROOT}/runs`, { page, pageSize: 10 });
      const meta = (res.meta ?? {}) as Record<string, number>;
      return { items: res.data, page: meta.page ?? 1, pageSize: meta.pageSize ?? res.data.length, total: meta.total ?? res.data.length, totalPages: meta.totalPages ?? 1 };
    },
    placeholderData: (prev) => prev,
    refetchInterval: (query) => pollMs(socket, query.state.data?.items.some((run) => ACTIVE.includes(run.status)) ?? false),
  });
}

export function useSceneRun(id: string | null) {
  const socket = useSocketStatus();
  return useQuery({
    queryKey: keys.run(id ?? ''),
    queryFn: async () => (await api.get<{ run: SceneRun; feed: FeedLine[] }>(`${ROOT}/runs/${id}`)).data,
    enabled: !!id,
    refetchInterval: (query) => pollMs(socket, query.state.data ? ACTIVE.includes(query.state.data.run.status) : false),
  });
}

export function useSceneFile(chapter: number | null) {
  return useQuery({
    queryKey: keys.output(chapter ?? 0),
    queryFn: async () => (await api.get<SceneFile>(`${ROOT}/output/${chapter}`)).data,
    enabled: !!chapter,
    retry: false, // a chapter not written yet is a 404, not a hiccup
    placeholderData: (prev) => (prev && prev.meta.chapterId === chapter ? prev : undefined),
  });
}

/** The file exactly as stored in S3, as text ready to be saved. */
export async function fetchStoredFile(chapter: number) {
  const { data } = await api.get<unknown>(`${ROOT}/output/${chapter}/file`);
  return JSON.stringify(data, null, 2);
}

// ── Writes ─────────────────────────────────────────────────────────────────────────────────────────

export type StartSceneInput = { chapters?: number[]; provider?: ProviderId; model?: string; force?: boolean };

function putRun(queryClient: QueryClient, run: SceneRun) {
  applyRun(queryClient, run);
  void queryClient.invalidateQueries({ queryKey: keys.runs });
  void queryClient.invalidateQueries({ queryKey: keys.overview });
}

export function useStartScenes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: StartSceneInput) => (await api.post<SceneRun>(`${ROOT}/runs`, input)).data,
    onSuccess: (run) => putRun(queryClient, run),
  });
}

export function useResumeScenes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.post<SceneRun>(`${ROOT}/runs/${id}/resume`, {})).data,
    onSuccess: (run) => putRun(queryClient, run),
  });
}

export function useCancelScenes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.post<SceneRun>(`${ROOT}/runs/${id}/cancel`, {})).data,
    onSuccess: (run) => putRun(queryClient, run),
  });
}

// ── Keeping the cache current ──────────────────────────────────────────────────────────────────────

const FEED_LIMIT = 200;

function applyRun(queryClient: QueryClient, run: SceneRun) {
  queryClient.setQueryData<{ run: SceneRun; feed: FeedLine[] }>(keys.run(run.id), (prev) => (prev ? { ...prev, run } : prev));
  queryClient.setQueryData<ScenesOverview>(keys.overview, (prev) => {
    if (!prev) return prev;
    const rest = prev.active.filter((item) => item.id !== run.id);
    if (!ACTIVE.includes(run.status)) return { ...prev, active: rest };
    const known = prev.active.some((item) => item.id === run.id);
    return { ...prev, active: known ? prev.active.map((item) => (item.id === run.id ? run : item)) : [...rest, run] };
  });
  queryClient.setQueriesData<ScenesRunPage>({ queryKey: keys.runs }, (prev) => {
    if (!prev || !prev.items.some((item) => item.id === run.id)) return prev;
    return { ...prev, items: prev.items.map((item) => (item.id === run.id ? run : item)) };
  });
}

/** Subscribes the page to the run and activity events and applies them to the query cache. Mount it once, at the top. */
export function useScenesLive() {
  const queryClient = useQueryClient();

  useSocketEvent<SceneRun>('scenes.run', (run) => {
    if (!run?.id) return;
    const before = queryClient.getQueryData<ScenesOverview>(keys.overview)?.active.find((item) => item.id === run.id);
    applyRun(queryClient, run);
    // A new run, or one that changed state, needs the lists looked at again; a plain progress tick needs only the bar.
    if (!before || before.status !== run.status) {
      void queryClient.invalidateQueries({ queryKey: keys.runs });
      void queryClient.invalidateQueries({ queryKey: keys.overview });
    }
    // A chapter was written: the grid and the open chapter have changed.
    if (before && run.progress.done !== before.progress.done) {
      void queryClient.invalidateQueries({ queryKey: keys.chapters });
      void queryClient.invalidateQueries({ queryKey: ['scenes', 'output'] });
    }
    if (!ACTIVE.includes(run.status)) {
      void queryClient.invalidateQueries({ queryKey: keys.chapters });
      void queryClient.invalidateQueries({ queryKey: ['scenes', 'output'] });
    }
  });

  // The worker's minute and today's tokens, sent each time a request starts or finishes.
  useSocketEvent<{ minute: ScenesOverview['usage']['minute']; today: ScenesOverview['usage']['today'] | null }>('scenes.usage', (usage) => {
    queryClient.setQueryData<ScenesOverview>(keys.overview, (prev) => (prev ? { ...prev, usage: { minute: usage.minute, today: usage.today ?? prev.usage.today } } : prev));
  });

  useSocketEvent<FeedLine & { runId: string }>('scenes.activity', (line) => {
    if (!line?.runId) return;
    const { runId, ...entry } = line;
    queryClient.setQueryData<{ run: SceneRun; feed: FeedLine[] }>(keys.run(runId), (prev) => {
      if (!prev || prev.feed.some((item) => item.at === entry.at && item.text === entry.text)) return prev;
      return { ...prev, feed: [entry, ...prev.feed].slice(0, FEED_LIMIT) };
    });
  });

  // Anything that happened while the socket was down was missed; ask for all of it again.
  useOnReconnect(() => {
    void queryClient.invalidateQueries({ queryKey: keys.all });
  });
}
