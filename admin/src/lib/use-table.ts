import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiRequestError } from './api';
import { useDebounced } from './use-debounced';
import { useResourceList } from './use-resource';

// Everything a list screen needs, in one hook: the page of rows, plus the
// state a datatable is made of — search, filters, sort, page size, selection,
// column visibility. Search, filters, sort and paging live in the URL, so a
// filtered view survives a refresh and can be pasted to a colleague. Selection
// and column choices do not: the first is momentary, the second is a personal
// preference kept in localStorage.

export type SortState = { key: string; dir: 'asc' | 'desc' };
export type Notice = { tone: 'success' | 'error'; text: string };

type Params = Record<string, string | number | boolean | undefined | null>;

export const PAGE_SIZES = [10, 20, 50, 100];
// "Export all" pages through the API 100 rows at a time; past this it stops
// rather than quietly downloading a hundred thousand rows into a browser tab.
export const EXPORT_CAP = 5000;
const BULK_BATCH = 5;

type Options = {
  /** react-query key, and the localStorage key for column visibility. */
  id: string;
  /** The `GET` list endpoint. */
  path: string;
  /** URL prefix when one page hosts several tables (`pay.status=…`). */
  scope?: string;
  /** Filter names kept in the URL. `q`, `page`, `size` and `sort` are reserved. */
  filters?: string[];
  /** Fixed query params that are not the user's to change (a `bookId` from a parent). */
  params?: Params;
  /** Must be a key the endpoint's sort whitelist accepts. Leave unset to keep the API's own order. */
  defaultSort?: SortState;
  pageSize?: number;
  enabled?: boolean;
};

const rowId = (row: unknown) => (row as { id: string | number }).id;

function readSort(raw: string | null): SortState | null {
  if (!raw) return null;
  return raw.startsWith('-') ? { key: raw.slice(1), dir: 'desc' } : { key: raw, dir: 'asc' };
}

const encodeSort = (sort: SortState) => (sort.dir === 'desc' ? `-${sort.key}` : sort.key);

function loadVisibility(storageKey: string): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

export function useDataTable<T>(options: Options) {
  const { id, path, scope, defaultSort, enabled, params: fixed } = options;
  const filterKeys = options.filters ?? [];
  const defaultPageSize = options.pageSize ?? 20;

  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const name = useCallback((key: string) => (scope ? `${scope}.${key}` : key), [scope]);

  // One URL write per gesture — react-router does not queue functional updates.
  const update = useCallback(
    (changes: Record<string, string | null>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(changes)) {
            if (value === null || value === '') next.delete(name(key));
            else next.set(name(key), value);
          }
          return next;
        },
        { replace: true }
      );
    },
    [setParams, name]
  );

  // ── selection ────────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<Map<string | number, T>>(new Map());
  const clearSelection = useCallback(() => setSelected(new Map()), []);

  // ── search ───────────────────────────────────────────────────────────────
  // The input is typed into `search`; the URL follows it 350ms later, and the
  // URL is what the query reads.
  const urlQ = params.get(name('q')) ?? '';
  const [search, setSearch] = useState(urlQ);
  const debouncedSearch = useDebounced(search);
  useEffect(() => {
    if (debouncedSearch === urlQ) return;
    update({ q: debouncedSearch, page: null });
    clearSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  // ── filters ──────────────────────────────────────────────────────────────
  const filters: Record<string, string> = {};
  for (const key of filterKeys) filters[key] = params.get(name(key)) ?? '';

  const setFilter = (key: string, value: string) => {
    update({ [key]: value, page: null });
    clearSelection();
  };

  const activeCount = filterKeys.filter((key) => filters[key]).length + (urlQ ? 1 : 0);

  // ── sort ─────────────────────────────────────────────────────────────────
  const urlSort = readSort(params.get(name('sort')));
  const sort = urlSort ?? defaultSort ?? null;

  const toggleSort = (key: string) => {
    const next: SortState =
      sort?.key === key ? { key, dir: sort.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' };
    const isDefault = defaultSort && next.key === defaultSort.key && next.dir === defaultSort.dir;
    update({ sort: isDefault ? null : encodeSort(next), page: null });
  };

  // ── paging ───────────────────────────────────────────────────────────────
  const pageNumber = Math.max(1, Number(params.get(name('page'))) || 1);
  const sizeParam = Number(params.get(name('size')));
  const pageSize = PAGE_SIZES.includes(sizeParam) ? sizeParam : defaultPageSize;

  const setPage = (page: number) => update({ page: page <= 1 ? null : String(page) });
  const setPageSize = (size: number) => update({ size: size === defaultPageSize ? null : String(size), page: null });

  // ── data ─────────────────────────────────────────────────────────────────
  const query: Params = {
    ...fixed,
    ...filters,
    q: urlQ || undefined,
    page: pageNumber,
    pageSize,
    sort: sort?.key,
    dir: sort?.dir,
  };
  const list = useResourceList<T>(id, path, query, { enabled });

  // A stale bookmark (`page=9` after the filters shrank the result) would show an
  // empty table with a pager that says there are rows — step back to page 1.
  const data = list.data;
  useEffect(() => {
    if (data && data.items.length === 0 && data.total > 0 && pageNumber > 1) update({ page: null });
  }, [data, pageNumber, update]);

  const reset = () => {
    const cleared: Record<string, string | null> = { q: null, page: null, sort: null };
    for (const key of filterKeys) cleared[key] = null;
    update(cleared);
    setSearch('');
    clearSelection();
  };

  const isCustomised = activeCount > 0 || urlSort !== null;

  // ── selection helpers ────────────────────────────────────────────────────
  const toggleRow = (row: T) =>
    setSelected((prev) => {
      const next = new Map(prev);
      const key = rowId(row);
      if (next.has(key)) next.delete(key);
      else next.set(key, row);
      return next;
    });

  const togglePage = (rows: T[]) =>
    setSelected((prev) => {
      const next = new Map(prev);
      const all = rows.length > 0 && rows.every((row) => next.has(rowId(row)));
      for (const row of rows) {
        if (all) next.delete(rowId(row));
        else next.set(rowId(row), row);
      }
      return next;
    });

  // ── column visibility ────────────────────────────────────────────────────
  const storageKey = `hhb_admin_cols:${id}`;
  const [visibility, setVisibility] = useState(() => loadVisibility(storageKey));

  const isVisible = (key: string, defaultHidden?: boolean) => visibility[key] ?? !defaultHidden;

  const setVisible = (key: string, visible: boolean) =>
    setVisibility((prev) => {
      const next = { ...prev, [key]: visible };
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Private mode / storage disabled — the choice just lasts until reload.
      }
      return next;
    });

  // ── bulk actions ─────────────────────────────────────────────────────────
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  /**
   * Runs `action` once per row (the API has almost no batch endpoints), five at
   * a time so a big selection doesn't trip the rate limiter. `label` is the
   * past tense of what happened — "Banned", "Published". Rows that succeed
   * leave the selection; rows that fail stay in it so the retry is one click.
   * Row-menu actions on a single row go through here too, so a failure is
   * reported instead of swallowed.
   */
  const runBulk = async (rows: T[], label: string, action: (row: T) => Promise<unknown>) => {
    setBusy(true);
    setNotice(null);
    const wasSelected = rows.some((row) => selected.has(rowId(row)));
    const failures: unknown[] = [];
    const done: T[] = [];

    for (let i = 0; i < rows.length; i += BULK_BATCH) {
      const batch = rows.slice(i, i + BULK_BATCH);
      const results = await Promise.allSettled(batch.map(action));
      results.forEach((result, j) => {
        if (result.status === 'fulfilled') done.push(batch[j]);
        else failures.push(result.reason);
      });
    }

    setSelected((prev) => {
      const next = new Map(prev);
      for (const row of done) next.delete(rowId(row));
      return next;
    });
    await queryClient.invalidateQueries({ queryKey: [id] });
    setBusy(false);

    if (failures.length === 0) {
      setNotice({ tone: 'success', text: `${label} ${done.length} ${done.length === 1 ? 'item' : 'items'}.` });
    } else {
      const first = failures[0];
      const why = first instanceof ApiRequestError ? first.message : 'request failed';
      setNotice({
        tone: 'error',
        text:
          `${label} ${done.length} of ${rows.length}; ${failures.length} failed (${why}).` +
          (wasSelected ? ' The failed rows are still selected.' : ''),
      });
    }
  };

  /**
   * For the few endpoints that take the whole selection in one call (verse
   * sloka eligibility). All-or-nothing: on failure nothing is deselected.
   */
  const runOnce = async (rows: T[], label: string, action: (rows: T[]) => Promise<unknown>) => {
    setBusy(true);
    setNotice(null);
    try {
      await action(rows);
      setSelected((prev) => {
        const next = new Map(prev);
        for (const row of rows) next.delete(rowId(row));
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: [id] });
      setNotice({ tone: 'success', text: `${label} ${rows.length} ${rows.length === 1 ? 'item' : 'items'}.` });
    } catch (error) {
      const why = error instanceof ApiRequestError ? error.message : 'request failed';
      setNotice({ tone: 'error', text: `Nothing changed — ${why}` });
    } finally {
      setBusy(false);
    }
  };

  // ── export ───────────────────────────────────────────────────────────────
  /** Every row matching the current search/filters/sort, up to EXPORT_CAP. */
  const fetchAll = async (): Promise<{ rows: T[]; truncated: boolean }> => {
    const rows: T[] = [];
    let hasMore = false;
    for (let page = 1; rows.length < EXPORT_CAP; page++) {
      const res = await api.get<T[]>(path, { ...query, page, pageSize: 100 });
      rows.push(...res.data);
      hasMore = Boolean((res.meta as { hasMore?: boolean } | undefined)?.hasMore);
      if (!hasMore) break;
    }
    return { rows: rows.slice(0, EXPORT_CAP), truncated: hasMore };
  };

  return {
    id,
    data,
    isLoading: list.isLoading,
    isError: list.isError,
    isFetching: list.isFetching,
    refetch: list.refetch,

    search,
    setSearch,
    filters,
    setFilter,
    activeCount,
    isCustomised,
    reset,

    sort,
    toggleSort,
    pageNumber,
    pageSize,
    setPage,
    setPageSize,

    selected,
    toggleRow,
    togglePage,
    clearSelection,

    isVisible,
    setVisible,

    busy,
    notice,
    setNotice,
    runBulk,
    runOnce,
    fetchAll,
  };
}

export type DataTableState<T> = ReturnType<typeof useDataTable<T>>;
