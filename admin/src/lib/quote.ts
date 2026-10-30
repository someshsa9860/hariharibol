// Everything the Quotes page asks of the API (backend/routes/admin/quote.js) and how it stays current.
// Built like lib/scenes.ts: the database row is the truth, every view here is a query, and the websocket only makes the
// queries current sooner — the polling intervals cover a socket that is not there.

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api } from './api';
import { useOnReconnect, useSocketEvent, useSocketStatus, type SocketStatus } from './socket';
import type { FeedLine, RunStatus } from './translation';

export type QuoteStatus = 'PUBLISHED' | 'DRAFT' | 'EXCLUDED';
export const STATUS_LABEL: Record<QuoteStatus, string> = { PUBLISHED: 'Published', DRAFT: 'Draft', EXCLUDED: 'Excluded' };
export const STATUS_VARIANT: Record<QuoteStatus, 'success' | 'secondary' | 'destructive'> = { PUBLISHED: 'success', DRAFT: 'secondary', EXCLUDED: 'destructive' };

export type QuoteRunStatus = RunStatus;
export const ACTIVE: QuoteRunStatus[] = ['QUEUED', 'RUNNING', 'PAUSED'];

export type PauseReason = 'credit' | 'auth' | 'config' | 'storage' | 'unavailable' | 'rate_limit' | 'busy' | 'error';
export type ProviderId = 'anthropic' | 'openai' | 'gemini';
export type ProviderInfo = { id: ProviderId; label: string; company: string; keyEnv: string; apiKeyConfigured: boolean; defaultModel: string };

export type LanguageCoverage = { code: string; name: string; endonym: string; translated: number; edited: number };

export type QuoteRun = {
  id: string;
  language: string;
  languageName: string;
  endonym: string;
  provider: ProviderId;
  model: string;
  force: boolean;
  status: QuoteRunStatus;
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

export type QuoteOverview = {
  counts: { published: number; draft: number; excluded: number; total: number };
  statuses: QuoteStatus[];
  languages: LanguageCoverage[];
  publishedTotal: number;
  translation: {
    providers: ProviderInfo[];
    defaultProvider: ProviderId;
    model: string;
    apiKeyConfigured: boolean;
    workerOnline: boolean | null;
    batchSize: number;
    promptVersion: string;
  };
  active: QuoteRun[];
};

export type QuoteRow = {
  id: string;
  slug: string;
  sortOrder: number;
  text: string;
  status: QuoteStatus;
  excludedReason: string | null;
  author: string | null;
  reference: string | null;
  sourceName: string | null;
  isEdited: boolean;
  updatedAt: string;
  translations: { language: string; isEdited: boolean; isPublished: boolean }[];
};

export type QuoteTranslation = {
  language: string;
  text: string;
  translatedBy: string | null;
  isEdited: boolean;
  isPublished: boolean;
  updatedAt: string;
};

export type QuoteDetail = {
  id: string;
  slug: string;
  sortOrder: number;
  text: string;
  reference: string | null;
  author: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  status: QuoteStatus;
  excludedReason: string | null;
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
  translations: QuoteTranslation[];
};

export type QuoteInput = {
  text: string;
  reference?: string | null;
  author?: string | null;
  sourceName?: string | null;
  sourceUrl?: string | null;
  sortOrder?: number;
  status?: QuoteStatus;
  excludedReason?: string | null;
};

export type QuoteEstimate = { language: string; willTranslate: number; requests: number; inputTokens: number; outputTokens: number; minutes: number };

export type QuoteRunPage = { items: QuoteRun[]; page: number; pageSize: number; total: number; totalPages: number };

const ROOT = '/api/admin/quotes';
export const keys = {
  all: ['quote'] as const,
  overview: ['quote', 'overview'] as const,
  runs: ['quote', 'runs'] as const,
  run: (id: string) => ['quote', 'run', id] as const,
  item: (id: string) => ['quote', 'item', id] as const,
};

/** The key the items table (`useDataTable({ id })`) caches under — a write refreshes the table through it. */
export const TABLE_ID = 'quote-items';

function pollMs(socket: SocketStatus, busy: boolean) {
  if (socket === 'live') return 30_000;
  return busy ? 4_000 : 15_000;
}

export function useQuoteOverview() {
  const socket = useSocketStatus();
  return useQuery({
    queryKey: keys.overview,
    queryFn: async () => (await api.get<QuoteOverview>(`${ROOT}/overview`)).data,
    refetchInterval: (query) => pollMs(socket, (query.state.data?.active.length ?? 0) > 0),
  });
}

export function useQuoteItem(id: string | null) {
  return useQuery({
    queryKey: keys.item(id ?? ''),
    queryFn: async () => (await api.get<QuoteDetail>(`${ROOT}/items/${id}`)).data,
    enabled: !!id,
  });
}

export function useQuoteEstimate(language: string, force: boolean, enabled: boolean) {
  return useQuery({
    queryKey: ['quote', 'estimate', language, force],
    queryFn: async () => (await api.get<QuoteEstimate>(`${ROOT}/estimate`, { language, force: force ? 'true' : 'false' })).data,
    enabled: enabled && !!language,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
}

export function useQuoteRuns(page: number, enabled: boolean) {
  const socket = useSocketStatus();
  return useQuery({
    queryKey: [...keys.runs, page],
    queryFn: async (): Promise<QuoteRunPage> => {
      const res = await api.get<QuoteRun[]>(`${ROOT}/runs`, { page, pageSize: 10 });
      const meta = (res.meta ?? {}) as Record<string, number>;
      return { items: res.data, page: meta.page ?? 1, pageSize: meta.pageSize ?? res.data.length, total: meta.total ?? res.data.length, totalPages: meta.totalPages ?? 1 };
    },
    enabled,
    placeholderData: (prev) => prev,
    refetchInterval: (query) => pollMs(socket, query.state.data?.items.some((run) => ACTIVE.includes(run.status)) ?? false),
  });
}

export function useQuoteRun(id: string | null) {
  const socket = useSocketStatus();
  return useQuery({
    queryKey: keys.run(id ?? ''),
    queryFn: async () => (await api.get<{ run: QuoteRun; feed: FeedLine[] }>(`${ROOT}/runs/${id}`)).data,
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

export function useCreateQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: QuoteInput) => (await api.post<QuoteDetail>(`${ROOT}/items`, input)).data,
    onSuccess: (item) => refreshItems(queryClient, item.id),
  });
}

export function useUpdateQuote(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Omit<QuoteInput, 'status' | 'excludedReason'>>) => (await api.patch<QuoteDetail>(`${ROOT}/items/${id}`, input)).data,
    onSuccess: () => refreshItems(queryClient, id),
  });
}

export function useSetQuoteStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, reason }: { id: string; status: QuoteStatus; reason?: string }) => (await api.post<QuoteDetail>(`${ROOT}/items/${id}/status`, { status, reason })).data,
    onSuccess: (item) => refreshItems(queryClient, item.id),
  });
}

export function useSaveQuoteTranslation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ language, ...body }: { language: string; text: string; isPublished: boolean }) =>
      (await api.put<unknown>(`${ROOT}/items/${id}/translations/${language}`, body)).data,
    onSuccess: () => refreshItems(queryClient, id),
  });
}

export function useDeleteQuoteTranslation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (language: string) => (await api.delete<unknown>(`${ROOT}/items/${id}/translations/${language}`)).data,
    onSuccess: () => refreshItems(queryClient, id),
  });
}

export type StartQuoteInput = { language: string; force?: boolean; provider?: ProviderId; model?: string };

function putRun(queryClient: QueryClient, run: QuoteRun) {
  applyRun(queryClient, run);
  void queryClient.invalidateQueries({ queryKey: keys.runs });
  void queryClient.invalidateQueries({ queryKey: keys.overview });
}

export function useStartQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: StartQuoteInput) => (await api.post<QuoteRun>(`${ROOT}/runs`, input)).data,
    onSuccess: (run) => putRun(queryClient, run),
  });
}

export function useResumeQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.post<QuoteRun>(`${ROOT}/runs/${id}/resume`, {})).data,
    onSuccess: (run) => putRun(queryClient, run),
  });
}

export function useCancelQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.post<QuoteRun>(`${ROOT}/runs/${id}/cancel`, {})).data,
    onSuccess: (run) => putRun(queryClient, run),
  });
}

// ── Keeping the cache current ──────────────────────────────────────────────────────────────────────

const FEED_LIMIT = 200;

function applyRun(queryClient: QueryClient, run: QuoteRun) {
  queryClient.setQueryData<{ run: QuoteRun; feed: FeedLine[] }>(keys.run(run.id), (prev) => (prev ? { ...prev, run } : prev));
  queryClient.setQueryData<QuoteOverview>(keys.overview, (prev) => {
    if (!prev) return prev;
    const rest = prev.active.filter((item) => item.id !== run.id);
    if (!ACTIVE.includes(run.status)) return { ...prev, active: rest };
    const known = prev.active.some((item) => item.id === run.id);
    return { ...prev, active: known ? prev.active.map((item) => (item.id === run.id ? run : item)) : [...rest, run] };
  });
  queryClient.setQueriesData<QuoteRunPage>({ queryKey: keys.runs }, (prev) => {
    if (!prev || !prev.items.some((item) => item.id === run.id)) return prev;
    return { ...prev, items: prev.items.map((item) => (item.id === run.id ? run : item)) };
  });
}

/** Subscribes the page to the run and activity events and applies them to the query cache. Mount it once, at the top. */
export function useQuoteLive() {
  const queryClient = useQueryClient();

  useSocketEvent<QuoteRun>('quote.run', (run) => {
    if (!run?.id) return;
    const before = queryClient.getQueryData<QuoteOverview>(keys.overview)?.active.find((item) => item.id === run.id);
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
      void queryClient.invalidateQueries({ queryKey: ['quote', 'item'] });
    }
  });

  useSocketEvent<FeedLine & { runId: string }>('quote.activity', (line) => {
    if (!line?.runId) return;
    const { runId, ...entry } = line;
    queryClient.setQueryData<{ run: QuoteRun; feed: FeedLine[] }>(keys.run(runId), (prev) => {
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
