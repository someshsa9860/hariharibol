import { Input, Select } from '@/components/ui/input';
import type { DataTableState } from '@/lib/use-table';

// Filter controls for a DataTable's toolbar. Each reads and writes one URL
// param through the table, so there is no per-page filter state to keep.

type Option = { value: string; label: string };

/** A dropdown over a fixed or fetched list. The empty option is "no filter". */
export function FilterSelect<T>({
  table,
  name,
  label,
  options,
  className = 'w-40',
}: {
  table: DataTableState<T>;
  name: string;
  /** Shown when nothing is picked — "All roles". */
  label: string;
  options: (string | Option)[];
  className?: string;
}) {
  return (
    <Select
      value={table.filters[name] ?? ''}
      onChange={(e) => table.setFilter(name, e.target.value)}
      className={className}
      aria-label={label}
    >
      <option value="">{label}</option>
      {options.map((o) => {
        const opt = typeof o === 'string' ? { value: o, label: o } : o;
        return (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        );
      })}
    </Select>
  );
}

/** Any / Yes / No over a boolean the API filters with `?name=true|false`. */
export function FlagFilter<T>({
  table,
  name,
  label,
  yes = 'Yes',
  no = 'No',
  className = 'w-44',
}: {
  table: DataTableState<T>;
  name: string;
  label: string;
  yes?: string;
  no?: string;
  className?: string;
}) {
  return (
    <FilterSelect
      table={table}
      name={name}
      label={label}
      className={className}
      options={[
        { value: 'true', label: yes },
        { value: 'false', label: no },
      ]}
    />
  );
}

/** A from/to pair of `YYYY-MM-DD` filters — the format the API's `from`/`to` expect. */
export function DateRangeFilter<T>({
  table,
  from = 'from',
  to = 'to',
}: {
  table: DataTableState<T>;
  from?: string;
  to?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Input
        type="date"
        aria-label="From date"
        className="w-36"
        value={table.filters[from] ?? ''}
        max={table.filters[to] || undefined}
        onChange={(e) => table.setFilter(from, e.target.value)}
      />
      –
      <Input
        type="date"
        aria-label="To date"
        className="w-36"
        value={table.filters[to] ?? ''}
        min={table.filters[from] || undefined}
        onChange={(e) => table.setFilter(to, e.target.value)}
      />
    </div>
  );
}
