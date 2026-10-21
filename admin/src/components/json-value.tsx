/** Pretty-prints a JSON-ish value (audit diffs, webhook payloads, notification data) for a detail field. */
export function JsonValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>;
  return (
    <pre className="max-h-48 overflow-auto rounded-md bg-muted/60 p-2.5 text-xs">{JSON.stringify(value, null, 2)}</pre>
  );
}
