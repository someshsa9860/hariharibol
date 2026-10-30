// Audiences: saved segments of readers, lists of invitees (with the CSV import and its consent attestation), and the
// do-not-send list. The suppression list keeps only hashes, so it is searched by typing an address.

import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiRequestError } from '@/lib/api';
import { parseCsv } from '@/lib/csv';
import { useResource } from '@/lib/use-resource';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input, Label, Textarea } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AudienceFilterForm } from '@/components/marketing-audience-filter';
import type { AudienceFilter, ContactList, Segment } from '@/lib/marketing';

const message = (err: unknown) => (err instanceof ApiRequestError ? err.message : err instanceof Error ? err.message : 'Something went wrong');

function Segments({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const segments = useResource<Segment[]>(['marketing-segments'], '/api/admin/marketing/segments');
  const [name, setName] = useState('');
  const [filter, setFilter] = useState<AudienceFilter>({});
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const refresh = () => void qc.invalidateQueries({ queryKey: ['marketing-segments'] });

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Segments of readers</h3>
        {canManage && <Button size="sm" onClick={() => setOpen(true)}>New segment</Button>}
      </div>
      <div className="grid gap-2">
        {segments.data?.map((s) => (
          <Card key={s.id}><CardContent className="flex items-center justify-between gap-3 p-3">
            <div><p className="font-medium">{s.name}</p><p className="text-xs text-muted-foreground">{s.summary}{s.lastCount != null ? ` · ${s.lastCount.toLocaleString()} when last counted` : ''}</p></div>
            {canManage && <Button size="sm" variant="ghost" onClick={async () => { if (confirm(`Delete “${s.name}”?`)) { await api.delete(`/api/admin/marketing/segments/${s.id}`); refresh(); } }}>Delete</Button>}
          </CardContent></Card>
        ))}
        {segments.data?.length === 0 && <p className="text-sm text-muted-foreground">No segments yet. A campaign can also carry its own filter without saving one.</p>}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>New segment</DialogTitle><DialogDescription>A saved filter. A campaign made from it keeps the filter it was made with.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <AudienceFilterForm value={filter} onChange={setFilter} />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button disabled={!name.trim()} onClick={async () => { try { await api.post('/api/admin/marketing/segments', { name, filter }); setOpen(false); setName(''); setFilter({}); setError(''); refresh(); } catch (err) { setError(message(err)); } }}>Save segment</Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

type ImportTotals = { counts: Record<string, number>; totals: { rows: number; added: number; skipped: number; summary: unknown } };
const CHUNK = 500;

function ImportDialog({ list, onClose, onDone }: { list: ContactList; onClose: () => void; onDone: () => void }) {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState('');
  const [attestation, setAttestation] = useState('');
  const [email, setEmail] = useState(true);
  const [whatsapp, setWhatsapp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportTotals | null>(null);
  const [checked, setChecked] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState('');
  const file = useRef<HTMLInputElement>(null);

  const read = async (f: File) => {
    const table = parseCsv(await f.text());
    const header = (table[0] ?? []).map((h) => h.trim().toLowerCase());
    const col = (names: string[]) => header.findIndex((h) => names.includes(h));
    const [ei, pi, ni, li] = [col(['email', 'e-mail', 'mail']), col(['phone', 'mobile', 'whatsapp']), col(['name', 'full name']), col(['language', 'lang'])];
    if (ei < 0 && pi < 0) { setError('The first row must name the columns; at least “email” or “phone”.'); setRows([]); return; }
    setError(''); setFileName(f.name); setChecked(null); setResult(null);
    setRows(table.slice(1).map((r) => ({ email: ei >= 0 ? r[ei] ?? '' : '', phone: pi >= 0 ? r[pi] ?? '' : '', name: ni >= 0 ? r[ni] ?? '' : '', language: li >= 0 ? r[li] ?? '' : '' })));
  };
  const chunks = () => Array.from({ length: Math.ceil(rows.length / CHUNK) }, (_, i) => rows.slice(i * CHUNK, (i + 1) * CHUNK));

  const check = async () => {
    setBusy(true); setError('');
    try {
      const sum: Record<string, number> = {};
      for (const c of chunks()) {
        const res = await api.post<{ counts: Record<string, number> }>('/api/admin/marketing/contacts/import/check', { rows: c, attestsEmail: email, attestsWhatsApp: whatsapp });
        for (const [k, v] of Object.entries(res.data.counts)) sum[k] = (sum[k] ?? 0) + v;
      }
      setChecked(sum);
    } catch (err) { setError(message(err)); } finally { setBusy(false); }
  };
  const run = async () => {
    setBusy(true); setError('');
    try {
      let importId: string | undefined;
      let last: ImportTotals | null = null;
      for (const c of chunks()) {
        const res = await api.post<ImportTotals & { importId: string }>('/api/admin/marketing/contacts/import', { listId: list.id, rows: c, importId, fileName, attestation, attestsEmail: email, attestsWhatsApp: whatsapp });
        importId = res.data.importId; last = res.data;
      }
      setResult(last); onDone();
    } catch (err) { setError(message(err)); } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Import into “{list.name}”</DialogTitle><DialogDescription>A CSV with a header row: email, phone, name, language. Only import people who agreed to hear from us.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <input ref={file} type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && void read(e.target.files[0])} />
          {rows.length > 0 && <p className="text-sm">{rows.length.toLocaleString()} rows in {fileName}</p>}
          <div>
            <Label>Who confirmed these people agreed, and how? (kept in the consent log)</Label>
            <Textarea rows={3} value={attestation} onChange={(e) => setAttestation(e.target.value)} placeholder="e.g. Satsang sign-up sheet, Vrindavan retreat, Oct 2026" />
          </div>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={email} onChange={(e) => setEmail(e.target.checked)} />They agreed to email</label>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={whatsapp} onChange={(e) => setWhatsapp(e.target.checked)} />They agreed to WhatsApp</label>
          {checked && <div className="flex flex-wrap gap-2">{Object.entries(checked).map(([k, v]) => <Badge key={k} variant="secondary">{k}: {v.toLocaleString()}</Badge>)}</div>}
          {result && <p className="text-sm text-green-700 dark:text-green-400">Added {result.totals.added.toLocaleString()}, skipped {result.totals.skipped.toLocaleString()}.</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button variant="outline" disabled={busy || rows.length === 0} onClick={check}>Check</Button>
            <Button disabled={busy || rows.length === 0 || attestation.trim().length < 10 || (!email && !whatsapp)} onClick={run}>Import</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Lists({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const lists = useResource<ContactList[]>(['marketing-lists'], '/api/admin/marketing/lists');
  const [name, setName] = useState('');
  const [importing, setImporting] = useState<ContactList | null>(null);
  const refresh = () => void qc.invalidateQueries({ queryKey: ['marketing-lists'] });
  return (
    <section className="space-y-3">
      <h3 className="font-medium">Lists of invitees</h3>
      {canManage && (
        <div className="flex gap-2">
          <Input placeholder="New list name" value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs" />
          <Button disabled={!name.trim()} onClick={async () => { await api.post('/api/admin/marketing/lists', { name }); setName(''); refresh(); }}>Add list</Button>
        </div>
      )}
      <div className="grid gap-2">
        {lists.data?.map((l) => (
          <Card key={l.id}><CardContent className="flex items-center justify-between gap-3 p-3">
            <div><p className="font-medium">{l.name}</p><p className="text-xs text-muted-foreground">{l.memberCount.toLocaleString()} people{l.description ? ` · ${l.description}` : ''}</p></div>
            {canManage && <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => setImporting(l)}>Import CSV</Button>
              <Button size="sm" variant="ghost" onClick={async () => { if (confirm(`Delete the list “${l.name}”? The people stay.`)) { await api.delete(`/api/admin/marketing/lists/${l.id}`); refresh(); } }}>Delete</Button>
            </div>}
          </CardContent></Card>
        ))}
      </div>
      {importing && <ImportDialog list={importing} onClose={() => setImporting(null)} onDone={refresh} />}
    </section>
  );
}

type Lookup = { found: boolean; suppressed: boolean; log: { id: string; action: string; channel: string; source: string | null; createdAt: string; note?: string | null }[] };

function DoNotSend({ canManage }: { canManage: boolean }) {
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<Lookup | null>(null);
  const [error, setError] = useState('');
  const look = async () => { try { setResult((await api.get<Lookup>('/api/admin/marketing/consent', { email })).data); setError(''); } catch (err) { setError(message(err)); } };
  return (
    <section className="space-y-3">
      <h3 className="font-medium">Do not send</h3>
      <p className="text-sm text-muted-foreground">Unsubscribes, hard bounces and complaints land here by themselves. Only a hash of the address is kept, so look an address up by typing it.</p>
      <div className="flex flex-wrap gap-2">
        <Input placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="max-w-sm" />
        <Button variant="outline" disabled={email.length < 3} onClick={look}>Look up</Button>
        {canManage && <Button variant="outline" disabled={email.length < 3} onClick={async () => { try { await api.post('/api/admin/marketing/suppression', { email, note: 'Added in the admin panel' }); await look(); } catch (err) { setError(message(err)); } }}>Block</Button>}
        {canManage && result?.suppressed && <Button variant="outline" onClick={async () => { if (confirm('Only do this when the person asked to hear from us again.')) { await api.post('/api/admin/marketing/suppression/remove', { email }); await look(); } }}>Allow again</Button>}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {result && (
        <div className="rounded-md border p-3 text-sm">
          <p>{result.suppressed ? <Badge variant="destructive">Blocked</Badge> : <Badge variant="success">Not blocked</Badge>} {result.found ? 'A reader or invitee has this address.' : 'No reader or invitee has this address.'}</p>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">{result.log.map((l) => <li key={l.id}>{new Date(l.createdAt).toLocaleString()} · {l.action} · {l.channel}{l.source ? ` · ${l.source}` : ''}</li>)}</ul>
        </div>
      )}
    </section>
  );
}

export function MarketingAudiences({ canManage }: { canManage: boolean }) {
  return <div className="space-y-8"><Segments canManage={canManage} /><Lists canManage={canManage} /><DoNotSend canManage={canManage} /></div>;
}
