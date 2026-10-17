import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label, Select } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EngineChain, providerName, type Engine } from '@/components/ai-engines';
import { ProgressBar } from '@/components/translation-bits';
import { ApiRequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useResource, useResourceMutation } from '@/lib/use-resource';

// OpenAI’s free daily tokens: the switch that decides whether chat and the translation runs use them, the day’s count
// pool by pool and model by model, and what each would use if it ran this moment. The rules are in
// backend/utils/ai-free-tier.js and backend/services/ai/free-tier.js; this card only shows and changes them.

type Pool = { id: string; label: string; limit: number; cap: number; used: number; models: string[] };
type TokenRow = { provider: string; model: string; inputTokens: number; outputTokens: number; calls: number; pool: string | null };
type FreeTier = {
  enabled: boolean;
  models: { text: string; translation: string };
  usableModels: string[];
  safetyPercent: number;
  day: string;
  pools: Pool[];
  usage: TokenRow[];
  now: {
    chat: Engine[];
    translation: { model: string; paidModel: string; onFreeTier: boolean; reason: 'off' | 'spent' | null };
  };
};
type Change = { enabled?: boolean; textModel?: string; translationModel?: string };

// US grouping, to read against OpenAI’s own page ("2,500,000").
const fmt = (n: number) => n.toLocaleString('en-US');
const errorText = (error: unknown) => (error instanceof ApiRequestError ? error.message : 'Request failed.');

// The count starts again at midnight UTC; this is that moment on the viewer’s own clock.
function resetTime() {
  const at = new Date();
  at.setUTCHours(24, 0, 0, 0);
  return at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function AiFreeTierCard() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('setting.write');
  const state = useResource<FreeTier>(['ai-free-tier'], '/api/admin/ai/free-tier', undefined, { refetchInterval: 30_000 });
  const save = useResourceMutation('ai-free-tier');
  const change = (body: Change) => save.mutate({ path: '/api/admin/ai/free-tier', method: 'put', body });

  const s = state.data;
  if (!s) {
    return state.error ? (
      <p role="alert" className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {errorText(state.error)}
      </p>
    ) : (
      <Skeleton className="mb-4 h-64 w-full" />
    );
  }

  const t = s.now.translation;
  const total = s.usage.reduce(
    (sum, row) => ({ calls: sum.calls + row.calls, input: sum.input + row.inputTokens, output: sum.output + row.outputTokens }),
    { calls: 0, input: 0, output: 0 }
  );

  return (
    <Card className="mb-4">
      <CardContent className="space-y-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <p id="free-tier-title" className="font-medium">
                Use OpenAI free tier
              </p>
              <Badge variant={s.enabled ? 'success' : 'secondary'}>{s.enabled ? 'On' : 'Off'}</Badge>
            </div>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              OpenAI gives this organisation free tokens every day for sharing its API traffic with OpenAI (platform.openai.com → Settings →
              Data controls → Sharing). With this on, chat and the translation runs use a free model first and move to the paid model once the
              day’s free tokens are spent.
            </p>
          </div>
          <Switch aria-labelledby="free-tier-title" checked={s.enabled} disabled={!canEdit || save.isPending} onCheckedChange={(enabled) => change({ enabled })} />
        </div>

        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
          With this on, what readers write to Sakha — and any picture they send — goes to OpenAI and is shared under that programme. Turn this off
          <strong> before </strong>you turn data sharing off at OpenAI: the free models are then billed at their normal rates, and this switch would
          still prefer them to the paid default.
        </p>

        {save.error && (
          <p role="alert" className="text-sm text-destructive">
            {errorText(save.error)}
          </p>
        )}
        {!canEdit && <p className="text-xs text-muted-foreground">Changing this needs the setting.write permission.</p>}

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-3">
            <div>
              <Label htmlFor="free-text-model">Chat and other AI calls use</Label>
              <Select
                id="free-text-model"
                className="mt-1 w-full max-w-xs"
                value={s.models.text}
                disabled={!canEdit || save.isPending}
                onChange={(e) => change({ textModel: e.target.value })}
              >
                {s.usableModels.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">Chat replies, the summaries that tidy a long chat and the AI batch passes. Plans on the stronger tier never use it.</p>
            </div>
            <div>
              <Label htmlFor="free-translation-model">Translation runs use</Label>
              <Select
                id="free-translation-model"
                className="mt-1 w-full max-w-xs"
                value={s.models.translation}
                disabled={!canEdit || save.isPending}
                onChange={(e) => change({ translationModel: e.target.value })}
              >
                {s.usableModels.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                Only parts set to {t.paidModel} with thinking off move to it. Parts given to Claude, Gemini, another model or thinking are never changed.
              </p>
            </div>
          </div>

          <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
            <p className="text-sm font-medium">Right now</p>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Chat answers with, in this order</p>
              <EngineChain engines={s.now.chat} />
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Translation runs use</p>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span>OpenAI</span>
                <span className="font-mono text-xs">{t.model}</span>
                <Badge variant={t.onFreeTier ? 'success' : 'warning'}>{t.onFreeTier ? 'free tier' : 'paid'}</Badge>
              </div>
              {!t.onFreeTier && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t.reason === 'spent'
                    ? `Today’s free tokens are spent, so runs use ${t.paidModel} until the count starts again.`
                    : `The free tier is off, so runs use ${t.paidModel}.`}
                </p>
              )}
            </div>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">
            Free tokens today <span className="font-normal text-muted-foreground">· {s.day} (UTC)</span>
          </p>
          <div className="space-y-3">
            {s.pools.map((pool) => {
              const spent = pool.used >= pool.cap;
              const percent = (pool.used / pool.cap) * 100;
              return (
                <div key={pool.id}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span>{pool.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {fmt(pool.used)} / {fmt(pool.cap)}
                      {spent && <span className="ml-2 font-medium text-destructive">spent</span>}
                    </span>
                  </div>
                  <ProgressBar className="mt-1" percent={percent} tone={spent ? 'destructive' : percent >= 80 ? 'warning' : 'primary'} />
                  <p className="mt-1 text-xs text-muted-foreground">
                    OpenAI allows {fmt(pool.limit)} a day; we stop at {s.safetyPercent}%. {pool.models.join(', ')}.
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Tokens today, model by model</p>
          {s.usage.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing has been counted yet today.</p>
          ) : (
            <Table className="whitespace-nowrap">
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Free pool</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                  <TableHead className="text-right">In</TableHead>
                  <TableHead className="text-right">Out</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {s.usage.map((row) => (
                  <TableRow key={`${row.provider}|${row.model}`}>
                    <TableCell>{providerName(row.provider)}</TableCell>
                    <TableCell className="font-mono text-xs">{row.model}</TableCell>
                    <TableCell>{s.pools.find((pool) => pool.id === row.pool)?.label ?? <span className="text-muted-foreground">none — paid</span>}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(row.calls)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(row.inputTokens)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(row.outputTokens)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(row.inputTokens + row.outputTokens)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-medium">
                  <TableCell colSpan={3}>All models</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(total.calls)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(total.input)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(total.output)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(total.input + total.output)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            This counts what this app sent: chat, summaries, the AI batch passes and the admin translation runs. It cannot see other projects on the
            same OpenAI organisation or the command-line translation script, which is why we stop at {s.safetyPercent}% of a pool, and it starts
            from zero if Redis is cleared. It starts again at midnight UTC ({resetTime()} your time); OpenAI’s page does not say when its own day
            ends. Input and output are added together, because the page says only “tokens”.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
