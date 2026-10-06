import { useState, type ReactNode } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Columns3,
  Download,
  Inbox,
  Loader2,
  RefreshCw,
  SearchX,
  X,
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SearchInput } from '@/components/search-input';
import { downloadCsv, toCsv } from '@/lib/csv';
import { EXPORT_CAP, PAGE_SIZES, type DataTableState } from '@/lib/use-table';
import { cn } from '@/lib/utils';

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  /** The API's sort key for this column — makes the header clickable. */
  sort?: string;
  /** The cell's value in a CSV export. Columns without it are left out of the file. */
  csv?: (row: T) => unknown;
  /** Off until someone turns it on in the Columns menu — for the long tail (ids, timestamps). */
  defaultHidden?: boolean;
  /** Can't be hidden. Columns with no header (the row-actions menu) never can. */
  fixed?: boolean;
};

const rowKeyOf = (row: unknown) => (row as { id: string | number }).id;

/** 1 … 4 5 [6] 7 8 … 20 */
function pageWindow(current: number, last: number): (number | 'gap-start' | 'gap-end')[] {
  const pages = new Set([1, last, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= last).sort((a, b) => a - b);
  const out: (number | 'gap-start' | 'gap-end')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(i === 1 ? 'gap-start' : 'gap-end');
    out.push(p);
  });
  return out;
}

export function DataTable<T>({
  table,
  columns,
  searchPlaceholder,
  filters,
  actions,
  bulkActions,
  exportName,
  onRowClick,
  rowClassName,
  emptyMessage = 'Nothing here yet.',
}: {
  table: DataTableState<T>;
  columns: Column<T>[];
  /** Shows the search box. Leave out for endpoints that take no `q`. */
  searchPlaceholder?: string;
  /** Filter controls, rendered beside the search box (see table-filters.tsx). */
  filters?: ReactNode;
  /** Buttons on the right of the toolbar — "New …". */
  actions?: ReactNode;
  /** Adds a checkbox column and, once rows are ticked, a bar of these buttons. */
  bulkActions?: (rows: T[]) => ReactNode;
  /** Adds the Export menu; the CSV is named after this. */
  exportName?: string;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
  emptyMessage?: string;
}) {
  const [exporting, setExporting] = useState(false);

  const data = table.data;
  const rows = data?.items ?? [];
  const visible = columns.filter((col) => col.fixed || !col.header || table.isVisible(col.key, col.defaultHidden));
  const hideable = columns.filter((col) => col.header && !col.fixed);
  const exportable = columns.filter((col) => col.csv);
  const selectable = Boolean(bulkActions);
  const colSpan = visible.length + (selectable ? 1 : 0);

  const selectedRows = [...table.selected.values()];
  const allOnPage = rows.length > 0 && rows.every((row) => table.selected.has(rowKeyOf(row)));
  const someOnPage = rows.some((row) => table.selected.has(rowKeyOf(row)));

  async function exportRows(scope: 'page' | 'selected' | 'all') {
    setExporting(true);
    try {
      let source: T[];
      let note = '';
      if (scope === 'page') source = rows;
      else if (scope === 'selected') source = selectedRows;
      else {
        const all = await table.fetchAll();
        source = all.rows;
        if (all.truncated) note = ` Stopped at the first ${EXPORT_CAP.toLocaleString()} rows — narrow the filters to get the rest.`;
      }
      downloadCsv(
        exportName ?? 'export',
        toCsv(
          exportable.map((col) => col.header),
          source.map((row) => exportable.map((col) => col.csv!(row)))
        )
      );
      table.setNotice({ tone: 'success', text: `Exported ${source.length.toLocaleString()} rows.${note}` });
    } catch {
      table.setNotice({ tone: 'error', text: 'Export failed. Try again, or narrow the filters.' });
    } finally {
      setExporting(false);
    }
  }

  const from = data && data.total > 0 ? (data.page - 1) * data.pageSize + 1 : 0;
  const to = data ? Math.min(data.page * data.pageSize, data.total) : 0;

  return (
    <div className="space-y-3">
      {/* ── toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {searchPlaceholder && <SearchInput value={table.search} onChange={table.setSearch} placeholder={searchPlaceholder} />}
        {filters}
        {table.isCustomised && (
          <Button variant="ghost" size="sm" onClick={table.reset}>
            <X className="h-4 w-4" />
            Reset{table.activeCount > 0 && ` (${table.activeCount})`}
          </Button>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" title="Refresh" aria-label="Refresh" onClick={() => table.refetch()}>
            <RefreshCw className={cn('h-4 w-4', table.isFetching && 'animate-spin')} />
          </Button>

          {hideable.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Columns3 className="h-4 w-4" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Show columns</DropdownMenuLabel>
                {hideable.map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col.key}
                    checked={table.isVisible(col.key, col.defaultHidden)}
                    onCheckedChange={(checked) => table.setVisible(col.key, Boolean(checked))}
                  >
                    {col.header}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {exportName && exportable.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={exporting || !data || data.total === 0}>
                  {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Download CSV</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => exportRows('page')}>This page ({rows.length})</DropdownMenuItem>
                {table.selected.size > 0 && (
                  <DropdownMenuItem onClick={() => exportRows('selected')}>Selected ({table.selected.size})</DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => exportRows('all')}>
                  All matching ({(data?.total ?? 0).toLocaleString()})
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <p className="px-2 py-1 text-xs text-muted-foreground">Includes hidden columns.</p>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {actions}
        </div>
      </div>

      {/* ── notice from the last bulk action / export ───────────────────── */}
      {table.notice && (
        <div
          role="status"
          className={cn(
            'flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm',
            table.notice.tone === 'error'
              ? 'border-destructive/40 bg-destructive/10 text-destructive'
              : 'border-success/40 bg-success/10'
          )}
        >
          <span>{table.notice.text}</span>
          <button aria-label="Dismiss" className="shrink-0 opacity-70 hover:opacity-100" onClick={() => table.setNotice(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── bulk bar ────────────────────────────────────────────────────── */}
      {selectable && selectedRows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
          <span className="font-medium">{selectedRows.length} selected</span>
          <div className="flex flex-wrap items-center gap-2">{table.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : bulkActions!(selectedRows)}</div>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={table.clearSelection} disabled={table.busy}>
            Clear selection
          </Button>
        </div>
      )}

      {/* ── table ───────────────────────────────────────────────────────── */}
      <div className={cn('transition-opacity', table.isFetching && !table.isLoading && 'opacity-60')}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {selectable && (
                <TableHead className="w-10">
                  <Checkbox
                    aria-label="Select all rows on this page"
                    checked={allOnPage}
                    indeterminate={someOnPage && !allOnPage}
                    onChange={() => table.togglePage(rows)}
                    disabled={rows.length === 0}
                  />
                </TableHead>
              )}
              {visible.map((col) => {
                const active = col.sort !== undefined && table.sort?.key === col.sort ? table.sort : null;
                return (
                  <TableHead
                    key={col.key}
                    className={col.className}
                    aria-sort={active ? (active.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  >
                    {col.sort ? (
                      <button
                        type="button"
                        onClick={() => table.toggleSort(col.sort!)}
                        className={cn(
                          '-mx-1.5 inline-flex items-center gap-1 rounded px-1.5 py-1 uppercase tracking-wide transition-colors hover:bg-muted hover:text-foreground',
                          active && 'text-foreground'
                        )}
                      >
                        {col.header}
                        {active ? (
                          active.dir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.isLoading &&
              Array.from({ length: Math.min(table.pageSize, 8) }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: colSpan }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full max-w-40" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {!table.isLoading && table.isError && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={colSpan} className="py-10 text-center text-sm text-destructive">
                  Could not load this list.{' '}
                  <button className="underline" onClick={() => table.refetch()}>
                    Try again
                  </button>
                </TableCell>
              </TableRow>
            )}

            {!table.isLoading && !table.isError && rows.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={colSpan} className="py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    {table.isCustomised ? <SearchX className="h-6 w-6" /> : <Inbox className="h-6 w-6" />}
                    <p className="text-sm">{table.isCustomised ? 'Nothing matches the current search and filters.' : emptyMessage}</p>
                    {table.isCustomised && (
                      <Button variant="outline" size="sm" onClick={table.reset}>
                        Clear search and filters
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}

            {!table.isLoading &&
              !table.isError &&
              rows.map((row) => {
                const isSelected = table.selected.has(rowKeyOf(row));
                return (
                  <TableRow
                    key={rowKeyOf(row)}
                    data-state={isSelected ? 'selected' : undefined}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(onRowClick && 'cursor-pointer', isSelected && 'bg-muted/60', rowClassName?.(row))}
                  >
                    {selectable && (
                      <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
                        <Checkbox aria-label="Select row" checked={isSelected} onChange={() => table.toggleRow(row)} />
                      </TableCell>
                    )}
                    {visible.map((col) => (
                      <TableCell key={col.key} className={col.className}>
                        {col.render(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </div>

      {/* ── footer ──────────────────────────────────────────────────────── */}
      {data && data.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>
            {from.toLocaleString()}–{to.toLocaleString()} of {data.total.toLocaleString()}
          </span>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2">
              Rows
              <Select
                value={table.pageSize}
                onChange={(e) => table.setPageSize(Number(e.target.value))}
                className="h-8 w-[4.5rem] px-2"
                aria-label="Rows per page"
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </Select>
            </label>

            {data.totalPages > 1 && (
              <nav className="flex items-center gap-1" aria-label="Pagination">
                <Button variant="outline" size="icon" className="h-8 w-8" aria-label="First page" disabled={data.page <= 1} onClick={() => table.setPage(1)}>
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Previous page" disabled={data.page <= 1} onClick={() => table.setPage(data.page - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {pageWindow(data.page, data.totalPages).map((p) =>
                  typeof p === 'number' ? (
                    <Button
                      key={p}
                      variant={p === data.page ? 'default' : 'outline'}
                      size="icon"
                      className="h-8 min-w-8 px-2"
                      aria-current={p === data.page ? 'page' : undefined}
                      onClick={() => table.setPage(p)}
                    >
                      {p}
                    </Button>
                  ) : (
                    <span key={p} className="px-1">
                      …
                    </span>
                  )
                )}
                <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Next page" disabled={data.page >= data.totalPages} onClick={() => table.setPage(data.page + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Last page" disabled={data.page >= data.totalPages} onClick={() => table.setPage(data.totalPages)}>
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </nav>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
