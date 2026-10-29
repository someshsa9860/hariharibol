// One email template: its brief, a variant per language, the blocks of the open variant, a preview as the reader will
// see it, approval, and the AI draft / translate buttons. Checks are the server's (422 lists every problem).

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Check, Plus, Sparkles, Trash2 } from 'lucide-react';
import { api, ApiRequestError } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ModelPicker } from '@/components/model-picker';
import type { Block, Overview, TemplateDetail, Variant } from '@/lib/marketing';

const NEW_BLOCK: Record<string, Block> = {
  heading: { type: 'heading', text: '', level: 1 }, paragraph: { type: 'paragraph', text: '' },
  verse: { type: 'verse', text: '', sanskrit: '', source: '' }, button: { type: 'button', label: '', link: 1 },
  image: { type: 'image', url: '', alt: '' }, divider: { type: 'divider' }, spacer: { type: 'spacer', size: 'medium' },
};
const problemsOf = (err: unknown): string[] => {
  if (err instanceof ApiRequestError) return Array.isArray(err.details) ? (err.details as string[]) : [err.message];
  return [err instanceof Error ? err.message : 'Something went wrong'];
};

function BlockRow({ block, index, count, onChange, onMove, onRemove }: { block: Block; index: number; count: number; onChange: (b: Block) => void; onMove: (d: -1 | 1) => void; onRemove: () => void }) {
  const set = (key: string, value: unknown) => onChange({ ...block, [key]: value });
  const str = (key: string) => String(block[key] ?? '');
  return (
    <div className="rounded-md border p-3">
      <div className="mb-2 flex items-center justify-between">
        <Badge variant="secondary">{index + 1}. {block.type}</Badge>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Move up"><ArrowUp className="h-4 w-4" /></Button>
          <Button size="sm" variant="ghost" disabled={index === count - 1} onClick={() => onMove(1)} aria-label="Move down"><ArrowDown className="h-4 w-4" /></Button>
          <Button size="sm" variant="ghost" onClick={onRemove} aria-label="Remove block"><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>
      <div className="space-y-2">
        {(block.type === 'heading' || block.type === 'paragraph' || block.type === 'verse') && (
          <Textarea rows={block.type === 'heading' ? 1 : 3} value={str('text')} onChange={(e) => set('text', e.target.value)} placeholder={block.type === 'verse' ? 'Translation' : 'Text — merge fields like {{firstName|friend}}'} />
        )}
        {block.type === 'heading' && (
          <Select value={String(block.level ?? 1)} onChange={(e) => set('level', Number(e.target.value))}>
            <option value="1">Large heading</option><option value="2">Smaller heading</option>
          </Select>
        )}
        {block.type === 'verse' && (
          <>
            <Input value={str('sanskrit')} onChange={(e) => set('sanskrit', e.target.value)} placeholder="Sanskrit (optional)" />
            <Input value={str('source')} onChange={(e) => set('source', e.target.value)} placeholder="Source, e.g. Bhagavad-gita 9.34" />
          </>
        )}
        {block.type === 'button' && (
          <div className="grid grid-cols-[1fr_8rem] gap-2">
            <Input value={str('label')} onChange={(e) => set('label', e.target.value)} placeholder="Button label" />
            <Input type="number" min={1} max={5} value={String(block.link ?? 1)} onChange={(e) => set('link', Number(e.target.value))} aria-label="Link slot" />
          </div>
        )}
        {block.type === 'image' && (
          <>
            <Input value={str('url')} onChange={(e) => set('url', e.target.value)} placeholder="https://… (picture link)" />
            <div className="grid grid-cols-[1fr_8rem] gap-2">
              <Input value={str('alt')} onChange={(e) => set('alt', e.target.value)} placeholder="Describe the picture" />
              <Input type="number" min={1} max={5} value={block.link ? String(block.link) : ''} onChange={(e) => set('link', e.target.value ? Number(e.target.value) : undefined)} placeholder="Link slot" />
            </div>
          </>
        )}
        {block.type === 'spacer' && (
          <Select value={str('size')} onChange={(e) => set('size', e.target.value)}>
            <option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option>
          </Select>
        )}
      </div>
    </div>
  );
}

function VariantEditor({ template, variant, language, overview, onSaved }: { template: TemplateDetail; variant: Variant | null; language: string; overview: Overview; onSaved: () => void }) {
  const [subject, setSubject] = useState(variant?.subject ?? '');
  const [preheader, setPreheader] = useState(variant?.preheader ?? '');
  const [blocks, setBlocks] = useState<Block[]>(variant?.blocks ?? []);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [html, setHtml] = useState('');
  const [testNote, setTestNote] = useState('');
  const [ai, setAi] = useState({ provider: overview.ai.defaultProvider, model: '', tone: '', from: 'en' });

  useEffect(() => {
    setSubject(variant?.subject ?? ''); setPreheader(variant?.preheader ?? ''); setBlocks(variant?.blocks ?? []); setErrors([]); setHtml('');
  }, [variant?.id, variant?.subject, variant?.status, language]);

  const words = { subject, preheader: preheader || null, blocks };
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErrors([]);
    try { await fn(); onSaved(); } catch (err) { setErrors(problemsOf(err)); } finally { setBusy(false); }
  };
  const base = `/api/admin/marketing/templates/${template.id}/variants/${language}`;
  const hasVariants = template.variants.length > 0;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {variant ? <Badge variant={variant.status === 'APPROVED' ? 'success' : 'secondary'}>{variant.status === 'APPROVED' ? 'Approved' : 'Draft'}</Badge> : <Badge variant="secondary">Not written yet</Badge>}
          {variant && <span className="text-xs text-muted-foreground">{variant.source}{variant.editedByHuman ? ' · edited by a person' : ''}</span>}
        </div>
        <div><Label>Subject</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
        <div><Label>Preheader (the grey preview line)</Label><Input value={preheader} onChange={(e) => setPreheader(e.target.value)} /></div>
        <div className="space-y-2">
          {blocks.map((b, i) => (
            <BlockRow key={i} block={b} index={i} count={blocks.length}
              onChange={(next) => setBlocks(blocks.map((x, j) => (j === i ? next : x)))}
              onMove={(d) => { const next = [...blocks]; [next[i], next[i + d]] = [next[i + d], next[i]]; setBlocks(next); }}
              onRemove={() => setBlocks(blocks.filter((_, j) => j !== i))} />
          ))}
          <div className="flex flex-wrap gap-1">
            {Object.keys(NEW_BLOCK).map((t) => (
              <Button key={t} size="sm" variant="outline" onClick={() => setBlocks([...blocks, { ...NEW_BLOCK[t] }])}><Plus className="mr-1 h-3 w-3" />{t}</Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Merge fields: {overview.mergeFields.map((f) => `{{${f.key}}}`).join(', ')}. Add a fallback after a bar: {'{{firstName|friend}}'}.</p>
        </div>
        {errors.length > 0 && <ul className="list-disc rounded-md border border-destructive/40 bg-destructive/5 p-3 pl-6 text-sm text-destructive">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => run(() => api.put(base, words))}>Save</Button>
          <Button variant="outline" disabled={busy} onClick={() => run(async () => { const res = await api.post<{ html: string }>('/api/admin/marketing/templates/preview', { ...words, language }); setHtml(res.data.html); })}>Preview</Button>
          <Button variant="outline" disabled={busy} onClick={() => run(async () => { await api.post('/api/admin/marketing/templates/test-send', { ...words, language, templateId: template.id }); setTestNote('Sent to your own address.'); })}>Send me a test</Button>
          {variant && variant.status === 'DRAFT' && <Button variant="outline" disabled={busy} onClick={() => run(() => api.post(`${base}/approve`))}><Check className="mr-1 h-4 w-4" />Approve</Button>}
          {variant && variant.status === 'APPROVED' && <Button variant="outline" disabled={busy} onClick={() => run(() => api.post(`${base}/unapprove`))}>Back to draft</Button>}
          {variant && <Button variant="ghost" disabled={busy} onClick={() => { if (confirm('Delete this language?')) void run(() => api.delete(base)); }}>Delete</Button>}
        </div>
        {testNote && <p className="text-sm text-muted-foreground">{testNote}</p>}
        <p className="text-xs text-muted-foreground">Saving makes the variant a draft again; only an approved variant is sent.</p>

        <div className="rounded-md border p-3">
          <p className="mb-2 flex items-center gap-1 text-sm font-medium"><Sparkles className="h-4 w-4" />Write with AI</p>
          <ModelPicker idPrefix="mkt-tpl" providers={overview.ai.providers} provider={ai.provider} model={ai.model} onChange={(n) => setAi({ ...ai, ...n })} />
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <Input placeholder="Tone, e.g. warm, short" value={ai.tone} onChange={(e) => setAi({ ...ai, tone: e.target.value })} />
            <Select value={ai.from} onChange={(e) => setAi({ ...ai, from: e.target.value })} aria-label="Translate from">
              {template.variants.map((v) => <option key={v.language} value={v.language}>Translate from {v.language}</option>)}
            </Select>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => api.post(`/api/admin/marketing/templates/${template.id}/ai/draft`, { language, tone: ai.tone || undefined, provider: ai.provider, model: ai.model || undefined, force: variant?.editedByHuman ? confirm('A person wrote this one. Replace it?') : undefined }))}>Draft from the brief</Button>
            <Button size="sm" variant="outline" disabled={busy || !hasVariants || ai.from === language} onClick={() => run(() => api.post(`/api/admin/marketing/templates/${template.id}/ai/translate`, { from: ai.from, to: language, provider: ai.provider, model: ai.model || undefined, force: variant?.editedByHuman ? confirm('A person wrote this one. Replace it?') : undefined }))}>Translate</Button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">AI words are drafts: read them, then approve.</p>
        </div>
      </div>
      <div>
        <p className="mb-1 text-sm font-medium">Preview</p>
        {html ? <iframe title="Email preview" sandbox="" srcDoc={html} className="h-[640px] w-full rounded-md border bg-white" /> : <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">Press Preview to see the email with sample values.</div>}
      </div>
    </div>
  );
}

export function TemplateEditor({ templateId, overview, onClose }: { templateId: string; overview: Overview; onClose: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['marketing-template', templateId], queryFn: async () => (await api.get<TemplateDetail>(`/api/admin/marketing/templates/${templateId}`)).data });
  const [language, setLanguage] = useState('en');
  const [brief, setBrief] = useState<string | null>(null);
  const t = q.data;
  const variant = useMemo(() => t?.variants.find((v) => v.language === language) ?? null, [t, language]);
  const saved = () => { void qc.invalidateQueries({ queryKey: ['marketing-template', templateId] }); void qc.invalidateQueries({ queryKey: ['marketing-templates'] }); };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t?.name ?? 'Template'}</DialogTitle>
          <DialogDescription>One template, a variant for each language. Readers get their reading language when it is approved, else English.</DialogDescription>
        </DialogHeader>
        {t && (
          <div className="space-y-4">
            <div>
              <Label>What is this email for? (the AI works from this)</Label>
              <Textarea rows={2} value={brief ?? t.brief ?? ''} onChange={(e) => setBrief(e.target.value)} />
              {brief !== null && brief !== (t.brief ?? '') && <Button size="sm" className="mt-1" onClick={async () => { await api.patch(`/api/admin/marketing/templates/${t.id}`, { brief }); setBrief(null); saved(); }}>Save brief</Button>}
            </div>
            <div className="flex flex-wrap gap-1">
              {overview.languages.map((l) => {
                const v = t.variants.find((x) => x.language === l.code);
                return (
                  <Button key={l.code} size="sm" variant={l.code === language ? 'default' : 'outline'} onClick={() => setLanguage(l.code)}>
                    {l.endonym}{v ? (v.status === 'APPROVED' ? ' ✓' : ' …') : ''}
                  </Button>
                );
              })}
            </div>
            <VariantEditor template={t} variant={variant} language={language} overview={overview} onSaved={saved} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
