// The filter that picks which readers a campaign or a segment reaches, with a live count. Only readers are filtered
// here; invitees come in through lists. Nobody who is banned, has a stand-in address or switched marketing off is counted.

import { useEffect, useState } from 'react';
import { api, ApiRequestError } from '@/lib/api';
import { Input, Label, Select } from '@/components/ui/input';
import { FILTER_FIELDS, type AudienceFilter } from '@/lib/marketing';

type Preview = { count: number; summary: string; sample: { id: string; name: string | null; email: string; language: string | null; country: string | null }[] };

const toList = (text: string) => text.split(',').map((s) => s.trim()).filter(Boolean);

export function AudienceFilterForm({ value, onChange, showPreview = true }: { value: AudienceFilter; onChange: (f: AudienceFilter) => void; showPreview?: boolean }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  const key = JSON.stringify(value);

  useEffect(() => {
    if (!showPreview) return;
    let live = true;
    const timer = setTimeout(async () => {
      try {
        const res = await api.post<Preview>('/api/admin/marketing/segments/preview', { filter: value });
        if (live) { setPreview(res.data); setError(''); }
      } catch (err) {
        if (live) { setPreview(null); setError(err instanceof ApiRequestError ? err.message : 'Could not count'); }
      }
    }, 400);
    return () => { live = false; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, showPreview]);

  const setNumber = (name: string, text: string) => {
    const next: Record<string, unknown> = { ...value };
    if (text === '') delete next[name]; else next[name] = Number(text);
    onChange(next as AudienceFilter);
  };
  const setList = (name: string, text: string) => {
    const next: Record<string, unknown> = { ...value };
    const list = toList(text);
    if (list.length === 0) delete next[name]; else next[name] = list;
    onChange(next as AudienceFilter);
  };
  const setTri = (name: 'donors' | 'premium', text: string) => {
    const next: Record<string, unknown> = { ...value };
    if (text === '') delete next[name]; else next[name] = text === 'yes';
    onChange(next as AudienceFilter);
  };
  const tri = (v: boolean | undefined) => (v === undefined ? '' : v ? 'yes' : 'no');

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {FILTER_FIELDS.lists.map(([name, label]) => (
          <div key={name}><Label>{label}</Label><Input defaultValue={((value as Record<string, string[] | undefined>)[name] ?? []).join(', ')} onBlur={(e) => setList(name, e.target.value)} /></div>
        ))}
        {FILTER_FIELDS.numbers.map(([name, label]) => (
          <div key={name}><Label>{label}</Label><Input type="number" min={0} value={String((value as Record<string, number | undefined>)[name] ?? '')} onChange={(e) => setNumber(name, e.target.value)} /></div>
        ))}
        <div><Label>Has donated</Label><Select value={tri(value.donors)} onChange={(e) => setTri('donors', e.target.value)}><option value="">Any</option><option value="yes">Yes</option><option value="no">No</option></Select></div>
        <div><Label>Paid plan now</Label><Select value={tri(value.premium)} onChange={(e) => setTri('premium', e.target.value)}><option value="">Any</option><option value="yes">Yes</option><option value="no">No</option></Select></div>
        <div><Label>Has never chanted</Label><Select value={tri(value.neverChanted)} onChange={(e) => { const next = { ...value }; if (e.target.value === '') delete next.neverChanted; else next.neverChanted = e.target.value === 'yes'; onChange(next); }}><option value="">Any</option><option value="yes">Yes</option></Select></div>
        <div>
          <Label>Platform</Label>
          <Select value={value.platforms?.[0] ?? ''} onChange={(e) => { const next = { ...value }; if (e.target.value === '') delete next.platforms; else next.platforms = [e.target.value as 'android' | 'ios' | 'web']; onChange(next); }}>
            <option value="">Any</option><option value="android">Android</option><option value="ios">iOS</option><option value="web">Web</option>
          </Select>
        </div>
      </div>
      {showPreview && (
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          {error ? <p className="text-destructive">{error}</p> : preview ? (
            <>
              <p><strong>{preview.count.toLocaleString()}</strong> readers — {preview.summary}</p>
              {preview.sample.length > 0 && <p className="mt-1 text-xs text-muted-foreground">e.g. {preview.sample.map((s) => `${s.name ?? 'Reader'} <${s.email}>`).join(', ')}</p>}
            </>
          ) : <p className="text-muted-foreground">Counting…</p>}
        </div>
      )}
    </div>
  );
}
