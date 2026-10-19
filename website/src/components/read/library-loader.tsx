'use client';

import { Library } from './library';
import { ErrorState, PageLoading } from '@/components/ui/states';
import { useApi } from '@/lib/use-api';
import type { Book } from '@/lib/types';

/** The library, fetched in the browser — for when the server could not reach the API. */
export function LibraryLoader() {
  const books = useApi<Book[]>('/books?pageSize=100');
  if (books.loading) return <PageLoading />;
  if (!books.data) return <ErrorState message="The library could not be reached. Please check your connection." onRetry={books.reload} />;
  return <Library books={books.data} />;
}
