// Everything the Hindu calendar's translation section asks of the API (backend/routes/admin/calendar-translation.js) and how
// it stays current. Built like lib/etiquette.ts: the database row is the truth, every view here is a query, and the
// websocket only makes the queries current sooner — the polling intervals cover a socket that is not there.

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api } from './api';
import { useOnReconnect, useSocketEvent, useSocketStatus, type SocketStatus } from './socket';
import type { FeedLine, RunStatus } from './translation';
import type { PickerProvider } from '@/components/model-picker';

export type CalendarRunStatus = RunStatus;
export const ACTIVE: CalendarRunStatus[] = ['QUEUED', 'RUNNING', 'PAUSED'];

export type PauseReason = 'credit' | 'auth' | 'config' | 'storage' | 'unavailable' | 'rate_limit' | 'busy' | 'error';
export type ProviderId = 'anthropic' | 'openai' | 'gemini';
export type ProviderInfo = PickerProvider & { id: ProviderId };

/** What a translated word is: a festival or day's name, a festival's description, or a panchang term (tithi, nakshatra…). */
export type WordKind = 'NAME' | 'DESCRIPTION' | 'TERM';
export const KIND_LABEL: Record<WordKind, string> = { NAME: 'Names', DESCRIPTION: 'Descriptions', TERM: 'Terms' };

export type LanguageCoverage = { code: string; name: string; endonym: string; translated: number; edited: number };

export type CalendarRun = {
  id: string;
  language: string;
  languageName: string;
  endonym: string;
  provider: ProviderId;
  model: string;
  force: boolean;
  status: CalendarRunStatus;
  pauseReason: PauseReason | null;
  statusMessage: string | null;
  stopReason: string | null;
  resumeAt: string | null;
  cancelRequested: boolean;
  progress: { total: number; done: number; percent: number; currentItem: string | null; etaSeconds: number | null };
  usage: { inputTokens: number; outputTokens: number; calls: number };
  attempts: number;
  requestedBy: { id: string; name: string | null } | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  heartbeatAt: string | null;
  stalled: boolean;
};

export type CalendarOverview = {
  languages: LanguageCoverage[];
  itemsTotal: number;
  itemsByKind: Record<WordKind, number>;
  translation: {
    providers: ProviderInfo[];
    defaultProvider: ProviderId;
    model: string;
    apiKeyConfigured: boolean;
    workerOnline: boolean | null;
    batchSize: number;
    promptVersion: string;
  };
  active: CalendarRun[];
};

export type WordState = 'translated' | 'missing' | 'edited';

export type WordRow = {
  kind: WordKind;
  /** For a term, what it is (a tithi, a nakshatra, a yoga…); null for a name or a description. */
  group: string | null;
  source: string;
  translation: null | { id: string; text: string; isEdited: boolean; translatedBy: string | null; updatedAt: string };
};

export type WordPage = { items: WordRow[]; page: number; pageSize: number; total: number; totalPages: number };
export type WordFilters = { language: string; kind: WordKind | ''; state: WordState | ''; q: string; page: number };

export type CalendarEstimate = {
  language: string;
  provider: ProviderId;
  model: string;
  willTranslate: number;
  byKind: Record<WordKind, number>;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  /** Rough, from the catalogue's prices; null for a model it has no price for. */
  costUsd: number | null;
  minutes: number;
  /** Why the model cannot run here, when it cannot. */
  unusable: string | null;
};

export type CalendarRunPage = { items: CalendarRun[]; page: number; pageSize: number; total: number; totalPages: number };

const ROOT = '/api/admin/panchang/translation';
export const keys = {
  all: ['calendar-translation'] as const,
  overview: ['calendar-translation', 'overview'] as const,
  words: ['calendar-translation', 'words'] as const,
  runs: ['calendar-translation', 'runs'] as const,
  run: (id: string) => ['calendar-translation', 'run', id] as const,
};

function pollMs(socket: SocketStatus, busy: boolean) {
  if (socket === 'live') return 30_000;
  return busy ? 4_000 : 15_000;
}

export function useCalendarOverview(enabled: boolean) {
  const socket = useSocketStatus();
  return useQuery({
    queryKey: keys.overview,
    queryFn: async () => (await api.get<CalendarOverview>(`${ROOT}/overview`)).data,
    enabled,
    refetchInterval: (query) => pollMs(socket, (query.state.data?.active.length ?? 0) > 0),
  });
}

export function useCalendarWords(filters: WordFilters, enabled: boolean) {
  return useQuery({
    queryKey: [...keys.words, filters],
    queryFn: async (): Promise<WordPage> => {
      const res = await api.get<WordRow[]>(`${ROOT}/items`, { language: filters.language, kind: filters.kind, state: filters.state, q: filters.q.trim(), page: filters.page, pageSize: 20 });
      const meta = (res.meta ?? {}) as Record<string, number>;
      return { items: res.data, page: meta.page ?? 1, pageSize: meta.pageSize ?? res.data.length, total: meta.total ?? res.data.length, totalPages: meta.totalPages ?? 1 };
    },
    enabled: enabled && !!filters.language,
    placeholderData: (prev) => prev,
  });
}

/** `model` blank asks for the provider's default. */
export function useCalendarEstimate(language: string, force: boolean, provider: ProviderId, model: string, enabled: boolean) {
  const modelName = model.trim();
  return useQuery({
    queryKey: ['calendar-translation', 'estimate', language, force, provider, modelName],
    queryFn: async () => (await api.get<CalendarEstimate>(`${ROOT}/estimate`, { language, force: force ? 'true' : 'false', provider, model: modelName })).data,
    enabled: enabled && !!language,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
}

export function useCalendarRuns(page: number, enabled: boolean) {
  const socket = useSocketStatus();
  return useQuery({
    queryKey: [...keys.runs, page],
    queryFn: async (): Promise<CalendarRunPage> => {
      const res = await api.get<CalendarRun[]>(`${ROOT}/runs`, { page, pageSize: 10 });
      const meta = (res.meta ?? {}) as Record<string, number>;
      return { items: res.data, page: meta.page ?? 1, pageSize: meta.pageSize ?? res.data.length, total: meta.total ?? res.data.length, totalPages: meta.totalPages ?? 1 };
    },
    enabled,
    placeholderData: (prev) => prev,
    refetchInterval: (query) => pollMs(socket, query.state.data?.items.some((run) => ACTIVE.includes(run.status)) ?? false),
  });
}

export function useCalendarRun(id: string | null) {
  const socket = useSocketStatus();
  return useQuery({
    queryKey: keys.run(id ?? ''),
    queryFn: async () => (await api.get<{ run: CalendarRun; feed: FeedLine[] }>(`${ROOT}/runs/${id}`)).data,
    enabled: !!id,
    refetchInterval: (query) => pollMs(socket, query.state.data ? ACTIVE.includes(query.state.data.run.status) : false),
  });
}

// ── Writes ─────────────────────────────────────────────────────────────────────────────────────────

/** A hand edit or a delete changes the words list and the coverage counts. */
function refreshWords(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: keys.words });
  void queryClient.invalidateQueries({ queryKey: keys.overview });
}

export function useSaveCalendarWord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { language: string; kind: WordKind; source: string; text: string }) => (await api.put<unknown>(`${ROOT}/items`, input)).data,
    onSuccess: () => refreshWords(queryClient),
  });
}

export function useDeleteCalendarWord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete<unknown>(`${ROOT}/items/${id}`)).data,
    onSuccess: () => refreshWords(queryClient),
  });
}

export type StartCalendarInput = { language: string; force?: boolean; provider?: ProviderId; model?: string };

function putRun(queryClient: QueryClient, run: CalendarRun) {
  applyRun(queryClient, run);
  void queryClient.invalidateQueries({ queryKey: keys.runs });
  void queryClient.invalidateQueries({ queryKey: keys.overview });
}

export function useStartCalendar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: StartCalendarInput) => (await api.post<CalendarRun>(`${ROOT}/runs`, input)).data,
    onSuccess: (run) => putRun(queryClient, run),
  });
}

export function useResumeCalendar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.post<CalendarRun>(`${ROOT}/runs/${id}/resume`, {})).data,
    onSuccess: (run) => putRun(queryClient, run),
  });
}

export function useCancelCalendar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.post<CalendarRun>(`${ROOT}/runs/${id}/cancel`, {})).data,
    onSuccess: (run) => putRun(queryClient, run),
  });
}

// ── Keeping the cache current ──────────────────────────────────────────────────────────────────────

const FEED_LIMIT = 200;

function applyRun(queryClient: QueryClient, run: CalendarRun) {
  queryClient.setQueryData<{ run: CalendarRun; feed: FeedLine[] }>(keys.run(run.id), (prev) => (prev ? { ...prev, run } : prev));
  queryClient.setQueryData<CalendarOverview>(keys.overview, (prev) => {
    if (!prev) return prev;
    const rest = prev.active.filter((item) => item.id !== run.id);
    if (!ACTIVE.includes(run.status)) return { ...prev, active: rest };
    const known = prev.active.some((item) => item.id === run.id);
    return { ...prev, active: known ? prev.active.map((item) => (item.id === run.id ? run : item)) : [...rest, run] };
  });
  queryClient.setQueriesData<CalendarRunPage>({ queryKey: keys.runs }, (prev) => {
    if (!prev || !prev.items.some((item) => item.id === run.id)) return prev;
    return { ...prev, items: prev.items.map((item) => (item.id === run.id ? run : item)) };
  });
}

/** Subscribes the page to the run and activity events and applies them to the query cache. Mount it once, at the top. */
export function useCalendarLive() {
  const queryClient = useQueryClient();

  useSocketEvent<CalendarRun>('calendar.run', (run) => {
    if (!run?.id) return;
    const before = queryClient.getQueryData<CalendarOverview>(keys.overview)?.active.find((item) => item.id === run.id);
    applyRun(queryClient, run);
    // A new run, or one that changed state, needs the lists looked at again; a plain progress tick needs only the bar.
    if (!before || before.status !== run.status) {
      void queryClient.invalidateQueries({ queryKey: keys.runs });
      void queryClient.invalidateQueries({ queryKey: keys.overview });
    }
    // Words were translated: the list and the coverage bars have changed.
    if ((before && run.progress.done !== before.progress.done) || !ACTIVE.includes(run.status)) {
      void queryClient.invalidateQueries({ queryKey: keys.words });
      void queryClient.invalidateQueries({ queryKey: keys.overview });
    }
  });

  useSocketEvent<FeedLine & { runId: string }>('calendar.activity', (line) => {
    if (!line?.runId) return;
    const { runId, ...entry } = line;
    queryClient.setQueryData<{ run: CalendarRun; feed: FeedLine[] }>(keys.run(runId), (prev) => {
      if (!prev || prev.feed.some((item) => item.at === entry.at && item.text === entry.text)) return prev;
      return { ...prev, feed: [entry, ...prev.feed].slice(0, FEED_LIMIT) };
    });
  });

  // Anything that happened while the socket was down was missed; ask for all of it again.
  useOnReconnect(() => {
    void queryClient.invalidateQueries({ queryKey: keys.all });
  });
}
