import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import type { Page } from '@/lib/use-resource';

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
};

export function DataTable<T>({
  columns,
  page,
  isLoading,
  isError,
  onPageChange,
  onRowClick,
  getRowKey = (row: T) => (row as { id: string | number }).id,
  emptyMessage = 'Nothing here yet.',
}: {
  columns: Column<T>[];
  page: Page<T> | undefined;
  isLoading: boolean;
  isError?: boolean;
  onPageChange?: (page: number) => void;
  onRowClick?: (row: T) => void;
  getRowKey?: (row: T) => string | number;
  emptyMessage?: string;
}) {
  const rows = page?.items ?? [];

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col.key} className={col.className}>
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading &&
            Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>
                {columns.map((col) => (
                  <TableCell key={col.key}>
                    <Skeleton className="h-4 w-full max-w-40" />
                  </TableCell>
                ))}
              </TableRow>
            ))}

          {!isLoading && isError && (
            <TableRow>
              <TableCell colSpan={columns.length} className="py-10 text-center text-sm text-destructive">
                Could not load this list.
              </TableCell>
            </TableRow>
          )}

          {!isLoading && !isError && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={columns.length} className="py-12">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Inbox className="h-6 w-6" />
                  <p className="text-sm">{emptyMessage}</p>
                </div>
              </TableCell>
            </TableRow>
          )}

          {!isLoading &&
            !isError &&
            rows.map((row) => (
              <TableRow
                key={getRowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={onRowClick ? 'cursor-pointer' : undefined}
              >
                {columns.map((col) => (
                  <TableCell key={col.key} className={col.className}>
                    {col.render(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
        </TableBody>
      </Table>

      {page && page.totalPages > 1 && onPageChange && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page.page} of {page.totalPages} · {page.total} total
          </span>
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={page.page <= 1}
              onClick={() => onPageChange(page.page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
            <Button variant="outline" size="sm" disabled={!page.hasMore} onClick={() => onPageChange(page.page + 1)}>
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
