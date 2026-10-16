import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { SearchInput } from '@/components/search-input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useResource, useResourceList } from '@/lib/use-resource';
import { useDebounced } from '@/lib/use-debounced';
import { api, ApiRequestError } from '@/lib/api';
import { formatDate, formatDateOnly } from '@/lib/utils';

// Every key on this page starts with 'chat' so one invalidation refreshes it all.
const KEY = 'chat';

type Limits = {
  recentMessages: number;
  compactAtTokens: number;
  keepRecentOnCompact: number;
  summaryMaxTokens: number;
  maxMessages: number;
  maxOutputTokens: number;
  maxInputChars: number;
};
type ChatSettings = {
  systemPrompt: string;
  defaultSystemPrompt: string;
  description: string;
  defaultDescription: string;
  limits: Limits;
  defaultLimits: Limits;
};
type PlanConfig = {
  levelName: string;
  isEnabled: boolean;
  dailyTokens: number;
  walletTokens: number;
  renewal: 'MONTHLY' | 'NEVER';
  conversationTokens: number;
  modelTier: 'BASIC' | 'ADVANCED';
};
type ChatPlan = { planId: string; slug: string; name: string; tier: number; isFree: boolean; isActive: boolean; config: PlanConfig | null };
type WalletRow = {
  userId: string;
  email: string | null;
  name: string | null;
  wallet: { balance: number; allocation: number; periodEnd: string | null } | null;
  conversations: number;
};
type Transaction = {
  id: string;
  type: 'CREDIT' | 'DEBIT';
  tokens: number;
  source: string;
  note: string | null;
  balanceAfter: number;
  createdById: string | null;
  createdAt: string;
};
type UserWallet = {
  user: { id?: string; email?: string | null; name?: string | null } & Record<string, unknown>;
  wallet: {
    plan: string;
    allowance: number;
    balance: number;
    allocation: number;
    dailyUsed: number;
    periodStart: string | null;
    periodEnd: string | null;
    percent: number;
  } | null;
  transactions: Transaction[];
  conversations: number;
};
type Stats = {
  days: number;
  conversations: number;
  userMessages: number;
  activeUsers: number;
  tokens: { source: string; type: string; tokens: number; count: number }[];
};

const num = (n: number) => n.toLocaleString('en-IN');
const errorText = (error: unknown) => (error instanceof ApiRequestError ? error.message : 'Request failed.');

function Notice({ tone, text }: { tone: 'success' | 'error'; text: string }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={`mb-4 rounded-md border px-3 py-2 text-sm ${
        tone === 'success'
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
          : 'border-destructive/30 bg-destructive/10 text-destructive'
      }`}
    >
      {text}
    </p>
  );
}

function useRefresh() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: [KEY] });
}

// ── Persona & limits ───────────────────────────────────────────────────────

const LIMIT_FIELDS: { key: keyof Limits; label: string; help: string }[] = [
  { key: 'recentMessages', label: 'Recent messages', help: 'How many of the latest messages are sent to the model verbatim with each turn.' },
  { key: 'compactAtTokens', label: 'Compact at (tokens)', help: 'When the older part of a conversation grows past this, it is summarised.' },
  { key: 'keepRecentOnCompact', label: 'Keep on compact', help: 'Messages kept word for word when a conversation is summarised.' },
  { key: 'summaryMaxTokens', label: 'Summary max (tokens)', help: 'The longest a conversation summary may be.' },
  { key: 'maxMessages', label: 'Max messages per conversation', help: 'A conversation stops accepting messages after this many (0 = no cap).' },
  { key: 'maxOutputTokens', label: 'Max reply (tokens)', help: 'The longest a single reply from the assistant may be.' },
  { key: 'maxInputChars', label: 'Max message length (characters)', help: 'The longest message a user may send.' },
];

function PersonaTab() {
  const data = useResource<ChatSettings>([KEY, 'settings'], '/api/admin/chat/settings');
  const refresh = useRefresh();
  const [prompt, setPrompt] = useState('');
  const [description, setDescription] = useState('');
  const [limits, setLimits] = useState<Record<keyof Limits, string> | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const s = data.data;
  useEffect(() => {
    if (!s) return;
    setPrompt(s.systemPrompt);
    setDescription(s.description);
    setLimits(Object.fromEntries(Object.entries(s.limits).map(([k, v]) => [k, String(v)])) as Record<keyof Limits, string>);
  }, [s]);

  if (data.isLoading || !s || !limits) {
    return data.error ? <Notice tone="error" text={errorText(data.error)} /> : <Skeleton className="h-64 w-full" />;
  }

  const limitsInvalid = LIMIT_FIELDS.some((f) => limits[f.key].trim() === '' || !Number.isInteger(Number(limits[f.key])));

  async function save() {
    if (!limits) return;
    setSaving(true);
    setNotice(null);
    try {
      const body = {
        systemPrompt: prompt,
        description,
        limits: Object.fromEntries(LIMIT_FIELDS.map((f) => [f.key, Number(limits[f.key])])),
      };
      await api.put('/api/admin/chat/settings', body);
      await refresh();
      setNotice({ tone: 'success', text: 'Saved. It applies to the next message.' });
    } catch (e) {
      setNotice({ tone: 'error', text: errorText(e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {notice && <Notice {...notice} />}
      <Card>
        <CardContent className="space-y-4 py-4">
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="chat-prompt">System prompt</Label>
              <Button size="sm" variant="ghost" disabled={prompt === s.defaultSystemPrompt} onClick={() => setPrompt(s.defaultSystemPrompt)}>
                Reset to default
              </Button>
            </div>
            <Textarea id="chat-prompt" className="mt-1 min-h-64 font-mono text-xs" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">
              The assistant's persona and rules. Clearing it and saving restores the built-in default.
            </p>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="chat-desc">Description shown in the app</Label>
              <Button size="sm" variant="ghost" disabled={description === s.defaultDescription} onClick={() => setDescription(s.defaultDescription)}>
                Reset to default
              </Button>
            </div>
            <Textarea id="chat-desc" className="mt-1 min-h-20" maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">
              Readers see this text. It states the assistant's Sri Vaishnava orientation, so keep it truthful to the system prompt.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-4">
          <p className="mb-3 font-medium">Limits</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {LIMIT_FIELDS.map((f) => (
              <div key={f.key}>
                <Label htmlFor={`lim-${f.key}`}>{f.label}</Label>
                <Input
                  id={`lim-${f.key}`}
                  className="mt-1"
                  type="number"
                  min={0}
                  value={limits[f.key]}
                  onChange={(e) => setLimits({ ...limits, [f.key]: e.target.value })}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {f.help} Default {num(s.defaultLimits[f.key])}.
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button disabled={saving || limitsInvalid} onClick={save}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
}

// ── Plan allowances ────────────────────────────────────────────────────────

const EMPTY_CONFIG: PlanConfig = {
  levelName: '',
  isEnabled: true,
  dailyTokens: 0,
  walletTokens: 0,
  renewal: 'MONTHLY',
  conversationTokens: 0,
  modelTier: 'BASIC',
};

function PlanRow({ plan }: { plan: ChatPlan }) {
  const refresh = useRefresh();
  const [cfg, setCfg] = useState<PlanConfig>(plan.config ?? EMPTY_CONFIG);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setCfg(plan.config ?? EMPTY_CONFIG);
  }, [plan]);

  const dirty = JSON.stringify(cfg) !== JSON.stringify(plan.config ?? EMPTY_CONFIG);
  const valid = cfg.levelName.trim() !== '' && cfg.walletTokens >= 0 && (plan.config !== null || cfg.walletTokens > 0 || dirty);

  const setNum = (key: 'dailyTokens' | 'walletTokens' | 'conversationTokens', v: string) =>
    setCfg({ ...cfg, [key]: Math.max(0, Math.floor(Number(v) || 0)) });

  async function save() {
    setSaving(true);
    setError('');
    try {
      await api.put(`/api/admin/chat/plans/${plan.planId}`, { ...cfg, levelName: cfg.levelName.trim() });
      await refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <TableRow>
      <TableCell className="align-top">
        <p className="font-medium">{plan.name}</p>
        <p className="font-mono text-xs text-muted-foreground">{plan.slug}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {plan.isFree && <Badge variant="secondary">Free</Badge>}
          {!plan.isActive && <Badge variant="outline">Inactive</Badge>}
          {!plan.config && <Badge variant="warning">Uses free allowance</Badge>}
        </div>
        {error && (
          <p role="alert" className="mt-1 max-w-48 text-xs text-destructive">
            {error}
          </p>
        )}
      </TableCell>
      <TableCell className="align-top">
        <Input className="w-32" aria-label={`Level name for ${plan.name}`} placeholder="Bhakta" value={cfg.levelName} onChange={(e) => setCfg({ ...cfg, levelName: e.target.value })} />
      </TableCell>
      <TableCell className="align-top">
        <Checkbox aria-label={`Chat enabled for ${plan.name}`} checked={cfg.isEnabled} onChange={(e) => setCfg({ ...cfg, isEnabled: e.target.checked })} />
      </TableCell>
      <TableCell className="align-top">
        <Input className="w-28" type="number" min={0} aria-label={`Daily tokens for ${plan.name}`} value={cfg.dailyTokens} onChange={(e) => setNum('dailyTokens', e.target.value)} />
      </TableCell>
      <TableCell className="align-top">
        <Input className="w-32" type="number" min={0} aria-label={`Wallet tokens for ${plan.name}`} value={cfg.walletTokens} onChange={(e) => setNum('walletTokens', e.target.value)} />
      </TableCell>
      <TableCell className="align-top">
        <Select className="w-28" aria-label={`Renewal for ${plan.name}`} value={cfg.renewal} onChange={(e) => setCfg({ ...cfg, renewal: e.target.value as PlanConfig['renewal'] })}>
          <option value="MONTHLY">Monthly</option>
          <option value="NEVER">Never</option>
        </Select>
      </TableCell>
      <TableCell className="align-top">
        <Input className="w-28" type="number" min={0} aria-label={`Per-conversation tokens for ${plan.name}`} value={cfg.conversationTokens} onChange={(e) => setNum('conversationTokens', e.target.value)} />
      </TableCell>
      <TableCell className="align-top">
        <Select className="w-32" aria-label={`Model tier for ${plan.name}`} value={cfg.modelTier} onChange={(e) => setCfg({ ...cfg, modelTier: e.target.value as PlanConfig['modelTier'] })}>
          <option value="BASIC">Basic</option>
          <option value="ADVANCED">Advanced</option>
        </Select>
      </TableCell>
      <TableCell className="align-top">
        <Button size="sm" disabled={!dirty || !valid || saving} onClick={save}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </TableCell>
    </TableRow>
  );
}

function PlansTab() {
  const data = useResource<ChatPlan[]>([KEY, 'plans'], '/api/admin/chat/plans');
  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">
        Raw token numbers are only visible on this page. Users see a percentage meter: the <strong>wallet</strong> is what 100% means. A plan with no
        allowance of its own (marked below) uses the free plan's. 0 means no cap for daily and per-conversation tokens.
      </p>
      {data.error ? (
        <Notice tone="error" text={errorText(data.error)} />
      ) : data.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plan</TableHead>
              <TableHead>Level name</TableHead>
              <TableHead>Enabled</TableHead>
              <TableHead>Daily tokens</TableHead>
              <TableHead>Wallet tokens</TableHead>
              <TableHead>Renewal</TableHead>
              <TableHead>Per conversation</TableHead>
              <TableHead>Model tier</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data.data ?? []).map((p) => (
              <PlanRow key={p.planId} plan={p} />
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// ── Wallets ────────────────────────────────────────────────────────────────

function AdjustDialog({ userId, mode, onClose }: { userId: string; mode: 'grant' | 'adjust' | null; onClose: () => void }) {
  const refresh = useRefresh();
  const [tokens, setTokens] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTokens('');
    setNote('');
    setError('');
  }, [mode]);

  const n = Number(tokens);
  const valid = tokens.trim() !== '' && Number.isInteger(n) && n !== 0 && (mode !== 'grant' || n > 0) && note.trim() !== '';

  async function submit() {
    if (!mode) return;
    setSaving(true);
    setError('');
    try {
      await api.post(`/api/admin/chat/users/${userId}/${mode}`, { tokens: n, note: note.trim() });
      await refresh();
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!mode} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'grant' ? 'Grant tokens' : 'Adjust tokens'}</DialogTitle>
          <DialogDescription>
            {mode === 'grant' ? 'Adds tokens to this wallet.' : 'A signed correction: positive adds, negative removes.'} It is written to the ledger and the audit log.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Tokens</Label>
            <Input className="mt-1" type="number" placeholder={mode === 'grant' ? '50000' : '-20000'} value={tokens} onChange={(e) => setTokens(e.target.value)} />
          </div>
          <div>
            <Label>Note (required)</Label>
            <Input className="mt-1" maxLength={300} placeholder="Why this is being done" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!valid || saving} onClick={submit}>
            {saving ? 'Saving…' : mode === 'grant' ? 'Grant' : 'Apply'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UserWalletView({ userId, onBack }: { userId: string; onBack: () => void }) {
  const data = useResource<UserWallet>([KEY, 'user', userId], `/api/admin/chat/users/${userId}`);
  const [mode, setMode] = useState<'grant' | 'adjust' | null>(null);
  const d = data.data;
  const w = d?.wallet;

  return (
    <div className="space-y-4">
      <Button size="sm" variant="ghost" onClick={onBack}>
        <ArrowLeft className="mr-1 h-4 w-4" /> All wallets
      </Button>
      {data.error ? (
        <Notice tone="error" text={errorText(data.error)} />
      ) : data.isLoading || !d ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <Card>
            <CardContent className="py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{d.user.name || d.user.email || userId}</p>
                  {d.user.name && d.user.email && <p className="text-sm text-muted-foreground">{d.user.email}</p>}
                  <p className="text-xs text-muted-foreground">{num(d.conversations)} conversations</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setMode('grant')}>
                    Grant
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setMode('adjust')}>
                    Adjust
                  </Button>
                </div>
              </div>
              {w ? (
                <dl className="mt-4 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
                  {[
                    ['Plan', w.plan],
                    ['Balance', num(w.balance)],
                    ['Allocation', num(w.allocation)],
                    ['Used today', num(w.dailyUsed)],
                    ['Meter (user sees)', `${w.percent}%`],
                    ['Period ends', w.periodEnd ? formatDateOnly(w.periodEnd) : 'Never'],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-xs text-muted-foreground">{k}</dt>
                      <dd className="font-medium">{v}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">This user has no wallet yet — it is created the first time they chat. A grant creates it.</p>
              )}
            </CardContent>
          </Card>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Tokens</TableHead>
                <TableHead className="text-right">Balance after</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.transactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No transactions.
                  </TableCell>
                </TableRow>
              )}
              {d.transactions.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="whitespace-nowrap">{formatDate(t.createdAt)}</TableCell>
                  <TableCell className="font-mono text-xs">{t.source}</TableCell>
                  <TableCell className={`text-right tabular-nums ${t.type === 'CREDIT' ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                    {t.type === 'CREDIT' ? '+' : '−'}
                    {num(Math.abs(t.tokens))}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{num(t.balanceAfter)}</TableCell>
                  <TableCell className="text-muted-foreground">{t.note ?? ''}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground">The latest 50 transactions.</p>
        </>
      )}
      <AdjustDialog userId={userId} mode={mode} onClose={() => setMode(null)} />
    </div>
  );
}

function WalletsTab() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const search = useDebounced(q, 300);
  const list = useResourceList<WalletRow>(`${KEY}-wallets`, '/api/admin/chat/wallets', { q: search, page, pageSize: 20 });

  // The list lives under its own key, so it has to be refreshed by hand after a grant.
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!open) queryClient.invalidateQueries({ queryKey: [`${KEY}-wallets`] });
  }, [open, queryClient]);

  if (open) return <UserWalletView userId={open} onBack={() => setOpen(null)} />;

  const rows = list.data?.items ?? [];
  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <SearchInput
          value={q}
          onChange={(v) => {
            setQ(v);
            setPage(1);
          }}
          placeholder="Search by email or name…"
        />
        {list.data && <span className="text-sm text-muted-foreground">{num(list.data.total)} users</span>}
      </div>
      {list.error ? (
        <Notice tone="error" text={errorText(list.error)} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead className="text-right">Allocation</TableHead>
              <TableHead>Period ends</TableHead>
              <TableHead className="text-right">Conversations</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.isLoading && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Skeleton className="h-6 w-full" />
                </TableCell>
              </TableRow>
            )}
            {!list.isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No users match.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.userId} className="cursor-pointer" onClick={() => setOpen(r.userId)}>
                <TableCell>
                  <p className="font-medium">{r.name || r.email || r.userId}</p>
                  {r.name && r.email && <p className="text-xs text-muted-foreground">{r.email}</p>}
                </TableCell>
                <TableCell className="text-right tabular-nums">{r.wallet ? num(r.wallet.balance) : '—'}</TableCell>
                <TableCell className="text-right tabular-nums">{r.wallet ? num(r.wallet.allocation) : '—'}</TableCell>
                <TableCell>{r.wallet?.periodEnd ? formatDateOnly(r.wallet.periodEnd) : '—'}</TableCell>
                <TableCell className="text-right tabular-nums">{num(r.conversations)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {list.data && list.data.totalPages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-sm">
          <span className="text-muted-foreground">
            Page {list.data.page} of {list.data.totalPages}
          </span>
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <Button size="sm" variant="outline" disabled={!list.data.hasMore} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Usage ──────────────────────────────────────────────────────────────────

function UsageSummary() {
  const data = useResource<Stats>([KEY, 'stats'], '/api/admin/chat/stats');
  const s = data.data;
  if (data.error) return <Notice tone="error" text={errorText(data.error)} />;
  if (!s) return <Skeleton className="mb-6 h-24 w-full" />;

  return (
    <Card className="mb-6">
      <CardContent className="py-4">
        <p className="mb-3 font-medium">Last {s.days} days</p>
        <dl className="grid gap-4 sm:grid-cols-3">
          {[
            ['Conversations', s.conversations],
            ['User messages', s.userMessages],
            ['Active users', s.activeUsers],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="text-lg font-semibold tabular-nums">{num(v as number)}</dd>
            </div>
          ))}
        </dl>
        {s.tokens.length > 0 && (
          <div className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Token source</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                  <TableHead className="text-right">Entries</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {s.tokens.map((t) => (
                  <TableRow key={`${t.source}-${t.type}`}>
                    <TableCell className="font-mono text-xs">{t.source}</TableCell>
                    <TableCell>{t.type === 'CREDIT' ? 'Credit' : 'Debit'}</TableCell>
                    <TableCell className="text-right tabular-nums">{num(t.tokens)}</TableCell>
                    <TableCell className="text-right tabular-nums">{num(t.count)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ChatPage() {
  return (
    <div>
      <PageHeader title="AI chat" description="The devotional assistant's persona and limits, what each plan may spend, and individual wallets." />
      <UsageSummary />
      <Tabs defaultValue="persona">
        <TabsList>
          <TabsTrigger value="persona">Persona &amp; limits</TabsTrigger>
          <TabsTrigger value="plans">Plan allowances</TabsTrigger>
          <TabsTrigger value="wallets">Wallets</TabsTrigger>
        </TabsList>
        <TabsContent value="persona">
          <PersonaTab />
        </TabsContent>
        <TabsContent value="plans">
          <PlansTab />
        </TabsContent>
        <TabsContent value="wallets">
          <WalletsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
