// A campaign: the editor (name, template, who, links, how it is written, pace) with the review numbers, and the detail
// with live progress, the controls, the funnel, links, failures, the feed and the app activity that followed.

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiRequestError } from '@/lib/api';
import { useResource } from '@/lib/use-resource';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ModelPicker } from '@/components/model-picker';
import { AudienceFilterForm } from '@/components/marketing-audience-filter';
import { STATUS_VARIANT, pct, type Audience, type Campaign, type CampaignDetail, type ContactList, type Overview, type Segment, type Template } from '@/lib/marketing';

const message = (err: unknown) => (err instanceof ApiRequestError ? err.message : err instanceof Error ? err.message : 'Something went wrong');

type LinkRow = { position: number; kind: 'WEB' | 'APP'; target: string; label: string };
type Estimate = { total: number; byLanguage: { language: string; readers: number; approved: boolean }[]; englishFallback: number; aiCost: unknown; minutes: number; ratePerMinute: number; note: string } & Record<string, unknown>;

export function CampaignEditor({ campaignId, overview, onClose, onSaved }: { campaignId: string | null; overview: Overview; onClose: () => void; onSaved: (id: string) => void }) {
  const existing = useQuery({ queryKey: ['marketing-campaign', campaignId], enabled: Boolean(campaignId), queryFn: async () => (await api.get<CampaignDetail>(`/api/admin/marketing/campaigns/${campaignId}`)).data });
  const templates = useResource<Template[]>(['marketing-templates'], '/api/admin/marketing/templates');
  const segments = useResource<Segment[]>(['marketing-segments'], '/api/admin/marketing/segments');
  const lists = useResource<ContactList[]>(['marketing-lists'], '/api/admin/marketing/lists');

  if (campaignId && !existing.data) return null;
  const base = existing.data;
  return <EditorBody key={campaignId ?? 'new'} base={base} overview={overview} templates={templates.data ?? []} segments={segments.data ?? []} lists={lists.data ?? []} onClose={onClose} onSaved={onSaved} />;
}

function EditorBody({ base, overview, templates, segments, lists, onClose, onSaved }: { base?: CampaignDetail; overview: Overview; templates: Template[]; segments: Segment[]; lists: ContactList[]; onClose: () => void; onSaved: (id: string) => void }) {
  const c = base?.campaign;
  const [name, setName] = useState(c?.name ?? '');
  const [templateId, setTemplateId] = useState(c?.templateId ?? '');
  const [audience, setAudience] = useState<Audience>(c?.audience ?? { users: {}, lists: [] });
  const [mode, setMode] = useState<'MERGE' | 'AI_PER_USER'>(c?.mode ?? 'MERGE');
  const [ai, setAi] = useState({ provider: c?.provider ?? overview.ai.defaultProvider, model: c?.model ?? '' });
  const [maxCost, setMaxCost] = useState(c?.maxCostUsd != null ? String(c.maxCostUsd) : '');
  const [rate, setRate] = useState(c?.ratePerMinute != null ? String(c.ratePerMinute) : '');
  const [links, setLinks] = useState<LinkRow[]>((base?.links ?? []).map((l) => ({ position: l.position, kind: l.kind, target: l.target, label: l.label ?? '' })));
  const [useReaders, setUseReaders] = useState(Boolean(audience.users));
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const body = () => ({
    name, templateId: templateId || null, mode, provider: ai.provider as 'openai', model: ai.model || undefined,
    maxCostUsd: maxCost ? Number(maxCost) : undefined, ratePerMinute: rate ? Number(rate) : null,
    audience: { users: useReaders ? audience.users ?? {} : null, lists: audience.lists ?? [] },
    links: links.map((l) => ({ position: l.position, kind: l.kind, target: l.target, label: l.label || null })),
  });
  const save = async () => {
    setBusy(true); setError('');
    try {
      const res = c ? await api.patch<Campaign>(`/api/admin/marketing/campaigns/${c.id}`, body()) : await api.post<Campaign>('/api/admin/marketing/campaigns', body());
      onSaved(res.data.id);
    } catch (err) { setError(message(err)); } finally { setBusy(false); }
  };
  const review = async () => {
    setBusy(true); setError('');
    try { setEstimate((await api.post<Estimate>('/api/admin/marketing/estimate', { ...body(), links: undefined, name: undefined })).data); } catch (err) { setError(message(err)); } finally { setBusy(false); }
  };
  const toggleList = (id: string) => setAudience({ ...audience, lists: audience.lists?.includes(id) ? audience.lists.filter((x) => x !== id) : [...(audience.lists ?? []), id] });
  const nextSlot = () => { for (let i = 1; i <= overview.limits.maxLinks; i++) if (!links.some((l) => l.position === i)) return i; return null; };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>{c ? 'Edit campaign' : 'New campaign'}</DialogTitle><DialogDescription>Choose the email, who gets it and where its buttons lead. Nothing is sent until you start it.</DialogDescription></DialogHeader>
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Name (only you see it)</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><Label>Template</Label>
              <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                <option value="">Choose…</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.variants.filter((v) => v.status === 'APPROVED').length} approved)</option>)}
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium">Who</h4>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={useReaders} onChange={(e) => setUseReaders(e.target.checked)} />Readers of the app who match…</label>
            {useReaders && (
              <>
                <Select value="" onChange={(e) => { const s = segments.find((x) => x.id === e.target.value); if (s) setAudience({ ...audience, users: s.filter }); }}>
                  <option value="">Start from a saved segment…</option>
                  {segments.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
                <AudienceFilterForm value={audience.users ?? {}} onChange={(f) => setAudience({ ...audience, users: f })} />
              </>
            )}
            {lists.length > 0 && <div className="space-y-1"><p className="text-sm">Lists of invitees</p>{lists.map((l) => <label key={l.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={audience.lists?.includes(l.id) ?? false} onChange={() => toggleList(l.id)} />{l.name} ({l.memberCount.toLocaleString()})</label>)}</div>}
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium">Buttons and where they lead</h4>
            <p className="text-xs text-muted-foreground">A button in the email names a slot; each slot leads to a website address (https://…) or a place in the app.</p>
            {links.map((l, i) => (
              <div key={l.position} className="grid gap-2 sm:grid-cols-[4rem_7rem_1fr_auto]">
                <Badge variant="secondary" className="justify-center">Slot {l.position}</Badge>
                <Select value={l.kind} onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, kind: e.target.value as 'WEB' | 'APP', target: e.target.value === 'APP' ? 'hariharibol://sakha' : '' } : x)))}><option value="WEB">Website</option><option value="APP">In the app</option></Select>
                {l.kind === 'APP'
                  ? <Select value={l.target.replace(/\?.*/, '')} onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, target: e.target.value } : x)))}>{overview.appTargets.map((t) => <option key={t.key} value={`hariharibol://${t.key}`}>{t.label}</option>)}</Select>
                  : <Input placeholder="https://hariharibol.com/…" value={l.target} onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, target: e.target.value } : x)))} />}
                <Button size="sm" variant="ghost" onClick={() => setLinks(links.filter((_, j) => j !== i))}>Remove</Button>
              </div>
            ))}
            {nextSlot() && <Button size="sm" variant="outline" onClick={() => setLinks([...links, { position: nextSlot()!, kind: 'WEB', target: '', label: '' }])}>Add a link</Button>}
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium">How it is written</h4>
            <Select value={mode} onChange={(e) => setMode(e.target.value as 'MERGE' | 'AI_PER_USER')}>
              <option value="MERGE">Same email, with each reader’s name and details filled in</option>
              <option value="AI_PER_USER">AI writes a personal email for each reader (you approve {overview.ai.sampleSize} first)</option>
            </Select>
            {mode === 'AI_PER_USER' && (
              <>
                <ModelPicker idPrefix="mkt-camp" providers={overview.ai.providers} provider={ai.provider} model={ai.model} onChange={(n) => setAi(n)} />
                <div><Label>Most the AI may cost for this campaign (USD)</Label><Input type="number" min={0} value={maxCost} onChange={(e) => setMaxCost(e.target.value)} /></div>
              </>
            )}
            <div><Label>Emails a minute (blank: {overview.limits.ratePerMinute})</Label><Input type="number" min={1} value={rate} onChange={(e) => setRate(e.target.value)} /></div>
          </div>

          {estimate && (
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <p><strong>{estimate.total.toLocaleString()}</strong> people, about {estimate.minutes} minute{estimate.minutes === 1 ? '' : 's'} at {estimate.ratePerMinute} a minute.</p>
              {estimate.byLanguage.length > 0 && <p className="mt-1 text-xs">{estimate.byLanguage.map((g) => `${g.language}: ${g.readers}${g.approved ? '' : ' (not approved → English)'}`).join(' · ')}</p>}
              <p className="mt-1 text-xs text-muted-foreground">{estimate.note}</p>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy || !name.trim()} onClick={save}>Save draft</Button>
            <Button variant="outline" disabled={busy} onClick={review}>Count and review</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const Stat = ({ label, value, sub }: { label: string; value: number | string; sub?: string }) => (
  <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold">{typeof value === 'number' ? value.toLocaleString() : value}</p>{sub && <p className="text-xs text-muted-foreground">{sub}</p>}</div>
);

export function CampaignDetailDialog({ id, canSend, canManage, onClose, onEdit }: { id: string; canSend: boolean; canManage: boolean; onClose: () => void; onEdit: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['marketing-campaign', id], refetchInterval: 15_000, queryFn: async () => (await api.get<CampaignDetail>(`/api/admin/marketing/campaigns/${id}`)).data });
  const impact = useQuery({ queryKey: ['marketing-campaign-impact', id], enabled: q.data?.campaign.status === 'COMPLETED', queryFn: async () => (await api.get<Record<string, unknown>>(`/api/admin/marketing/campaigns/${id}/impact`)).data });
  const [error, setError] = useState('');
  const [when, setWhen] = useState('');
  const d = q.data;
  const act = async (path: string, body?: unknown) => {
    setError('');
    try { await api.post(`/api/admin/marketing/campaigns/${id}/${path}`, body); void qc.invalidateQueries({ queryKey: ['marketing-campaign', id] }); void qc.invalidateQueries({ queryKey: ['marketing-campaigns'] }); } catch (err) { setError(message(err)); }
  };
  const c = d?.campaign;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader><DialogTitle>{c?.name ?? 'Campaign'}</DialogTitle><DialogDescription>{d?.template?.name ?? 'No template'} · {d?.audienceSummary ?? 'lists only'}</DialogDescription></DialogHeader>
        {c && d && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={STATUS_VARIANT[c.status]}>{c.status}</Badge>
              {c.pauseReason && <Badge variant="warning">{c.pauseReason}</Badge>}
              {c.stalled && <Badge variant="destructive">No heartbeat — is the worker running?</Badge>}
              {c.scheduledAt && <span className="text-sm text-muted-foreground">Scheduled {new Date(c.scheduledAt).toLocaleString()}</span>}
            </div>
            {c.statusMessage && <p className="rounded-md border p-3 text-sm">{c.statusMessage}</p>}
            {d.problems.length > 0 && <ul className="list-disc rounded-md border border-amber-500/40 bg-amber-500/5 p-3 pl-6 text-sm">{d.problems.map((p) => <li key={p}>{p}</li>)}</ul>}

            <div>
              <div className="h-2 overflow-hidden rounded bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${c.progress.percent}%` }} /></div>
              <p className="mt-1 text-xs text-muted-foreground">{c.progress.done.toLocaleString()} of {c.progress.total.toLocaleString()} settled ({c.progress.percent}%)</p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Recipients" value={d.funnel.recipients} />
              <Stat label="Sent" value={d.funnel.sent} sub={pct(d.funnel.sent, d.funnel.recipients)} />
              <Stat label="Delivered" value={d.funnel.delivered} sub={pct(d.funnel.delivered, d.funnel.sent)} />
              <Stat label="Opened (approx.)" value={d.funnel.opened} sub={pct(d.funnel.opened, d.funnel.delivered || d.funnel.sent)} />
              <Stat label="Clicked" value={d.funnel.clicked} sub={`${pct(d.funnel.clicked, d.funnel.sent)} · ${d.funnel.botClicks} bot`} />
              <Stat label="Bounced" value={d.funnel.bounced} />
              <Stat label="Complaints" value={d.funnel.complained} />
              <Stat label="Failed / skipped" value={`${d.funnel.failed} / ${d.funnel.skipped}`} />
            </div>
            {Object.keys(d.skipReasons).length > 0 && <p className="text-xs text-muted-foreground">Skipped because: {Object.entries(d.skipReasons).map(([k, v]) => `${k} (${v})`).join(', ')}</p>}
            {c.usage.calls > 0 && <p className="text-xs text-muted-foreground">AI: {c.usage.calls} calls, {(c.usage.inputTokens + c.usage.outputTokens).toLocaleString()} tokens, ${c.usage.costUsd.toFixed(2)}</p>}

            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex flex-wrap items-center gap-2">
              {canManage && c.status === 'DRAFT' && <Button variant="outline" onClick={onEdit}>Edit</Button>}
              {canSend && c.status === 'DRAFT' && <Button disabled={d.problems.length > 0} onClick={() => confirm('Start sending now?') && void act('start')}>Start now</Button>}
              {canSend && c.status === 'DRAFT' && <><Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="w-56" /><Button variant="outline" disabled={!when || d.problems.length > 0} onClick={() => void act('schedule', { scheduledAt: new Date(when).toISOString() })}>Schedule</Button></>}
              {canSend && c.status === 'SCHEDULED' && <Button variant="outline" onClick={() => void act('unschedule')}>Unschedule</Button>}
              {canSend && c.status === 'RUNNING' && <Button variant="outline" onClick={() => void act('pause')}>Pause</Button>}
              {canSend && (c.status === 'PAUSED' || c.status === 'FAILED') && <Button onClick={() => void act('resume')}>Resume</Button>}
              {canSend && c.pauseReason === 'sample_review' && <Button onClick={() => void act('approve-sample')}>Approve the sample and continue</Button>}
              {canSend && ['SCHEDULED', 'QUEUED', 'RUNNING', 'PAUSED', 'FAILED'].includes(c.status) && <Button variant="ghost" onClick={() => confirm('Cancel? Emails already sent stay sent.') && void act('cancel')}>Cancel</Button>}
              {canManage && <Button variant="ghost" onClick={() => void act('duplicate')}>Duplicate</Button>}
              {canManage && c.status === 'DRAFT' && <Button variant="ghost" onClick={async () => { if (confirm('Delete this draft?')) { await api.delete(`/api/admin/marketing/campaigns/${id}`); void qc.invalidateQueries({ queryKey: ['marketing-campaigns'] }); onClose(); } }}>Delete</Button>}
            </div>

            {d.samples.length > 0 && (
              <div><h4 className="mb-1 text-sm font-medium">AI sample emails</h4>
                <div className="space-y-2">{d.samples.map((s) => <div key={s.id} className="rounded-md border p-3 text-sm"><p className="font-medium">{s.subject} <span className="text-xs text-muted-foreground">({s.language})</span></p><pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(s.aiBlocks, null, 1)}</pre></div>)}</div>
              </div>
            )}

            {d.links.length > 0 && <div><h4 className="mb-1 text-sm font-medium">Links</h4><table className="w-full text-sm"><tbody>{d.links.map((l) => <tr key={l.position} className="border-b"><td className="py-1 pr-2">Slot {l.position}</td><td className="pr-2">{l.kind}</td><td className="break-all pr-2">{l.target}</td><td className="text-right">{l.clicks.toLocaleString()} clicks</td></tr>)}</tbody></table></div>}

            {Object.keys(d.attributions).length > 0 && <p className="text-sm">Afterwards: {Object.entries(d.attributions).map(([k, v]) => `${k.toLowerCase().replace(/_/g, ' ')} ${v}`).join(' · ')}</p>}
            {impact.data && <details className="text-sm"><summary className="cursor-pointer font-medium">Did it change anything? (readers who clicked vs. the rest)</summary><pre className="mt-1 overflow-auto rounded bg-muted p-2 text-xs">{JSON.stringify(impact.data, null, 1)}</pre></details>}

            {d.failures.length > 0 && <div><h4 className="mb-1 text-sm font-medium">Recent failures</h4><ul className="space-y-1 text-xs">{d.failures.map((f) => <li key={f.id}><Badge variant="secondary">{f.status}</Badge> {f.email} — {f.error ?? 'no detail'}</li>)}</ul></div>}

            <div><h4 className="mb-1 text-sm font-medium">Activity</h4>
              <ul className="max-h-48 space-y-0.5 overflow-auto text-xs text-muted-foreground">{d.feed.map((f, i) => <li key={i}>{new Date(f.at).toLocaleTimeString()} · {f.text ?? f.message}</li>)}{d.feed.length === 0 && <li>Nothing yet.</li>}</ul>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
