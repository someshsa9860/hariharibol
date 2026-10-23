// Everything the Devotee etiquette page asks of the API (backend/routes/admin/etiquette.js) and how it stays current.
// Built like lib/scenes.ts: the database row is the truth, every view here is a query, and the websocket only makes the
// queries current sooner — the polling intervals cover a socket that is not there.

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api } from './api';
import { useOnReconnect, useSocketEvent, useSocketStatus, type SocketStatus } from './socket';
import type { FeedLine, RunStatus } from './translation';

export type EtiquetteStatus = 'PUBLISHED' | 'DRAFT' | 'EXCLUDED';
export const STATUS_LABEL: Record<EtiquetteStatus, string> = { PUBLISHED: 'Published', DRAFT: 'Draft', EXCLUDED: 'Excluded' };
export const STATUS_VARIANT: Record<EtiquetteStatus, 'success' | 'secondary' | 'destructive'> = { PUBLISHED: 'success', DRAFT: 'secondary', EXCLUDED: 'destructive' };

export type EtiquetteRunStatus = RunStatus;
export const ACTIVE: EtiquetteRunStatus[] = ['QUEUED', 'RUNNING', 'PAUSED'];

export type PauseReason = 'credit' | 'auth' | 'config' | 'storage' | 'unavailable' | 'rate_limit' | 'busy' | 'error';
export type ProviderId = 'anthropic' | 'openai' | 'gemini';
export type ProviderInfo = { id: ProviderId; label: string; company: string; keyEnv: string; apiKeyConfigured: boolean; defaultModel: string };

export type CategoryInfo = { id: string; name: string; published: number; total: number };
export type LanguageCoverage = { code: string; name: string; endonym: string; translated: number; edited: number };

export type EtiquetteRun = {
  id: string;
  language: string;
  languageName: string;
  endonym: string;
  provider: ProviderId;
  model: string;
  force: boolean;
  status: EtiquetteRunStatus;
  pauseReason: PauseReason | null;
  statusMessage: string | null;
  stopReason: string | null;
  resumeAt: string | null;
  cancelRequested: boolean;
  progress: { total: number; done: number; percent: number; currentSlug: string | null; etaSeconds: number | null };
  usage: { inputTokens: number; outputTokens: number; calls: number };
  attempts: number;
  requestedBy: { id: string; name: string | null } | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  heartbeatAt: string | null;
  stalled: boolean;
};

export type EtiquetteOverview = {
  counts: { published: number; draft: number; excluded: number; total: number };
  categories: CategoryInfo[];
  statuses: EtiquetteStatus[];
  languages: LanguageCoverage[];
  publishedTotal: number;
  delivery: { time: string; defaultTime: string; settingKey: string; today: { id: string; slug: string; title: string; category: string } | null };
  translation: {
    providers: ProviderInfo[];
    defaultProvider: ProviderId;
    model: string;
    apiKeyConfigured: boolean;
    workerOnline: boolean | null;
    batchSize: number;
    promptVersion: string;
  };
  active: EtiquetteRun[];
};

export type EtiquetteRow = {
  id: string;
  slug: string;
  category: string;
  sortOrder: number;
  title: string;
  summary: string;
  status: EtiquetteStatus;
  excludedReason: string | null;
  author: string | null;
  sourceName: string | null;
  isEdited: boolean;
  updatedAt: string;
  translations: { language: string; isEdited: boolean; isPublished: boolean }[];
};

export type EtiquetteTranslation = {
  language: string;
  title: string;
  summary: string;
  body: string;
  translatedBy: string | null;
  isEdited: boolean;
  isPublished: boolean;
  updatedAt: string;
};

export type EtiquetteDetail = {
  id: string;
  slug: string;
  category: string;
  sortOrder: number;
  title: string;
  summary: string;
  body: string;
  reference: string | null;
  author: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  status: EtiquetteStatus;
  excludedReason: string | null;
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
  timesShown: number;
  timesPushed: number;
  translations: EtiquetteTranslation[];
};

export type EtiquetteInput = {
  category: string;
  title: string;
  summary: string;
  body: string;
  reference?: string | null;
  author?: string | null;
  sourceName?: string | null;
  sourceUrl?: string | null;
  sortOrder?: number;
  status?: EtiquetteStatus;
  excludedReason?: string | null;
};

export type EtiquetteEstimate = { language: string; willTranslate: number; requests: number; inputTokens: number; outputTokens: number; minutes: number };

export type EtiquetteRunPage = { items: EtiquetteRun[]; page: number; pageSize: number; total: number; totalPages: number };

const ROOT = '/api/admin/etiquette';
export const keys = {
  all: ['etiquette'] as const,
  overview: ['etiquette', 'overview'] as const,
  runs: ['etiquette', 'runs'] as const,
  run: (id: string) => ['etiquette', 'run', id] as const,
  item: (id: string) => ['etiquette', 'item', id] as const,
};

/** The key the items table (`useDataTable({ id })`) caches under — a write refreshes the table through it. */
export const TABLE_ID = 'etiquette-items';

function pollMs(socket: SocketStatus, busy: boolean) {
  if (socket === 'live') return 30_000;
  return busy ? 4_000 : 15_000;
}

export function useEtiquetteOverview() {
  const socket = useSocketStatus();
  return useQuery({
    queryKey: keys.overview,
    queryFn: async () => (await api.get<EtiquetteOverview>(`${ROOT}/overview`)).data,
    refetchInterval: (query) => pollMs(socket, (query.state.data?.active.length ?? 0) > 0),
  });
}

export function useEtiquetteItem(id: string | null) {
  return useQuery({
    queryKey: keys.item(id ?? ''),
    queryFn: async () => (await api.get<EtiquetteDetail>(`${ROOT}/items/${id}`)).data,
    enabled: !!id,
  });
}

export function useEtiquetteEstimate(language: string, force: boolean, enabled: boolean) {
  return useQuery({
    queryKey: ['etiquette', 'estimate', language, force],
    queryFn: async () => (await api.get<EtiquetteEstimate>(`${ROOT}/estimate`, { language, force: force ? 'true' : 'false' })).data,
    enabled: enabled && !!language,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
}

export function useEtiquetteRuns(page: number, enabled: boolean) {
  const socket = useSocketStatus();
  return useQuery({
    queryKey: [...keys.runs, page],
    queryFn: async (): Promise<EtiquetteRunPage> => {
      const res = await api.get<EtiquetteRun[]>(`${ROOT}/runs`, { page, pageSize: 10 });
      const meta = (res.meta ?? {}) as Record<string, number>;
      return { items: res.data, page: meta.page ?? 1, pageSize: meta.pageSize ?? res.data.length, total: meta.total ?? res.data.length, totalPages: meta.totalPages ?? 1 };
    },
    enabled,
    placeholderData: (prev) => prev,
    refetchInterval: (query) => pollMs(socket, query.state.data?.items.some((run) => ACTIVE.includes(run.status)) ?? false),
  });
}

export function useEtiquetteRun(id: string | null) {
  const socket = useSocketStatus();
  return useQuery({
    queryKey: keys.run(id ?? ''),
    queryFn: async () => (await api.get<{ run: EtiquetteRun; feed: FeedLine[] }>(`${ROOT}/runs/${id}`)).data,
    enabled: !!id,
    refetchInterval: (query) => pollMs(socket, query.state.data ? ACTIVE.includes(query.state.data.run.status) : false),
  });
}

// ── Writes ─────────────────────────────────────────────────────────────────────────────────────────

/** A change to an item (or its translations) refreshes the table, the item, and the overview's counts and coverage. */
function refreshItems(queryClient: QueryClient, id?: string) {
  void queryClient.invalidateQueries({ queryKey: [TABLE_ID] });
  void queryClient.invalidateQueries({ queryKey: keys.overview });
  if (id) void queryClient.invalidateQueries({ queryKey: keys.item(id) });
}

export function useCreateEtiquette() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: EtiquetteInput) => (await api.post<EtiquetteDetail>(`${ROOT}/items`, input)).data,
    onSuccess: (item) => refreshItems(queryClient, item.id),
  });
}

export function useUpdateEtiquette(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Omit<EtiquetteInput, 'status' | 'excludedReason'>>) => (await api.patch<EtiquetteDetail>(`${ROOT}/items/${id}`, input)).data,
    onSuccess: () => refreshItems(queryClient, id),
  });
}

export function useSetEtiquetteStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, reason }: { id: string; status: EtiquetteStatus; reason?: string }) => (await api.post<EtiquetteDetail>(`${ROOT}/items/${id}/status`, { status, reason })).data,
    onSuccess: (item) => refreshItems(queryClient, item.id),
  });
}

export function useSaveEtiquetteTranslation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ language, ...body }: { language: string; title: string; summary: string; body: string; isPublished: boolean }) =>
      (await api.put<unknown>(`${ROOT}/items/${id}/translations/${language}`, body)).data,
    onSuccess: () => refreshItems(queryClient, id),
  });
}

export function useDeleteEtiquetteTranslation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (language: string) => (await api.delete<unknown>(`${ROOT}/items/${id}/translations/${language}`)).data,
    onSuccess: () => refreshItems(queryClient, id),
  });
}

export type StartEtiquetteInput = { language: string; force?: boolean; provider?: ProviderId; model?: string };

function putRun(queryClient: QueryClient, run: EtiquetteRun) {
  applyRun(queryClient, run);
  void queryClient.invalidateQueries({ queryKey: keys.runs });
  void queryClient.invalidateQueries({ queryKey: keys.overview });
}

export function useStartEtiquette() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: StartEtiquetteInput) => (await api.post<EtiquetteRun>(`${ROOT}/runs`, input)).data,
    onSuccess: (run) => putRun(queryClient, run),
  });
}

export function useResumeEtiquette() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.post<EtiquetteRun>(`${ROOT}/runs/${id}/resume`, {})).data,
    onSuccess: (run) => putRun(queryClient, run),
  });
}

export function useCancelEtiquette() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.post<EtiquetteRun>(`${ROOT}/runs/${id}/cancel`, {})).data,
    onSuccess: (run) => putRun(queryClient, run),
  });
}

// ── Keeping the cache current ──────────────────────────────────────────────────────────────────────

const FEED_LIMIT = 200;

function applyRun(queryClient: QueryClient, run: EtiquetteRun) {
  queryClient.setQueryData<{ run: EtiquetteRun; feed: FeedLine[] }>(keys.run(run.id), (prev) => (prev ? { ...prev, run } : prev));
  queryClient.setQueryData<EtiquetteOverview>(keys.overview, (prev) => {
    if (!prev) return prev;
    const rest = prev.active.filter((item) => item.id !== run.id);
    if (!ACTIVE.includes(run.status)) return { ...prev, active: rest };
    const known = prev.active.some((item) => item.id === run.id);
    return { ...prev, active: known ? prev.active.map((item) => (item.id === run.id ? run : item)) : [...rest, run] };
  });
  queryClient.setQueriesData<EtiquetteRunPage>({ queryKey: keys.runs }, (prev) => {
    if (!prev || !prev.items.some((item) => item.id === run.id)) return prev;
    return { ...prev, items: prev.items.map((item) => (item.id === run.id ? run : item)) };
  });
}

/** Subscribes the page to the run and activity events and applies them to the query cache. Mount it once, at the top. */
export function useEtiquetteLive() {
  const queryClient = useQueryClient();

  useSocketEvent<EtiquetteRun>('etiquette.run', (run) => {
    if (!run?.id) return;
    const before = queryClient.getQueryData<EtiquetteOverview>(keys.overview)?.active.find((item) => item.id === run.id);
    applyRun(queryClient, run);
    // A new run, or one that changed state, needs the lists looked at again; a plain progress tick needs only the bar.
    if (!before || before.status !== run.status) {
      void queryClient.invalidateQueries({ queryKey: keys.runs });
      void queryClient.invalidateQueries({ queryKey: keys.overview });
    }
    // Items were translated: the table's language chips, the coverage bars and any open item have changed.
    if ((before && run.progress.done !== before.progress.done) || !ACTIVE.includes(run.status)) {
      void queryClient.invalidateQueries({ queryKey: [TABLE_ID] });
      void queryClient.invalidateQueries({ queryKey: keys.overview });
      void queryClient.invalidateQueries({ queryKey: ['etiquette', 'item'] });
    }
  });

  useSocketEvent<FeedLine & { runId: string }>('etiquette.activity', (line) => {
    if (!line?.runId) return;
    const { runId, ...entry } = line;
    queryClient.setQueryData<{ run: EtiquetteRun; feed: FeedLine[] }>(keys.run(runId), (prev) => {
      if (!prev || prev.feed.some((item) => item.at === entry.at && item.text === entry.text)) return prev;
      return { ...prev, feed: [entry, ...prev.feed].slice(0, FEED_LIMIT) };
    });
  });

  // Anything that happened while the socket was down was missed; ask for all of it again.
  useOnReconnect(() => {
    void queryClient.invalidateQueries({ queryKey: keys.all });
    void queryClient.invalidateQueries({ queryKey: [TABLE_ID] });
  });
}
