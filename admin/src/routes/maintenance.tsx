import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Play } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api, ApiRequestError } from '@/lib/api';
import { formatDate } from '@/lib/utils';

type Command = { id: string; title: string; description: string };
type RunInfo = { id: string; command: { id: string; title: string }; status: 'running' | 'succeeded' | 'failed' | 'timed_out'; exitCode: number | null; startedAt: string; finishedAt: string | null; startedBy: string };
type Run = RunInfo & { offset: number; output: string; dropped: number };
type Snapshot = { commands: Command[]; running: boolean; run: Run | null; history: RunInfo[] };

const POLL_MS = 1000;
const TONE: Record<RunInfo['status'], 'default' | 'secondary' | 'destructive'> = { running: 'secondary', succeeded: 'default', failed: 'destructive', timed_out: 'destructive' };

export function MaintenancePage() {
  const [commands, setCommands] = useState<Command[]>([]);
  const [history, setHistory] = useState<RunInfo[]>([]);
  const [run, setRun] = useState<RunInfo | null>(null);
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const runId = useRef<string | undefined>(undefined);
  const offset = useRef(0);
  const screen = useRef<HTMLPreElement>(null);

  // Asks only for output past what is already shown; a different run starts from zero.
  const load = useCallback(async () => {
    try {
      const res = await api.get<Snapshot>('/api/admin/maintenance', { run: runId.current, since: offset.current });
      const data = res.data;
      setCommands(data.commands);
      setHistory(data.history);
      if (data.run) {
        if (data.run.id !== runId.current) {
          runId.current = data.run.id;
          setOutput(data.run.output);
        } else if (data.run.output) {
          setOutput((text) => text + data.run!.output);
        }
        offset.current = data.run.offset;
        setRun(data.run);
      }
      setError(null);
      return data.run?.status === 'running';
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not reach the server.');
      return false;
    }
  }, []);

  const [watching, setWatching] = useState(true);
  useEffect(() => {
    if (!watching) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const more = await load();
      if (stopped) return;
      if (more) timer = setTimeout(tick, POLL_MS);
      else setWatching(false);
    };
    tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [watching, load]);

  useEffect(() => {
    if (screen.current) screen.current.scrollTop = screen.current.scrollHeight;
  }, [output]);

  async function start(command: Command) {
    if (!window.confirm(`Run “${command.title}” on the server now?`)) return;
    setStarting(true);
    setError(null);
    try {
      const res = await api.post<Run>('/api/admin/maintenance/run', { command: command.id });
      runId.current = res.data.id;
      offset.current = res.data.offset;
      setOutput(res.data.output);
      setRun(res.data);
      setWatching(true);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not start it.');
    } finally {
      setStarting(false);
    }
  }

  const running = run?.status === 'running';

  return (
    <div>
      <PageHeader
        title="Maintenance"
        description="Run a fixed list of server scripts. One at a time; every run is in the audit log. This is not a shell."
      />
      {error && <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {commands.map((command) => (
          <Card key={command.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{command.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">{command.description}</p>
              <Button size="sm" className="self-start" disabled={running || starting} onClick={() => start(command)}>
                {running || starting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1.5 h-3.5 w-3.5" />}
                Run
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
          <CardTitle className="text-sm">{run ? run.command.title : 'Output'}</CardTitle>
          {run && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{run.startedBy} · {formatDate(run.startedAt)}</span>
              <Badge variant={TONE[run.status]}>{run.status === 'timed_out' ? 'timed out' : run.status}{run.exitCode !== null && run.exitCode !== 0 ? ` (${run.exitCode})` : ''}</Badge>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <pre ref={screen} className="h-96 overflow-auto whitespace-pre-wrap break-words rounded-md bg-zinc-950 p-3 font-mono text-xs text-zinc-100">
            {output || (run ? 'Waiting for output…' : 'Nothing has run since the server started.')}
          </pre>
        </CardContent>
      </Card>

      {history.length > 0 && (
        <p className="mt-4 text-xs text-muted-foreground">
          Recent: {history.map((h) => `${h.command.title} (${h.status})`).join(' · ')}
        </p>
      )}
    </div>
  );
}
