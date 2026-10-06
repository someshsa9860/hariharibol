import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { api } from './api';

export type Page<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
};

type Query = Record<string, string | number | boolean | undefined | null>;

// One hook for every "GET a page of X" admin endpoint — they all share the
// same {data, meta} envelope (backend/utils/pagination.js), so one generic
// covers books, verses, mantras, users, payments, audit… every list page.
export function useResourceList<T>(key: string, path: string, query: Query = {}, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [key, query],
    queryFn: async (): Promise<Page<T>> => {
      const res = await api.get<T[]>(path, query);
      const meta = (res.meta ?? {}) as Record<string, number>;
      return {
        items: res.data,
        page: meta.page ?? 1,
        pageSize: meta.pageSize ?? res.data.length,
        total: meta.total ?? res.data.length,
        totalPages: meta.totalPages ?? 1,
        hasMore: Boolean(meta.hasMore),
      };
    },
    enabled: options?.enabled,
    placeholderData: (prev) => prev,
  });
}

// For endpoints that just return an array or a plain object — dashboard
// stats, settings, jobs overview, role list, permission catalogue.
export function useResource<T>(key: unknown[], path: string, query?: Query, options?: Partial<UseQueryOptions<T>>) {
  return useQuery({
    queryKey: key,
    queryFn: async () => (await api.get<T>(path, query)).data,
    ...options,
  });
}

type MutationInput = { path: string; method: 'post' | 'patch' | 'put' | 'delete'; body?: unknown };

// Every write in the panel invalidates the list it belongs to — simpler than
// hand-updating cached pages, and these tables are small enough that a
// refetch is not something anyone will notice.
export function useResourceMutation(invalidateKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ path, method, body }: MutationInput) => api[method](path, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [invalidateKey] }),
  });
}
