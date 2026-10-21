import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ChevronLeft, ChevronRight, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input, Label, Select } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api, ApiRequestError } from '@/lib/api';
import { useResource, useResourceList } from '@/lib/use-resource';
import { formatMinorUnits, formatMicros } from '@/lib/utils';

// Everything here is INR; the API sends paise. Only the super admin has `finance.manage`.

type Revenue = {
  lines: { purpose: string; provider: string; count: number; grossInr: number; commissionInr: number; netInr: number }[];
  refunded: { count: number; grossInr: number; commissionInr: number; netInr: number };
  freeTrials: number;
  unconvertedPayments: number;
  grossInr: number;
  commissionInr: number;
  netInr: number;
  paymentCount: number;
};
type MonthBooks = {
  month: string;
  confirmed: boolean;
  revenue: Revenue;
  ai: { usdInrRate: number; costMicros: number; costInr: number; groups: { name: string; calls: number; costMicros: number; costInr: number }[] };
  manual: { creditInr: number; debitInr: number; count: number };
  incomeInr: number;
  expensesInr: number;
  profitInr: number;
};
type Overview = {
  currentMonth: string;
  pendingMonths: string[];
  usdInrRate: number;
  categories: string[];
  trend: { month: string; grossInr: number; netRevenueInr: number; aiCostInr: number; otherExpensesInr: number; creditsInr: number; profitInr: number; confirmed: boolean }[];
};
type Entry = { id: string; direction: 'CREDIT' | 'DEBIT'; category: string; amountInr: number; occurredOn: string; note: string | null };

const inr = (paise: number) => formatMinorUnits(paise, 'INR');
const label = (month: string) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const shift = (month: string, by: number) => {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};
const PURPOSE: Record<string, string> = { SUBSCRIPTION: 'Subscriptions', DONATION: 'Donations' };
const PROVIDER: Record<string, string> = { GOOGLE_PLAY: 'Google Play', APPLE_APP_STORE: 'App Store', RAZORPAY: 'Razorpay' };

function Stat({ title, value, hint, tone }: { title: string; value: string; hint?: string; tone?: 'good' | 'bad' }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className={`mt-1 text-xl font-semibold ${tone === 'good' ? 'text-emerald-600' : tone === 'bad' ? 'text-destructive' : ''}`}>{value}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function FinancePage() {
  const queryClient = useQueryClient();
  const overview = useResource<Overview>(['finance-overview'], '/api/admin/finance/overview');
  const [month, setMonth] = useState<string | null>(null);
  const current = month ?? overview.data?.currentMonth ?? null;
  const books = useResource<MonthBooks>(['finance-month', current], `/api/admin/finance/months/${current}`, undefined, { enabled: Boolean(current) });
  const entries = useResourceList<Entry>('finance-entries', '/api/admin/finance/entries', { month: current, pageSize: 100, sort: 'occurredOn', dir: 'desc' }, { enabled: Boolean(current) });

  const [editing, setEditing] = useState<Entry | 'new' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rate, setRate] = useState('');

  const refresh = () => {
    for (const key of ['finance-overview', 'finance-month', 'finance-entries', 'finance-pending']) queryClient.invalidateQueries({ queryKey: [key] });
  };
  const run = async (action: () => Promise<unknown>, done: string) => {
    setNotice(null);
    try {
      await action();
      refresh();
      setNotice(done);
    } catch (e) {
      setNotice(e instanceof ApiRequestError ? e.message : 'Request failed');
    }
  };

  const b = books.data;
  const pending = overview.data?.pendingMonths ?? [];
  const isPending = current !== null && pending.includes(current);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance"
        description="Revenue after the stores’ cut, AI cost and your own costs, in rupees. Visible to the super admin only."
        actions={
          <>
            <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => current && setMonth(shift(current, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex h-9 min-w-40 items-center justify-center rounded-md border px-3 text-sm font-medium">{current ? label(current) : '…'}</div>
            <Button variant="outline" size="icon" aria-label="Next month" disabled={!current || current >= (overview.data?.currentMonth ?? '')} onClick={() => current && setMonth(shift(current, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        }
      />

      {notice && <p className="rounded-md border bg-muted/50 px-3 py-2 text-sm">{notice}</p>}

      {isPending && current && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm">
              <strong>{label(current)}</strong> is waiting for its costs. Add advertising, salaries and purchases below, then confirm the month.
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing('new')}>
                <Plus className="mr-1 h-4 w-4" /> Add a cost
              </Button>
              <Button size="sm" onClick={() => run(() => api.post(`/api/admin/finance/months/${current}/confirm`), `${label(current)} confirmed.`)}>
                <CheckCircle2 className="mr-1 h-4 w-4" /> Confirm month
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!b ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat title="Gross revenue" value={inr(b.revenue.grossInr)} hint={`${b.revenue.paymentCount} payments, after refunds`} />
            <Stat title="Store commission" value={inr(b.revenue.commissionInr)} hint="kept by Google / Apple" />
            <Stat title="Net earning" value={inr(b.revenue.netInr)} hint="gross − commission" />
            <Stat title="AI cost" value={inr(b.ai.costInr)} hint={`${formatMicros(b.ai.costMicros)} at ₹${b.ai.usdInrRate}/$`} />
            <Stat title="Other expenses" value={inr(b.manual.debitInr)} hint="debits you entered" />
            <Stat title="Other income" value={inr(b.manual.creditInr)} hint="credits you entered" />
            <Stat title="Profit" value={inr(b.profitInr)} hint="net + credits − AI − debits" tone={b.profitInr >= 0 ? 'good' : 'bad'} />
            <Stat title="Month" value={b.confirmed ? 'Confirmed' : 'Open'} hint={b.confirmed ? 'dollar rate fixed' : 'follows the current rate'} />
          </div>

          {(b.revenue.unconvertedPayments > 0 || b.revenue.freeTrials > 0) && (
            <p className="text-xs text-muted-foreground">
              {b.revenue.freeTrials > 0 && `${b.revenue.freeTrials} free trial${b.revenue.freeTrials > 1 ? 's' : ''} started this month — counted as ₹0. `}
              {b.revenue.unconvertedPayments > 0 && `${b.revenue.unconvertedPayments} payment(s) are still waiting for their rupee value (the nightly job fills it in) and are not in the totals yet.`}
            </p>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>From</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">Commission</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {b.revenue.lines.map((l) => (
                      <TableRow key={l.purpose + l.provider}>
                        <TableCell>
                          {PURPOSE[l.purpose] ?? l.purpose} · {PROVIDER[l.provider] ?? l.provider} <span className="text-muted-foreground">({l.count})</span>
                        </TableCell>
                        <TableCell className="text-right">{inr(l.grossInr)}</TableCell>
                        <TableCell className="text-right">{inr(l.commissionInr)}</TableCell>
                        <TableCell className="text-right">{inr(l.netInr)}</TableCell>
                      </TableRow>
                    ))}
                    {b.revenue.refunded.count > 0 && (
                      <TableRow>
                        <TableCell>Refunded this month ({b.revenue.refunded.count})</TableCell>
                        <TableCell className="text-right">−{inr(b.revenue.refunded.grossInr)}</TableCell>
                        <TableCell className="text-right">−{inr(b.revenue.refunded.commissionInr)}</TableCell>
                        <TableCell className="text-right">−{inr(b.revenue.refunded.netInr)}</TableCell>
                      </TableRow>
                    )}
                    {b.revenue.lines.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          No payments this month.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm">AI cost</CardTitle>
                <form
                  className="flex items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const value = Number(rate);
                    if (value > 0) run(() => api.put('/api/admin/finance/rate', { rate: value }), `Rate set to ₹${value} per dollar.`);
                  }}
                >
                  <Label htmlFor="usd-rate" className="text-xs text-muted-foreground">
                    ₹ per $
                  </Label>
                  <Input id="usd-rate" className="h-8 w-20" inputMode="decimal" placeholder={String(overview.data?.usdInrRate ?? '')} value={rate} onChange={(e) => setRate(e.target.value)} />
                  <Button size="sm" variant="outline" type="submit" disabled={!Number(rate)}>
                    Set
                  </Button>
                </form>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kind</TableHead>
                      <TableHead className="text-right">Calls</TableHead>
                      <TableHead className="text-right">Dollars</TableHead>
                      <TableHead className="text-right">Rupees</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {b.ai.groups.map((g) => (
                      <TableRow key={g.name}>
                        <TableCell>{g.name}</TableCell>
                        <TableCell className="text-right">{g.calls.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{formatMicros(g.costMicros)}</TableCell>
                        <TableCell className="text-right">{inr(g.costInr)}</TableCell>
                      </TableRow>
                    ))}
                    {b.ai.groups.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          No AI spend this month.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm">Credits and debits</CardTitle>
              <div className="flex gap-2">
                {b.confirmed ? (
                  <Button size="sm" variant="outline" onClick={() => run(() => api.delete(`/api/admin/finance/months/${b.month}/confirm`), 'Month reopened.')}>
                    <RotateCcw className="mr-1 h-4 w-4" /> Reopen month
                  </Button>
                ) : (
                  !isPending && (
                    <Button size="sm" variant="outline" onClick={() => run(() => api.post(`/api/admin/finance/months/${b.month}/confirm`), 'Month confirmed.')}>
                      <CheckCircle2 className="mr-1 h-4 w-4" /> Confirm month
                    </Button>
                  )
                )}
                <Button size="sm" onClick={() => setEditing('new')}>
                  <Plus className="mr-1 h-4 w-4" /> Add entry
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(entries.data?.items ?? []).map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>{e.occurredOn}</TableCell>
                      <TableCell className="capitalize">{e.category}</TableCell>
                      <TableCell className="text-muted-foreground">{e.note}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={e.direction === 'CREDIT' ? 'success' : 'outline'} className="mr-2">
                          {e.direction === 'CREDIT' ? 'Credit' : 'Debit'}
                        </Badge>
                        {inr(e.amountInr)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => setEditing(e)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Delete"
                          onClick={() => window.confirm('Delete this entry?') && run(() => api.delete(`/api/admin/finance/entries/${e.id}`), 'Entry deleted.')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {entries.data && entries.data.items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Nothing entered for {label(b.month)}.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Last twelve months</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Net earning</TableHead>
                    <TableHead className="text-right">AI cost</TableHead>
                    <TableHead className="text-right">Other costs</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...(overview.data?.trend ?? [])].reverse().map((t) => (
                    <TableRow key={t.month} className="cursor-pointer" onClick={() => setMonth(t.month)}>
                      <TableCell>
                        {label(t.month)} {t.confirmed && <CheckCircle2 className="ml-1 inline h-3.5 w-3.5 text-emerald-600" />}
                      </TableCell>
                      <TableCell className="text-right">{inr(t.grossInr)}</TableCell>
                      <TableCell className="text-right">{inr(t.netRevenueInr)}</TableCell>
                      <TableCell className="text-right">{inr(t.aiCostInr)}</TableCell>
                      <TableCell className="text-right">{inr(t.otherExpensesInr)}</TableCell>
                      <TableCell className={`text-right font-medium ${t.profitInr < 0 ? 'text-destructive' : ''}`}>{inr(t.profitInr)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <EntryDialog
        entry={editing}
        month={current}
        categories={overview.data?.categories ?? ['other']}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          refresh();
        }}
      />
    </div>
  );
}

function EntryDialog({
  entry,
  month,
  categories,
  onClose,
  onSaved,
}: {
  entry: Entry | 'new' | null;
  month: string | null;
  categories: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  // The form remounts for each entry (key), so its fields start from that entry.
  return (
    <Dialog open={entry !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>{entry && <EntryForm key={entry === 'new' ? 'new' : entry.id} entry={entry} month={month} categories={categories} onClose={onClose} onSaved={onSaved} />}</DialogContent>
    </Dialog>
  );
}

function EntryForm({ entry, month, categories, onClose, onSaved }: { entry: Entry | 'new'; month: string | null; categories: string[]; onClose: () => void; onSaved: () => void }) {
  const existing = entry === 'new' ? null : entry;
  const [direction, setDirection] = useState<'CREDIT' | 'DEBIT'>(existing?.direction ?? 'DEBIT');
  const [category, setCategory] = useState(existing?.category ?? categories[0] ?? 'other');
  const [amount, setAmount] = useState(existing ? String(existing.amountInr / 100) : '');
  const [date, setDate] = useState(existing?.occurredOn ?? `${month ?? new Date().toISOString().slice(0, 7)}-01`);
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const valid = Number(amount) > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date);
  const save = async () => {
    setBusy(true);
    setError(null);
    const body = { direction, category, amount: Number(amount), date, ...(note.trim() ? { note: note.trim() } : {}) };
    try {
      if (existing) await api.patch(`/api/admin/finance/entries/${existing.id}`, body);
      else await api.post('/api/admin/finance/entries', body);
      onSaved();
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{existing ? 'Edit entry' : 'Add an entry'}</DialogTitle>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="fin-direction">Type</Label>
          <Select id="fin-direction" className="mt-1.5 w-full" value={direction} onChange={(e) => setDirection(e.target.value as 'CREDIT' | 'DEBIT')}>
            <option value="DEBIT">Debit (money out)</option>
            <option value="CREDIT">Credit (money in)</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="fin-category">Category</Label>
          <Select id="fin-category" className="mt-1.5 w-full capitalize" value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="fin-amount">Amount (₹)</Label>
          <Input id="fin-amount" className="mt-1.5" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="fin-date">Date</Label>
          <Input id="fin-date" type="date" className="mt-1.5" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      <div>
        <Label htmlFor="fin-note">Note (optional)</Label>
        <Input id="fin-note" className="mt-1.5" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={!valid || busy} onClick={save}>
          {existing ? 'Save' : 'Add'}
        </Button>
      </DialogFooter>
    </>
  );
}
