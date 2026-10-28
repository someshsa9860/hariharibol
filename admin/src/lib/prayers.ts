// Everything the Prayers page asks of the API (backend/routes/admin/prayer.js) and how it stays current. Built like
// lib/etiquette.ts (the items) and lib/calendar-translation.ts (the runs): the database row is the truth, every view here is
// a query, and the websocket only makes the queries current sooner — the polling intervals cover a socket that is not there.

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api } from './api';
import { ACTIVE, type PauseReason, type ProviderId, type ProviderInfo } from './calendar-translation';
import { useOnReconnect, useSocketEvent, useSocketStatus, type SocketStatus } from './socket';
import type { FeedLine, RunStatus } from './translation';

export { ACTIVE };
export type { PauseReason, ProviderId, ProviderInfo };

export type PrayerStatus = 'PUBLISHED' | 'DRAFT';
export const STATUS_LABEL: Record<PrayerStatus, string> = { PUBLISHED: 'Published', DRAFT: 'Draft' };
export const STATUS_VARIANT: Record<PrayerStatus, 'success' | 'secondary'> = { PUBLISHED: 'success', DRAFT: 'secondary' };

/** How a language gets its script for a prayer, decided by the server from the prayer's original language. */
export type HowText = 'same' | 'rule' | 'model';
export const HOW_LABEL: Record<HowText, string> = { same: 'Same script', rule: 'Automatic', model: 'AI' };
export const HOW_HINT: Record<HowText, string> = {
  same: 'Written in the same script as the original, so nothing is converted.',
  rule: 'Converted from the original by a rule when it is read; a verse can be overridden by hand.',
  model: 'Written by the AI (or by hand): the rule would not do this one well enough.',
};

/** The starter categories (backend/config/prayer.js). The overview's own list wins when it has one. */
export const PRAYER_CATEGORIES: { id: string; name: string }[] = [
  { id: 'morning', name: 'Morning prayers' },
  { id: 'evening', name: 'Evening prayers' },
  { id: 'meals', name: 'Before and after meals' },
  { id: 'guru', name: 'Guru and the lineage' },
  { id: 'deity', name: 'Prayers to a deity' },
  { id: 'aarti', name: 'Aartis' },
  { id: 'peace', name: 'Peace and protection' },
  { id: 'other', name: 'Other' },
];

/** The languages a prayer can be written in (its verses' script). */
export const ORIGINAL_LANGUAGES: { code: string; name: string }[] = [
  { code: 'sa', name: 'Sanskrit' },
  { code: 'hi', name: 'Hindi' },
  { code: 'mr', name: 'Marathi' },
  { code: 'bn', name: 'Bengali' },
  { code: 'as', name: 'Assamese' },
  { code: 'gu', name: 'Gujarati' },
  { code: 'ta', name: 'Tamil' },
  { code: 'te', name: 'Telugu' },
  { code: 'kn', name: 'Kannada' },
  { code: 'ml', name: 'Malayalam' },
  { code: 'or', name: 'Odia' },
  { code: 'pa', name: 'Punjabi' },
];

export const languageName = (code: string) => ORIGINAL_LANGUAGES.find((l) => l.code === code)?.name ?? (code === 'en' ? 'English' : code);

export type PrayerRunStatus = RunStatus;

export type CategoryInfo = { id: string; name: string; published: number; total: number };

/** What one language's coverage says; `how` is what the language needs for a Devanagari original (the usual case). */
export type LanguageCoverage = {
  code: string;
  name: string;
  endonym: string;
  how: HowText | Partial<Record<HowText, number>>;
  translated: number;
  partial: number;
  missing: number;
  stale: number;
  edited: number;
};

export type PrayerRun = {
  id: string;
  language: string;
  languageName: string;
  endonym: string;
  provider: ProviderId;
  model: string;
  force: boolean;
  status: PrayerRunStatus;
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

export type PrayerOverview = {
  counts: { published: number; draft: number; total: number; verses: number };
  categories: CategoryInfo[];
  languages: LanguageCoverage[];
  publishedTotal: number;
  translation: {
    providers: ProviderInfo[];
    defaultProvider: ProviderId;
    model: string;
    apiKeyConfigured: boolean;
    workerOnline: boolean | null;
    batchSize?: number;
    promptVersion?: string;
  };
  active: PrayerRun[];
};

export type PrayerRow = {
  id: string;
  slug: string;
  category: string;
  sortOrder: number;
  originalLanguage: string;
  title: string;
  summary: string | null;
  status: PrayerStatus;
  verseCount: number;
  /** How many languages have a translated title (a header row). */
  translatedLanguages: number;
  updatedAt: string;
};

export type PrayerVerse = { id: string; position: number; text: string; meaning: string | null };

/** One language in a prayer's `Languages` tab list. */
export type LanguageSummary = {
  code: string;
  name?: string;
  how: HowText;
  header: boolean;
  headerEdited: boolean;
  /** Verses that have a meaning in this language. */
  meanings: number;
  /** Verses that have a stored rendering in this language's script. */
  texts: number;
  /** Rows a person wrote or corrected. */
  edited: number;
  /** Stored renderings older than the original's last change. */
  stale: number;
};

export type PrayerDetail = {
  id: string;
  slug: string;
  category: string;
  sortOrder: number;
  originalLanguage: string;
  title: string;
  summary: string | null;
  about: string | null;
  author: string | null;
  reference: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  status: PrayerStatus;
  createdAt: string;
  updatedAt: string;
  verses: PrayerVerse[];
  languages: LanguageSummary[];
};

export type PrayerInput = {
  category: string;
  originalLanguage: string;
  title: string;
  summary?: string | null;
  about?: string | null;
  author?: string | null;
  reference?: string | null;
  sourceName?: string | null;
  sourceUrl?: string | null;
  sortOrder?: number;
  /** On create only: a pasted prayer is one request. */
  verses?: { text: string; meaning: string }[];
};

/** What the verses editor sends: the whole list, in display order. A row without an id is new. */
export type VerseInput = { id?: string; text: string; meaning: string };

export type LanguageHeader = { title: string; summary: string | null; about: string | null; translatedBy?: string | null; isEdited?: boolean };

export type LanguageVerse = {
  verseId: string;
  position: number;
  original: string;
  /** The rule's output when `how` is `rule`, else null — the admin needs no converter of its own. */
  automatic: string | null;
  text: string | null;
  meaning: string | null;
  isEdited: boolean;
  translatedBy: string | null;
  stale: boolean;
};

export type LanguageDetail = { language: string; how: HowText; header: LanguageHeader | null; verses: LanguageVerse[] };

export type LanguageSave = {
  header?: { title: string; summary: string; about: string };
  verses: { verseId: string; text?: string; meaning?: string }[];
};

export type PrayerEstimate = {
  language: string;
  provider: ProviderId;
  model: string;
  willTranslate: number;
  byPiece: { headers: number; renderings: number; meanings: number };
  requests: number;
  inputTokens: number;
  outputTokens: number;
  /** Rough, from the catalogue's prices; null for a model it has no price for. */
  costUsd: number | null;
  minutes: number;
  /** Why the model cannot run here, when it cannot. */
  unusable: string | null;
};

export type PrayerRunPage = { items: PrayerRun[]; page: number; pageSize: number; total: number; totalPages: number };

const ROOT = '/api/admin/prayers';
export const keys = {
  all: ['prayers'] as const,
  overview: ['prayers', 'overview'] as const,
  runs: ['prayers', 'runs'] as const,
  run: (id: string) => ['prayers', 'run', id] as const,
  item: (id: string) => ['prayers', 'item', id] as const,
  language: (id: string, language: string) => ['prayers', 'item', id, 'language', language] as const,
};

/** The key the prayers table (`useDataTable({ id })`) caches under — a write refreshes the table through it. */
export const TABLE_ID = 'prayers-items';

function pollMs(socket: SocketStatus, busy: boolean) {
  if (socket === 'live') return 30_000;
  return busy ? 4_000 : 15_000;
}

/** The categories to offer: the overview's when it sends them (so a renamed one shows), else the starter set. */
export function categoriesOf(overview?: PrayerOverview): { id: string; name: string }[] {
  return overview?.categories?.length ? overview.categories.map(({ id, name }) => ({ id, name })) : PRAYER_CATEGORIES;
}

export function categoryName(id: string, overview?: PrayerOverview) {
  return categoriesOf(overview).find((c) => c.id === id)?.name ?? id;
}

/** A language's badge in the item's Languages tab, from what the server counted. */
export type LanguageState = 'complete' | 'partial' | 'none' | 'stale';
export const STATE_LABEL: Record<LanguageState, string> = { complete: 'Complete', partial: 'Partial', none: 'None', stale: 'Out of date' };
export const STATE_VARIANT: Record<LanguageState, 'success' | 'warning' | 'secondary' | 'destructive'> = { complete: 'success', partial: 'warning', none: 'secondary', stale: 'destructive' };

export function languageState(lang: LanguageSummary, verses: PrayerVerse[]): LanguageState {
  if (lang.stale > 0) return 'stale';
  const withMeaning = verses.filter((v) => (v.meaning ?? '').trim()).length;
  const headerOk = lang.code === 'en' || lang.header;
  const textsOk = lang.how !== 'model' || lang.texts >= verses.length;
  const meaningsOk = lang.code === 'en' || lang.meanings >= withMeaning;
  if (headerOk && textsOk && meaningsOk) return 'complete';
  return lang.header || lang.texts > 0 || lang.meanings > 0 ? 'partial' : 'none';
}

// ── Reads ──────────────────────────────────────────────────────────────────────────────────────────

export function usePrayerOverview(enabled = true) {
  const socket = useSocketStatus();
  return useQuery({
    queryKey: keys.overview,
    queryFn: async () => (await api.get<PrayerOverview>(`${ROOT}/overview`)).data,
    enabled,
    refetchInterval: (query) => pollMs(socket, (query.state.data?.active?.length ?? 0) > 0),
  });
}

export function usePrayer(id: string | null) {
  return useQuery({
    queryKey: keys.item(id ?? ''),
    queryFn: async () => (await api.get<PrayerDetail>(`${ROOT}/items/${id}`)).data,
    enabled: !!id,
  });
}

export function usePrayerLanguage(id: string, language: string) {
  return useQuery({
    queryKey: keys.language(id, language),
    queryFn: async () => (await api.get<LanguageDetail>(`${ROOT}/items/${id}/translations/${language}`)).data,
    enabled: !!id && !!language,
  });
}

/** `model` blank asks for the provider's default. */
export function usePrayerEstimate(language: string, force: boolean, provider: ProviderId, model: string, enabled: boolean) {
  const modelName = model.trim();
  return useQuery({
    queryKey: ['prayers', 'estimate', language, force, provider, modelName],
    queryFn: async () => (await api.get<PrayerEstimate>(`${ROOT}/estimate`, { language, force: force ? 'true' : 'false', provider, model: modelName })).data,
    enabled: enabled && !!language,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
}

export function usePrayerRuns(page: number, enabled: boolean) {
  const socket = useSocketStatus();
  return useQuery({
    queryKey: [...keys.runs, page],
    queryFn: async (): Promise<PrayerRunPage> => {
      const res = await api.get<PrayerRun[]>(`${ROOT}/runs`, { page, pageSize: 10 });
      const meta = (res.meta ?? {}) as Record<string, number>;
      return { items: res.data, page: meta.page ?? 1, pageSize: meta.pageSize ?? res.data.length, total: meta.total ?? res.data.length, totalPages: meta.totalPages ?? 1 };
    },
    enabled,
    placeholderData: (prev) => prev,
    refetchInterval: (query) => pollMs(socket, query.state.data?.items.some((run) => ACTIVE.includes(run.status)) ?? false),
  });
}

export function usePrayerRun(id: string | null) {
  const socket = useSocketStatus();
  return useQuery({
    queryKey: keys.run(id ?? ''),
    queryFn: async () => (await api.get<{ run: PrayerRun; feed: FeedLine[] }>(`${ROOT}/runs/${id}`)).data,
    enabled: !!id,
    refetchInterval: (query) => pollMs(socket, query.state.data ? ACTIVE.includes(query.state.data.run.status) : false),
  });
}

// ── Writes ─────────────────────────────────────────────────────────────────────────────────────────

/** A change to a prayer (or its translations) refreshes the table, the prayer, and the overview's counts and coverage. */
function refreshItems(queryClient: QueryClient, id?: string) {
  void queryClient.invalidateQueries({ queryKey: [TABLE_ID] });
  void queryClient.invalidateQueries({ queryKey: keys.overview });
  if (id) void queryClient.invalidateQueries({ queryKey: keys.item(id) });
}

export function useCreatePrayer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: PrayerInput) => (await api.post<PrayerDetail>(`${ROOT}/items`, input)).data,
    onSuccess: (item) => refreshItems(queryClient, item.id),
  });
}

export function useUpdatePrayer(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<PrayerInput>) => (await api.patch<PrayerDetail>(`${ROOT}/items/${id}`, input)).data,
    onSuccess: () => refreshItems(queryClient, id),
  });
}

/** Saves the whole list of verses and answers with the saved list, so new rows have their ids. */
export function useSavePrayerVerses(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (verses: VerseInput[]): Promise<PrayerVerse[]> => {
      const body = (await api.put<PrayerVerse[] | { verses: PrayerVerse[] }>(`${ROOT}/items/${id}/verses`, { verses })).data;
      return Array.isArray(body) ? body : body.verses;
    },
    onSuccess: () => refreshItems(queryClient, id),
  });
}

export function useSetPrayerStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: PrayerStatus }) => (await api.post<PrayerDetail>(`${ROOT}/items/${id}/status`, { status })).data,
    onSuccess: (item, { id }) => refreshItems(queryClient, item?.id ?? id),
  });
}

export function useDeletePrayer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete<unknown>(`${ROOT}/items/${id}`)).data,
    onSuccess: (_data, id) => {
      refreshItems(queryClient);
      queryClient.removeQueries({ queryKey: keys.item(id) });
    },
  });
}

export function useSavePrayerLanguage(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ language, ...body }: LanguageSave & { language: string }) => (await api.put<unknown>(`${ROOT}/items/${id}/translations/${language}`, body)).data,
    onSuccess: (_data, { language }) => {
      refreshItems(queryClient, id);
      void queryClient.invalidateQueries({ queryKey: keys.language(id, language) });
    },
  });
}

export function useDeletePrayerLanguage(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (language: string) => (await api.delete<unknown>(`${ROOT}/items/${id}/translations/${language}`)).data,
    onSuccess: (_data, language) => {
      refreshItems(queryClient, id);
      void queryClient.invalidateQueries({ queryKey: keys.language(id, language) });
    },
  });
}

export type StartPrayerInput = { language: string; force?: boolean; provider?: ProviderId; model?: string };

function putRun(queryClient: QueryClient, run: PrayerRun) {
  applyRun(queryClient, run);
  void queryClient.invalidateQueries({ queryKey: keys.runs });
  void queryClient.invalidateQueries({ queryKey: keys.overview });
}

export function useStartPrayer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: StartPrayerInput) => (await api.post<PrayerRun>(`${ROOT}/runs`, input)).data,
    onSuccess: (run) => putRun(queryClient, run),
  });
}

export function useResumePrayer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.post<PrayerRun>(`${ROOT}/runs/${id}/resume`, {})).data,
    onSuccess: (run) => putRun(queryClient, run),
  });
}

export function useCancelPrayer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.post<PrayerRun>(`${ROOT}/runs/${id}/cancel`, {})).data,
    onSuccess: (run) => putRun(queryClient, run),
  });
}

// ── Keeping the cache current ──────────────────────────────────────────────────────────────────────

const FEED_LIMIT = 200;

function applyRun(queryClient: QueryClient, run: PrayerRun) {
  queryClient.setQueryData<{ run: PrayerRun; feed: FeedLine[] }>(keys.run(run.id), (prev) => (prev ? { ...prev, run } : prev));
  queryClient.setQueryData<PrayerOverview>(keys.overview, (prev) => {
    if (!prev) return prev;
    const rest = prev.active.filter((item) => item.id !== run.id);
    if (!ACTIVE.includes(run.status)) return { ...prev, active: rest };
    const known = prev.active.some((item) => item.id === run.id);
    return { ...prev, active: known ? prev.active.map((item) => (item.id === run.id ? run : item)) : [...rest, run] };
  });
  queryClient.setQueriesData<PrayerRunPage>({ queryKey: keys.runs }, (prev) => {
    if (!prev || !prev.items.some((item) => item.id === run.id)) return prev;
    return { ...prev, items: prev.items.map((item) => (item.id === run.id ? run : item)) };
  });
}

/** Subscribes the page to the run and activity events and applies them to the query cache. Mount it once, at the top. */
export function usePrayersLive() {
  const queryClient = useQueryClient();

  useSocketEvent<PrayerRun>('prayer.run', (run) => {
    if (!run?.id) return;
    const before = queryClient.getQueryData<PrayerOverview>(keys.overview)?.active.find((item) => item.id === run.id);
    applyRun(queryClient, run);
    // A new run, or one that changed state, needs the lists looked at again; a plain progress tick needs only the bar.
    if (!before || before.status !== run.status) {
      void queryClient.invalidateQueries({ queryKey: keys.runs });
      void queryClient.invalidateQueries({ queryKey: keys.overview });
    }
    // Prayers were translated: the table's language counts, the coverage bars and any open prayer have changed.
    if ((before && run.progress.done !== before.progress.done) || !ACTIVE.includes(run.status)) {
      void queryClient.invalidateQueries({ queryKey: [TABLE_ID] });
      void queryClient.invalidateQueries({ queryKey: keys.overview });
      void queryClient.invalidateQueries({ queryKey: ['prayers', 'item'] });
    }
  });

  useSocketEvent<FeedLine & { runId: string }>('prayer.activity', (line) => {
    if (!line?.runId) return;
    const { runId, ...entry } = line;
    queryClient.setQueryData<{ run: PrayerRun; feed: FeedLine[] }>(keys.run(runId), (prev) => {
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
