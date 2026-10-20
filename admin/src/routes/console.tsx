import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Play, Database, TerminalSquare, Table2 } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { api, ApiRequestError } from '@/lib/api';
import { useResource } from '@/lib/use-resource';
import { cn } from '@/lib/utils';

type Risk = 'safe' | 'caution' | 'danger';
type Command = {
  id: string;
  title: string;
  description: string;
  risk: Risk;
  params: { name: string; label: string; placeholder?: string; required: boolean }[];
  available: boolean;
  unavailableReason: string | null;
};
type Run = {
  id: string;
  commandId: string;
  title: string;
  status: 'running' | 'succeeded' | 'failed' | 'timeout';
  exitCode: number | null;
  startedAt: string;
  finishedAt: string | null;
  truncated: boolean;
  output?: string;
};
type CommandList = { commands: Command[]; recent: Run[]; activeRunId: string | null };

const riskBadge: Record<Risk, { label: string; variant: 'success' | 'warning' | 'destructive' }> = {
  safe: { label: 'Read / safe', variant: 'success' },
  caution: { label: 'Changes data', variant: 'warning' },
  danger: { label: 'Dangerous', variant: 'destructive' },
};

const statusVariant = { running: 'warning', succeeded: 'success', failed: 'destructive', timeout: 'destructive' } as const;

const errorText = (err: unknown) => (err instanceof ApiRequestError ? err.message : 'Something went wrong');

function CommandsTab() {
  const queryClient = useQueryClient();
  const list = useResource<CommandList>(['console-commands'], '/api/admin/console/commands');
  const [values, setValues] = useState<Record<string, Record<string, string>>>({});
  const [runId, setRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useQuery({
    queryKey: ['console-run', runId],
    enabled: !!runId,
    queryFn: async () => (await api.get<Run>(`/api/admin/console/runs/${runId}`)).data,
    refetchInterval: (query) => (query.state.data?.status === 'running' ? 1500 : false),
  });

  const start = useMutation({
    mutationFn: async (cmd: Command) =>
      (await api.post<Run>(`/api/admin/console/commands/${cmd.id}/run`, { params: values[cmd.id] ?? {} })).data,
    onSuccess: (started) => {
      setError(null);
      setRunId(started.id);
      queryClient.invalidateQueries({ queryKey: ['console-commands'] });
    },
    onError: (err) => setError(errorText(err)),
  });

  const busy = run.data?.status === 'running' || !!list.data?.activeRunId;

  function launch(cmd: Command) {
    if (cmd.risk !== 'safe' && !window.confirm(`Run "${cmd.title}" on the live backend?\n\n${cmd.description}`)) return;
    start.mutate(cmd);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="space-y-3">
        {list.isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
        {list.data?.commands.map((cmd) => (
          <Card key={cmd.id}>
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="text-foreground">{cmd.title}</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">{cmd.description}</p>
              </div>
              <Badge variant={riskBadge[cmd.risk].variant}>{riskBadge[cmd.risk].label}</Badge>
            </CardHeader>
            <CardContent className="space-y-2 pb-4">
              {cmd.params.map((p) => (
                <div key={p.name} className="space-y-1">
                  <Label>{p.label}</Label>
                  <Input
                    placeholder={p.placeholder}
                    value={values[cmd.id]?.[p.name] ?? ''}
                    onChange={(e) => setValues((v) => ({ ...v, [cmd.id]: { ...v[cmd.id], [p.name]: e.target.value } }))}
                  />
                </div>
              ))}
              {!cmd.available && <p className="text-xs text-muted-foreground">{cmd.unavailableReason}</p>}
              <Button size="sm" variant={cmd.risk === 'danger' ? 'destructive' : 'default'} disabled={!cmd.available || busy || start.isPending} onClick={() => launch(cmd)}>
                <Play /> Run
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-3">
        {error && <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-foreground">{run.data ? run.data.title : 'Output'}</CardTitle>
            {run.data && (
              <Badge variant={statusVariant[run.data.status]}>
                {run.data.status}
                {run.data.exitCode !== null && ` · exit ${run.data.exitCode}`}
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            <pre className="min-h-48 max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-xs">
              {run.data ? run.data.output || (run.data.status === 'running' ? 'Waiting for output…' : '(no output)') : 'Run a command and its output appears here.'}
              {run.data?.truncated && '\n— output cut off —'}
            </pre>
          </CardContent>
        </Card>
        {!!list.data?.recent.length && (
          <Card>
            <CardHeader>
              <CardTitle>Recent runs (since the API last restarted)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 pb-4">
              {list.data.recent.map((r) => (
                <button key={r.id} onClick={() => setRunId(r.id)} className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-sm hover:bg-accent">
                  <span>{r.title}</span>
                  <Badge variant={statusVariant[r.status]}>{r.status}</Badge>
                </button>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

type SqlResult = {
  kind: 'rows' | 'count';
  rows?: Record<string, unknown>[];
  columns: string[];
  affected?: number;
  truncated?: boolean;
  rolledBack?: boolean;
  rowLimit: number;
  ms: number;
};
type TableInfo = { name: string; estimate: number; columns: { name: string; type: string; nullable: boolean }[] };

const cell = (v: unknown) => (v === null ? 'NULL' : typeof v === 'object' ? JSON.stringify(v) : String(v));

function SqlTab() {
  const [sql, setSql] = useState('SELECT id, email, name FROM "User" ORDER BY "createdAt" DESC LIMIT 20');
  const [mode, setMode] = useState<'read' | 'write'>('read');
  const [dryRun, setDryRun] = useState(true);
  const [result, setResult] = useState<SqlResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const schema = useResource<TableInfo[]>(['console-schema'], '/api/admin/console/schema');
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const exec = useMutation({
    mutationFn: async () => (await api.post<SqlResult>('/api/admin/console/sql', { sql, mode, dryRun, confirm: mode === 'write' })).data,
    onSuccess: (data) => (setResult(data), setError(null)),
    onError: (err) => (setResult(null), setError(errorText(err))),
  });

  function run() {
    if (mode === 'write' && !dryRun && !window.confirm('This will change the live database and cannot be undone. Run it?')) return;
    exec.mutate();
  }

  const tables = (schema.data ?? []).filter((t) => t.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground"><Table2 className="h-4 w-4" /> Tables</CardTitle>
          <Input placeholder="Filter…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </CardHeader>
        <CardContent className="max-h-[60vh] overflow-auto pb-3 text-sm">
          {schema.isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {tables.map((t) => (
            <div key={t.name}>
              <button className="flex w-full justify-between rounded px-1 py-0.5 text-left hover:bg-accent" onClick={() => setOpen(open === t.name ? null : t.name)} onDoubleClick={() => setSql(`SELECT * FROM "${t.name}" LIMIT 50`)} title="Double-click to select from it">
                <span className="truncate font-mono text-xs">{t.name}</span>
                <span className="text-xs text-muted-foreground">~{t.estimate}</span>
              </button>
              {open === t.name && (
                <ul className="mb-1 ml-3 border-l border-border pl-2 text-xs text-muted-foreground">
                  {t.columns.map((c) => (
                    <li key={c.name} className="flex justify-between gap-2">
                      <span className="font-mono">{c.name}</span>
                      <span>{c.type}{c.nullable ? '?' : ''}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <Textarea
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') run(); }}
          spellCheck={false}
          className="min-h-40 font-mono text-xs"
          placeholder='SELECT * FROM "User" LIMIT 10'
        />
        <div className="flex flex-wrap items-center gap-3">
          <Select value={mode} onChange={(e) => setMode(e.target.value as 'read' | 'write')}>
            <option value="read">Read only</option>
            <option value="write">Write (INSERT / UPDATE / DELETE / DDL)</option>
          </Select>
          {mode === 'write' && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
              Dry run — roll back after running
            </label>
          )}
          <Button onClick={run} disabled={exec.isPending || !sql.trim()} variant={mode === 'write' && !dryRun ? 'destructive' : 'default'}>
            {exec.isPending ? <Loader2 className="animate-spin" /> : <Play />} Run <span className="text-xs opacity-70">⌘↵</span>
          </Button>
          <span className="text-xs text-muted-foreground">One statement · 15 s limit · {mode === 'read' ? 'Postgres refuses any write' : dryRun ? 'nothing is kept' : 'changes are committed'}</span>
        </div>

        {error && <pre className="whitespace-pre-wrap rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">{error}</pre>}

        {result && (
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-foreground">
                {result.kind === 'rows' ? `${result.rows?.length ?? 0} row${result.rows?.length === 1 ? '' : 's'}` : `${result.affected} row${result.affected === 1 ? '' : 's'} affected`}
                {result.truncated && ` (first ${result.rowLimit} shown)`}
              </CardTitle>
              <div className="flex gap-2">
                {result.rolledBack && <Badge variant="warning">rolled back</Badge>}
                <Badge variant="outline">{result.ms} ms</Badge>
              </div>
            </CardHeader>
            {result.kind === 'rows' && !!result.rows?.length && (
              <CardContent className="max-h-[55vh] overflow-auto pb-3">
                <table className="w-full border-collapse text-xs">
                  <thead className="sticky top-0 bg-card">
                    <tr>{result.columns.map((c) => <th key={c} className="border-b border-border px-2 py-1 text-left font-medium">{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row, i) => (
                      <tr key={i} className="hover:bg-accent/50">
                        {result.columns.map((c) => (
                          <td key={c} className={cn('max-w-80 truncate border-b border-border/50 px-2 py-1 font-mono', row[c] === null && 'text-muted-foreground')} title={cell(row[c])}>{cell(row[c])}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

export function ConsolePage() {
  return (
    <div>
      <PageHeader
        title="Console"
        description="Super admin only. Fixed backend commands and a SQL box for the database. Every run is recorded in the audit log."
      />
      <Tabs defaultValue="sql">
        <TabsList>
          <TabsTrigger value="sql"><Database className="mr-1.5 h-4 w-4" /> SQL</TabsTrigger>
          <TabsTrigger value="commands"><TerminalSquare className="mr-1.5 h-4 w-4" /> Commands</TabsTrigger>
        </TabsList>
        <TabsContent value="sql" className="mt-4"><SqlTab /></TabsContent>
        <TabsContent value="commands" className="mt-4"><CommandsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
