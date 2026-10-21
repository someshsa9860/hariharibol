import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { CalendarIcon } from '@/components/calendar-icon';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, Select } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { ApiRequestError } from '@/lib/api';
import { useResource, useResourceMutation } from '@/lib/use-resource';
import { cn } from '@/lib/utils';

type Day = {
  id: string;
  date: string;
  weekday: number;
  sunrise: string | null;
  sunset: string | null;
  moonrise: string | null;
  tithi: { number: number; name: string; paksha: string; endsAt: string | null };
  nakshatra: { number: number; name: string; endsAt: string | null };
  yoga: string;
  karana: string;
  month: string;
  monthPurnimanta: string;
  isAdhika: boolean;
  sunSign: string;
  moonSign: string;
  vikramSamvat: number;
  shakaSamvat: number;
  notes: string | null;
  isEdited: boolean;
};
type Festival = {
  id: string;
  date: string;
  slug: string;
  kind: string;
  name: string;
  description: string | null;
  paksha: string | null;
  month: string | null;
  vaishnavaDate: string | null;
  isActive: boolean;
  notify: boolean;
  notifyDaysBefore: number[];
  notifiedDays: number[];
  isEdited: boolean;
};
type Place = { key: string; name: string; lat: number; lon: number; timezone: string };
type MonthData = { location: Place; locations: Place[]; days: Day[]; festivals: Festival[] };

const KINDS = ['EKADASHI', 'CHATURTHI', 'PURNIMA', 'AMAVASYA', 'PRADOSH', 'SANKRANTI', 'FESTIVAL'];
const KIND_LABEL: Record<string, string> = {
  EKADASHI: 'Ekadashi',
  CHATURTHI: 'Chaturthi',
  PURNIMA: 'Purnima',
  AMAVASYA: 'Amavasya',
  PRADOSH: 'Pradosh',
  SANKRANTI: 'Sankranti',
  FESTIVAL: 'Festival',
};
const KIND_TINT: Record<string, string> = {
  EKADASHI: 'text-emerald-600 dark:text-emerald-400',
  CHATURTHI: 'text-orange-600 dark:text-orange-400',
  PURNIMA: 'text-amber-500',
  AMAVASYA: 'text-slate-500',
  PRADOSH: 'text-indigo-500',
  SANKRANTI: 'text-yellow-600',
  FESTIVAL: 'text-rose-600 dark:text-rose-400',
};
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const pad = (n: number) => String(n).padStart(2, '0');
const monthKey = (y: number, m: number) => `${y}-${pad(m + 1)}`;
const IST = { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true } as const;
const time = (iso: string | null, zone: string) =>
  iso ? new Date(iso).toLocaleTimeString('en-IN', { ...IST, timeZone: zone }) : '—';
const dateTime = (iso: string | null, zone: string) =>
  iso ? new Date(iso).toLocaleString('en-IN', { ...IST, timeZone: zone, day: 'numeric', month: 'short' }) : '—';

export function CalendarPage() {
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear() < 2026 ? 2026 : now.getFullYear(), m: now.getMonth() });
  const key = monthKey(cursor.y, cursor.m);
  const month = useResource<MonthData>(['calendar', key], '/api/admin/panchang', { month: key });
  const mutate = useResourceMutation('calendar');
  const [open, setOpen] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const data = month.data;
  const zone = data?.location.timezone ?? 'Asia/Kolkata';
  const byDate = (date: string) => ({
    day: data?.days.find((d) => d.date === date),
    festivals: (data?.festivals ?? []).filter((f) => f.date === date),
  });

  const lead = new Date(Date.UTC(cursor.y, cursor.m, 1)).getUTCDay();
  const length = new Date(Date.UTC(cursor.y, cursor.m + 1, 0)).getUTCDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length }, (_, i) => `${key}-${pad(i + 1)}`)];
  const move = (by: number) => {
    const d = new Date(Date.UTC(cursor.y, cursor.m + by, 1));
    setCursor({ y: d.getUTCFullYear(), m: d.getUTCMonth() });
  };
  const today = new Date().toLocaleDateString('en-CA', { timeZone: zone });

  async function chooseLocation(placeKey: string) {
    setNotice('');
    try {
      await mutate.mutateAsync({ path: '/api/admin/panchang/location', method: 'put', body: { key: placeKey } });
      setNotice(`Place set to ${placeKey}. Generate a year for it if it has none yet.`);
    } catch (e) {
      setNotice(e instanceof ApiRequestError ? e.message : 'Could not change the place.');
    }
  }
  async function generate() {
    setNotice('Working out the year…');
    try {
      const res = (await mutate.mutateAsync({ path: '/api/admin/panchang/generate', method: 'post', body: { year: cursor.y } })) as {
        data: { days: number; festivals: number; adminEditedKept: number };
      };
      setNotice(`${cursor.y}: ${res.data.days} days and ${res.data.festivals} festivals written; ${res.data.adminEditedKept} edited days kept.`);
    } catch (e) {
      setNotice(e instanceof ApiRequestError ? e.message : 'Could not generate.');
    }
  }

  return (
    <div>
      <PageHeader
        title="Hindu calendar"
        description="Panchang for each day, worked out from the sun and moon for one place. Edit a day or a festival and it is kept when the year is generated again."
        actions={
          <>
            <Select value={data?.location.key ?? ''} onChange={(e) => chooseLocation(e.target.value)} aria-label="Place">
              {(data?.locations ?? []).map((p) => (
                <option key={p.key} value={p.key}>
                  {p.name}
                </option>
              ))}
            </Select>
            <Button variant="outline" onClick={generate} disabled={mutate.isPending}>
              Generate {cursor.y}
            </Button>
          </>
        }
      />
      {notice && <p className="mb-3 text-sm text-muted-foreground">{notice}</p>}

      <div className="mb-3 flex items-center gap-2">
        <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => move(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="min-w-40 text-center font-medium">
          {new Date(Date.UTC(cursor.y, cursor.m, 1)).toLocaleString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
        </h3>
        <Button variant="outline" size="icon" aria-label="Next month" onClick={() => move(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        {data && data.days.length > 0 && (
          <span className="ml-2 text-xs text-muted-foreground">
            {data.days[0].month} · Vikram {data.days[0].vikramSamvat} · {data.location.name}
          </span>
        )}
      </div>

      {month.isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : data && data.days.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nothing is saved for this month at {data.location.name}. Use “Generate {cursor.y}” above.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border text-xs">
          {WEEKDAYS.map((w) => (
            <div key={w} className="bg-muted px-2 py-1.5 text-center font-medium text-muted-foreground">
              {w}
            </div>
          ))}
          {cells.map((date, i) => {
            if (!date) return <div key={`b${i}`} className="bg-background" />;
            const { day, festivals } = byDate(date);
            return (
              <button
                key={date}
                type="button"
                onClick={() => setOpen(date)}
                className={cn(
                  'min-h-24 bg-background p-1.5 text-left align-top transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  date === today && 'ring-2 ring-inset ring-primary'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{Number(date.slice(8))}</span>
                  {day?.isEdited && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" title="Edited" />}
                </div>
                {day && (
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {day.tithi.paksha === 'SHUKLA' ? 'S' : 'K'} · {day.tithi.name}
                  </p>
                )}
                {day && <p className="truncate text-[11px] text-muted-foreground">{day.nakshatra.name}</p>}
                <div className="mt-1 space-y-0.5">
                  {festivals
                    .filter((f) => f.isActive)
                    .slice(0, 3)
                    .map((f) => (
                      <p key={f.id} className={cn('flex items-center gap-1 truncate font-medium', KIND_TINT[f.kind])}>
                        <CalendarIcon kind={f.kind} className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{f.name}</span>
                      </p>
                    ))}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-3 text-xs">
        {KINDS.map((k) => (
          <span key={k} className={cn('flex items-center gap-1', KIND_TINT[k])}>
            <CalendarIcon kind={k} /> {KIND_LABEL[k]}
          </span>
        ))}
        <span className="text-muted-foreground">S/K = Shukla/Krishna paksha · tithi at sunrise · amber dot = edited</span>
      </div>

      {open && data && (
        <DayDialog
          date={open}
          zone={zone}
          day={byDate(open).day}
          festivals={byDate(open).festivals}
          onClose={() => setOpen(null)}
          mutate={mutate}
        />
      )}
    </div>
  );
}

function DayDialog({
  date,
  zone,
  day,
  festivals,
  onClose,
  mutate,
}: {
  date: string;
  zone: string;
  day?: Day;
  festivals: Festival[];
  onClose: () => void;
  mutate: ReturnType<typeof useResourceMutation>;
}) {
  const [form, setForm] = useState({
    tithiNumber: String(day?.tithi.number ?? ''),
    tithiName: day?.tithi.name ?? '',
    nakshatra: day?.nakshatra.name ?? '',
    yoga: day?.yoga ?? '',
    karana: day?.karana ?? '',
    monthAmanta: day?.month ?? '',
    notes: day?.notes ?? '',
  });
  const [add, setAdd] = useState({ name: '', kind: 'FESTIVAL' });
  const [error, setError] = useState('');
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function run(path: string, method: 'post' | 'patch' | 'delete', body?: unknown) {
    setError('');
    try {
      await mutate.mutateAsync({ path, method, body });
      return true;
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Could not save.');
      return false;
    }
  }

  async function saveDay() {
    const ok = await run(`/api/admin/panchang/days/${date}`, 'patch', {
      tithiNumber: Number(form.tithiNumber),
      tithiName: form.tithiName,
      nakshatra: form.nakshatra,
      yoga: form.yoga,
      karana: form.karana,
      monthAmanta: form.monthAmanta,
      notes: form.notes || null,
    });
    if (ok) onClose();
  }

  async function addFestival() {
    const slug = add.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
    if (slug.length < 2) return setError('Give the festival a name.');
    if (await run('/api/admin/panchang/festivals', 'post', { date, slug, kind: add.kind, name: add.name.trim() })) {
      setAdd({ name: '', kind: 'FESTIVAL' });
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}
          </DialogTitle>
        </DialogHeader>

        {!day ? (
          <p className="text-sm text-muted-foreground">No panchang saved for this date.</p>
        ) : (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Sunrise {time(day.sunrise, zone)} · Sunset {time(day.sunset, zone)} · Moonrise {time(day.moonrise, zone)}
              <br />
              Tithi to {dateTime(day.tithi.endsAt, zone)} · Nakshatra to {dateTime(day.nakshatra.endsAt, zone)}
              <br />
              {day.month}
              {day.isAdhika ? ' (Adhika)' : ''} ({day.monthPurnimanta} purnimanta) · Sun in {day.sunSign}, Moon in {day.moonSign}
              <br />
              Vikram {day.vikramSamvat} · Shaka {day.shakaSamvat}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">Tithi number (1–30)</span>
                <Input type="number" min={1} max={30} value={form.tithiNumber} onChange={set('tithiNumber')} />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">Tithi</span>
                <Input value={form.tithiName} onChange={set('tithiName')} />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">Nakshatra</span>
                <Input value={form.nakshatra} onChange={set('nakshatra')} />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">Yoga</span>
                <Input value={form.yoga} onChange={set('yoga')} />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">Karana</span>
                <Input value={form.karana} onChange={set('karana')} />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">Month (amanta)</span>
                <Input value={form.monthAmanta} onChange={set('monthAmanta')} />
              </label>
            </div>
            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground">Note shown with the day</span>
              <Input value={form.notes} onChange={set('notes')} maxLength={1000} />
            </label>
            {day.isEdited && <Badge variant="warning">Edited by hand — generating the year keeps it</Badge>}
          </div>
        )}

        <div className="mt-4 space-y-2 border-t pt-3">
          <h4 className="text-sm font-medium">Festivals on this day</h4>
          {festivals.length === 0 && <p className="text-xs text-muted-foreground">None.</p>}
          {festivals.map((f) => (
            <div key={f.id} className="flex items-center gap-2 rounded-md border p-2">
              <CalendarIcon kind={f.kind} className={cn('h-5 w-5 shrink-0', KIND_TINT[f.kind])} />
              <div className="min-w-0 flex-1">
                <p className={cn('truncate text-sm font-medium', !f.isActive && 'line-through opacity-60')}>{f.name}</p>
                <p className="text-xs text-muted-foreground">
                  {KIND_LABEL[f.kind]}
                  {f.vaishnavaDate ? ` · Vaishnavas: ${f.vaishnavaDate}` : ''}
                  {f.notifiedDays.length ? ` · pushed ${f.notifiedDays.map((n) => (n === 0 ? 'same day' : `${n}d before`)).join(', ')}` : ''}
                </p>
              </div>
              <label className="flex items-center gap-1 text-xs">
                Push
                <Switch
                  aria-label={`Push for ${f.name}`}
                  checked={f.notify}
                  onCheckedChange={(v) => run(`/api/admin/panchang/festivals/${f.id}`, 'patch', { notify: v })}
                />
              </label>
              <label className="flex items-center gap-1 text-xs">
                Shown
                <Switch
                  aria-label={`Show ${f.name}`}
                  checked={f.isActive}
                  onCheckedChange={(v) => run(`/api/admin/panchang/festivals/${f.id}`, 'patch', { isActive: v })}
                />
              </label>
              <Button variant="ghost" size="icon" aria-label={`Delete ${f.name}`} onClick={() => run(`/api/admin/panchang/festivals/${f.id}`, 'delete')}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Input placeholder="Add a festival…" value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} />
            <Select value={add.kind} onChange={(e) => setAdd({ ...add, kind: e.target.value })} aria-label="Kind">
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </Select>
            <Button variant="outline" onClick={addFestival} aria-label="Add festival">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {day && (
            <Button onClick={saveDay} disabled={mutate.isPending}>
              Save day
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
