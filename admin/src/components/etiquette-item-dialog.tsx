// One etiquette item as a full page: the English wording and its source, whether readers see it (publish, hold back,
// exclude with a reason), and its translations — each one editable by hand, or deleted so a run can write it again.
// Opened for a new item with target "new".

import { useEffect, useRef, useState } from 'react';
import { Ban, CheckCircle2, ExternalLink, EyeOff, Loader2, Plus, Save, Send, Trash2, Undo2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiRequestError } from '@/lib/api';
import {
  STATUS_LABEL, STATUS_VARIANT, useCreateEtiquette, useDeleteEtiquetteTranslation, useEtiquetteItem, useSaveEtiquetteTranslation,
  useSetEtiquetteStatus, useUpdateEtiquette,
  type EtiquetteDetail, type EtiquetteOverview, type EtiquetteStatus, type EtiquetteTranslation,
} from '@/lib/etiquette';
import { cn, formatDate } from '@/lib/utils';

const LIMITS = { title: 160, summary: 300, body: 4000, reference: 200, author: 200, sourceName: 120 };
const TRANSLATION_LIMITS = { title: 400, summary: 800, body: 8000 };

const message = (err: unknown) => (err instanceof ApiRequestError ? err.message : 'The request did not go through.');

type Dirty = (key: string, dirty: boolean) => void;

function useReportDirty(key: string, dirty: boolean, setDirty: Dirty) {
  useEffect(() => {
    setDirty(key, dirty);
    return () => setDirty(key, false);
  }, [key, dirty, setDirty]);
}

function Problem({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {children}
    </p>
  );
}

function Counter({ value, max }: { value: string; max: number }) {
  return <span className={cn('text-[11px] tabular-nums', value.length > max * 0.95 ? 'text-amber-800 dark:text-amber-300' : 'text-muted-foreground')}>{value.length}/{max}</span>;
}

// ── The dialog ──────────────────────────────────────────────────────────────────────────────────────

/** `target` is an item's id, "new" for a new item, or null when closed. */
export function EtiquetteItemDialog({ target, onTarget, overview }: { target: string | null; onTarget: (target: string | null) => void; overview: EtiquetteOverview }) {
  const dirtyKeys = useRef(new Set<string>());
  const setDirty: Dirty = (key, dirty) => {
    if (dirty) dirtyKeys.current.add(key);
    else dirtyKeys.current.delete(key);
  };
  const close = () => {
    if (dirtyKeys.current.size > 0 && !confirm('Close without saving your changes?')) return;
    dirtyKeys.current.clear();
    onTarget(null);
  };

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent page className="max-w-5xl">
        {target === 'new' && <NewItem overview={overview} setDirty={setDirty} onCreated={(id) => { dirtyKeys.current.clear(); onTarget(id); }} />}
        {target && target !== 'new' && <ExistingItem key={target} id={target} overview={overview} setDirty={setDirty} />}
      </DialogContent>
    </Dialog>
  );
}

// ── The English fields ─────────────────────────────────────────────────────────────────────────────

type Form = { category: string; title: string; summary: string; body: string; reference: string; author: string; sourceName: string; sourceUrl: string; sortOrder: string };

const EMPTY: Form = { category: '', title: '', summary: '', body: '', reference: '', author: '', sourceName: '', sourceUrl: '', sortOrder: '' };

const toForm = (item: Pick<EtiquetteDetail, 'category' | 'title' | 'summary' | 'body' | 'reference' | 'author' | 'sourceName' | 'sourceUrl' | 'sortOrder'>): Form => ({
  category: item.category,
  title: item.title,
  summary: item.summary,
  body: item.body,
  reference: item.reference ?? '',
  author: item.author ?? '',
  sourceName: item.sourceName ?? '',
  sourceUrl: item.sourceUrl ?? '',
  sortOrder: String(item.sortOrder),
});

/** What is wrong with the form, in words, or null. The API checks the same things again. */
function formProblem(form: Form): string | null {
  if (!form.category) return 'Choose a category.';
  if (!form.title.trim()) return 'Write a title.';
  if (!form.summary.trim()) return 'Write a summary — the line readers see first, and the push.';
  if (!form.body.trim()) return 'Write the body.';
  if (!form.author.trim()) return 'Say who it is by — the speaker of the verse, or the teacher or temple that wrote the page.';
  if (form.sourceUrl.trim() && !/^https?:\/\/\S+$/i.test(form.sourceUrl.trim())) return 'The source link must start with http:// or https://.';
  if (form.sortOrder.trim() && !/^\d+$/.test(form.sortOrder.trim())) return 'The order is a whole number.';
  return null;
}

const blankToNull = (value: string) => (value.trim() ? value.trim() : null);

function Fields({ form, setForm, disabled, overview }: { form: Form; setForm: (form: Form) => void; disabled: boolean; overview: EtiquetteOverview }) {
  const set = (key: keyof Form) => (ev: { target: { value: string } }) => setForm({ ...form, [key]: ev.target.value });
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
        <div className="space-y-1">
          <Label htmlFor="etq-category">Category</Label>
          <Select id="etq-category" className="w-full" value={form.category} onChange={set('category')} disabled={disabled}>
            {!form.category && <option value="">Choose…</option>}
            {overview.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="etq-order">Order</Label>
          <Input id="etq-order" inputMode="numeric" value={form.sortOrder} onChange={set('sortOrder')} disabled={disabled} placeholder="last" />
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="etq-title">Title</Label>
          <Counter value={form.title} max={LIMITS.title} />
        </div>
        <Input id="etq-title" value={form.title} onChange={set('title')} maxLength={LIMITS.title} disabled={disabled} />
      </div>

      <div className="space-y-1">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="etq-summary">Summary</Label>
          <Counter value={form.summary} max={LIMITS.summary} />
        </div>
        <Textarea id="etq-summary" rows={2} value={form.summary} onChange={set('summary')} maxLength={LIMITS.summary} disabled={disabled} />
        <p className="text-xs text-muted-foreground">One or two sentences. The push shows this, so it should stand on its own.</p>
      </div>

      <div className="space-y-1">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="etq-body">Body</Label>
          <Counter value={form.body} max={LIMITS.body} />
        </div>
        <Textarea id="etq-body" rows={9} value={form.body} onChange={set('body')} maxLength={LIMITS.body} disabled={disabled} />
        <p className="text-xs text-muted-foreground">A blank line starts a new paragraph. Write it in your own words, kindly and for every devotee; do not paste a site’s text.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="etq-author">Author</Label>
          <Input id="etq-author" value={form.author} onChange={set('author')} maxLength={LIMITS.author} disabled={disabled} placeholder="Who it is by: the verse’s speaker, or the temple or teacher" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="etq-reference">Reference</Label>
          <Input id="etq-reference" value={form.reference} onChange={set('reference')} maxLength={LIMITS.reference} disabled={disabled} placeholder="Scripture and verse, if it rests on one" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="etq-source-name">Source name</Label>
          <Input id="etq-source-name" value={form.sourceName} onChange={set('sourceName')} maxLength={LIMITS.sourceName} disabled={disabled} placeholder="Where the guidance is published" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="etq-source-url">Source link</Label>
          <Input id="etq-source-url" type="url" value={form.sourceUrl} onChange={set('sourceUrl')} disabled={disabled} placeholder="https://" />
        </div>
      </div>
    </div>
  );
}

// ── A new item ───────────────────────────────────────────────────────────────────────────────────────

function NewItem({ overview, setDirty, onCreated }: { overview: EtiquetteOverview; setDirty: Dirty; onCreated: (id: string) => void }) {
  const create = useCreateEtiquette();
  const [form, setForm] = useState<Form>(EMPTY);
  const [status, setStatus] = useState<EtiquetteStatus>('DRAFT');
  const [reason, setReason] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const dirty = JSON.stringify(form) !== JSON.stringify(EMPTY) || reason !== '';
  useReportDirty('item', dirty, setDirty);

  const invalid = formProblem(form) ?? (status === 'EXCLUDED' && !reason.trim() ? 'Say why it is excluded.' : null);

  const submit = () => {
    setProblem(null);
    create.mutate(
      {
        category: form.category,
        title: form.title.trim(),
        summary: form.summary.trim(),
        body: form.body.trim(),
        reference: blankToNull(form.reference),
        author: blankToNull(form.author),
        sourceName: blankToNull(form.sourceName),
        sourceUrl: blankToNull(form.sourceUrl),
        ...(form.sortOrder.trim() ? { sortOrder: Number(form.sortOrder) } : {}),
        status,
        excludedReason: status === 'EXCLUDED' ? reason.trim() : null,
      },
      { onSuccess: (item) => onCreated(item.id), onError: (err) => setProblem(message(err)) }
    );
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>New etiquette</DialogTitle>
        <DialogDescription>Written in English first; translations come after, from a run or by hand. Added as a draft unless you choose otherwise, so nothing reaches readers by accident.</DialogDescription>
      </DialogHeader>
      <div className="space-y-6">
        <Fields form={form} setForm={setForm} disabled={create.isPending} overview={overview} />

        <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
          <Label htmlFor="etq-new-status">Who sees it</Label>
          <Select id="etq-new-status" className="w-full sm:w-64" value={status} onChange={(ev) => setStatus(ev.target.value as EtiquetteStatus)}>
            <option value="DRAFT">Draft — not shown yet</option>
            <option value="PUBLISHED">Published — readers see it, and it can be the day’s push</option>
            <option value="EXCLUDED">Excluded — kept here, never shown or pushed</option>
          </Select>
          {status === 'EXCLUDED' && (
            <div className="space-y-1">
              <Label htmlFor="etq-new-reason">Why it is excluded</Label>
              <Textarea id="etq-new-reason" rows={2} value={reason} onChange={(ev) => setReason(ev.target.value)} maxLength={500} />
            </div>
          )}
        </div>

        <Problem>{problem}</Problem>
        <div className="flex items-center justify-end gap-3">
          {invalid && <p className="text-xs text-muted-foreground">{invalid}</p>}
          <Button onClick={submit} disabled={create.isPending || !!invalid}>
            {create.isPending ? <Loader2 className="animate-spin" /> : <Plus />} Add etiquette
          </Button>
        </div>
      </div>
    </>
  );
}

// ── An existing item ─────────────────────────────────────────────────────────────────────────────────

function ExistingItem({ id, overview, setDirty }: { id: string; overview: EtiquetteOverview; setDirty: Dirty }) {
  const query = useEtiquetteItem(id);
  const item = query.data;

  if (!item) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Etiquette</DialogTitle>
          <DialogDescription>{query.isError ? 'This item could not be loaded.' : 'Loading…'}</DialogDescription>
        </DialogHeader>
        {query.isError ? <Problem>{message(query.error)}</Problem> : <Skeleton className="h-64 w-full" />}
      </>
    );
  }

  const category = overview.categories.find((c) => c.id === item.category)?.name ?? item.category;
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex flex-wrap items-center gap-2">
          <span className="min-w-0">{item.title}</span>
          <Badge variant={STATUS_VARIANT[item.status]}>{STATUS_LABEL[item.status]}</Badge>
          {item.isEdited && <Badge variant="outline">Edited by hand</Badge>}
        </DialogTitle>
        <DialogDescription>
          {category} · <span className="font-mono">{item.slug}</span> · shown as the day’s item {item.timesShown} time{item.timesShown === 1 ? '' : 's'}, pushed {item.timesPushed} time{item.timesPushed === 1 ? '' : 's'} · updated {formatDate(item.updatedAt)}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-8">
        <StatusPanel item={item} />
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">English</h3>
          <ItemForm key={item.id} item={item} overview={overview} setDirty={setDirty} />
        </section>
        <TranslationsPanel item={item} overview={overview} setDirty={setDirty} />
      </div>
    </>
  );
}

function ItemForm({ item, overview, setDirty }: { item: EtiquetteDetail; overview: EtiquetteOverview; setDirty: Dirty }) {
  const update = useUpdateEtiquette(item.id);
  const [base, setBase] = useState<Form>(() => toForm(item));
  const [form, setForm] = useState<Form>(base);
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = JSON.stringify(form) !== JSON.stringify(base);
  useReportDirty('item', dirty, setDirty);
  const invalid = formProblem(form);

  const submit = () => {
    setProblem(null);
    setSaved(false);
    const changes: Record<string, unknown> = {};
    if (form.category !== base.category) changes.category = form.category;
    if (form.title !== base.title) changes.title = form.title.trim();
    if (form.summary !== base.summary) changes.summary = form.summary.trim();
    if (form.body !== base.body) changes.body = form.body.trim();
    if (form.reference !== base.reference) changes.reference = blankToNull(form.reference);
    if (form.author !== base.author) changes.author = blankToNull(form.author);
    if (form.sourceName !== base.sourceName) changes.sourceName = blankToNull(form.sourceName);
    if (form.sourceUrl !== base.sourceUrl) changes.sourceUrl = blankToNull(form.sourceUrl);
    if (form.sortOrder !== base.sortOrder && form.sortOrder.trim()) changes.sortOrder = Number(form.sortOrder);
    update.mutate(changes, {
      onSuccess: (row) => {
        const next = toForm(row);
        setBase(next);
        setForm(next);
        setSaved(true);
      },
      onError: (err) => setProblem(message(err)),
    });
  };

  return (
    <div className="space-y-4">
      <Fields form={form} setForm={setForm} disabled={update.isPending} overview={overview} />
      {item.sourceUrl && (
        <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
          <ExternalLink className="h-3 w-3" /> Open the source
        </a>
      )}
      <Problem>{problem}</Problem>
      <div className="flex items-center justify-end gap-3">
        {saved && !dirty && (
          <span className="inline-flex items-center gap-1 text-xs text-success">
            <CheckCircle2 className="h-3.5 w-3.5" /> Saved
          </span>
        )}
        {dirty && invalid && <p className="text-xs text-muted-foreground">{invalid}</p>}
        {dirty && (
          <Button variant="outline" onClick={() => setForm(base)} disabled={update.isPending}>
            <Undo2 /> Discard
          </Button>
        )}
        <Button onClick={submit} disabled={update.isPending || !dirty || !!invalid}>
          {update.isPending ? <Loader2 className="animate-spin" /> : <Save />} Save English
        </Button>
      </div>
    </div>
  );
}

// ── Who sees it ───────────────────────────────────────────────────────────────────────────────────────

function StatusPanel({ item }: { item: EtiquetteDetail }) {
  const set = useSetEtiquetteStatus();
  const [excluding, setExcluding] = useState(false);
  const [reason, setReason] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const change = (status: EtiquetteStatus, why?: string) => {
    setProblem(null);
    set.mutate(
      { id: item.id, status, reason: why },
      {
        onSuccess: () => {
          setExcluding(false);
          setReason('');
        },
        onError: (err) => setProblem(message(err)),
      }
    );
  };
  const publish = () => {
    if (item.status === 'EXCLUDED' && !confirm(`This was excluded because: “${item.excludedReason ?? 'no reason recorded'}”. Publish it anyway?`)) return;
    change('PUBLISHED');
  };

  return (
    <section className={cn('space-y-3 rounded-lg border p-4', item.status === 'EXCLUDED' ? 'border-destructive/30 bg-destructive/5' : 'bg-muted/30')}>
      {item.status === 'PUBLISHED' && <p className="text-sm">Readers see this, and it can be the day’s push.</p>}
      {item.status === 'DRAFT' && <p className="text-sm">A draft: readers do not see it and it is never pushed.</p>}
      {item.status === 'EXCLUDED' && (
        <div className="text-sm">
          <p className="font-medium text-destructive">Excluded — kept here, never shown or pushed.</p>
          <p className="mt-1 text-muted-foreground">Why: {item.excludedReason ?? 'no reason recorded'}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {item.status !== 'PUBLISHED' && (
          <Button size="sm" onClick={publish} disabled={set.isPending}>
            {set.isPending ? <Loader2 className="animate-spin" /> : <Send />} Publish
          </Button>
        )}
        {item.status === 'PUBLISHED' && (
          <Button size="sm" variant="outline" onClick={() => change('DRAFT')} disabled={set.isPending}>
            <EyeOff /> Hold back as a draft
          </Button>
        )}
        {item.status === 'EXCLUDED' && (
          <Button size="sm" variant="outline" onClick={() => change('DRAFT')} disabled={set.isPending}>
            <Undo2 /> Restore as a draft
          </Button>
        )}
        {item.status !== 'EXCLUDED' && !excluding && (
          <Button size="sm" variant="outline" className="text-destructive" onClick={() => setExcluding(true)} disabled={set.isPending}>
            <Ban /> Exclude…
          </Button>
        )}
      </div>

      {excluding && (
        <div className="space-y-2">
          <Label htmlFor="etq-reason">Why it is excluded</Label>
          <Textarea id="etq-reason" rows={2} value={reason} onChange={(ev) => setReason(ev.target.value)} maxLength={500} placeholder="For example: speaks ill of a deity, so it is kept but never shown." autoFocus />
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" onClick={() => change('EXCLUDED', reason)} disabled={set.isPending || !reason.trim()}>
              {set.isPending ? <Loader2 className="animate-spin" /> : <Ban />} Exclude
            </Button>
            <Button size="sm" variant="outline" onClick={() => setExcluding(false)} disabled={set.isPending}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      <Problem>{problem}</Problem>
    </section>
  );
}

// ── Translations ──────────────────────────────────────────────────────────────────────────────────────

function TranslationsPanel({ item, overview, setDirty }: { item: EtiquetteDetail; overview: EtiquetteOverview; setDirty: Dirty }) {
  const [language, setLanguage] = useState<string>(overview.languages[0]?.code ?? '');
  const byLanguage = new Map(item.translations.map((t) => [t.language, t]));
  const info = overview.languages.find((l) => l.code === language);

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Translations</h3>
        <p className="text-xs text-muted-foreground">
          {item.translations.length} of {overview.languages.length} languages. A reader with no translation in their language sees the next one in their chain, ending in English. Translations made by a run are AI drafts; one you write or correct here is never replaced by a run.
        </p>
      </div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Language">
        {overview.languages.map((l) => {
          const t = byLanguage.get(l.code);
          return (
            <button
              key={l.code}
              type="button"
              role="tab"
              aria-selected={l.code === language}
              onClick={() => setLanguage(l.code)}
              className={cn('rounded-lg border px-3 py-1.5 text-left transition-colors', l.code === language ? 'border-primary bg-primary/5 ring-1 ring-primary/40' : 'bg-card hover:bg-accent')}
            >
              <span className="block text-sm font-semibold">{l.name}</span>
              <span className={cn('block text-[11px]', t ? 'text-muted-foreground' : 'text-amber-800 dark:text-amber-300')}>
                {!t ? 'missing' : t.isEdited ? 'by hand' : 'AI draft'}
                {t && !t.isPublished && ' · hidden'}
              </span>
            </button>
          );
        })}
      </div>
      {info && <TranslationEditor key={`${language}:${byLanguage.get(language)?.updatedAt ?? 'none'}`} item={item} language={language} languageName={info.name} existing={byLanguage.get(language)} setDirty={setDirty} />}
    </section>
  );
}

function TranslationEditor({ item, language, languageName, existing, setDirty }: { item: EtiquetteDetail; language: string; languageName: string; existing: EtiquetteTranslation | undefined; setDirty: Dirty }) {
  const save = useSaveEtiquetteTranslation(item.id);
  const remove = useDeleteEtiquetteTranslation(item.id);
  const start = { title: existing?.title ?? '', summary: existing?.summary ?? '', body: existing?.body ?? '', isPublished: existing?.isPublished ?? true };
  const [form, setForm] = useState(start);
  const [problem, setProblem] = useState<string | null>(null);

  const dirty = JSON.stringify(form) !== JSON.stringify(start);
  useReportDirty(`translation:${language}`, dirty, setDirty);
  const complete = form.title.trim() && form.summary.trim() && form.body.trim();

  const submit = () => {
    setProblem(null);
    save.mutate({ language, title: form.title.trim(), summary: form.summary.trim(), body: form.body.trim(), isPublished: form.isPublished }, { onError: (err) => setProblem(message(err)) });
  };
  const doDelete = () => {
    if (!confirm(`Delete the ${languageName} translation? Readers then see the next language in their chain until it is written again.`)) return;
    setProblem(null);
    remove.mutate(language, { onError: (err) => setProblem(message(err)) });
  };

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {existing ? (
            <>
              {existing.isEdited ? 'Written or corrected by hand' : `Made by ${existing.translatedBy ?? 'a run'}`} · {formatDate(existing.updatedAt)}
            </>
          ) : (
            `No ${languageName} translation yet. Write one, or let a run make it from the Translations tab.`
          )}
        </span>
        {existing && !existing.isPublished && <Badge variant="warning">Hidden from readers</Badge>}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="etq-t-title">Title</Label>
              <Counter value={form.title} max={TRANSLATION_LIMITS.title} />
            </div>
            <Input id="etq-t-title" value={form.title} onChange={(ev) => setForm({ ...form, title: ev.target.value })} maxLength={TRANSLATION_LIMITS.title} />
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="etq-t-summary">Summary</Label>
              <Counter value={form.summary} max={TRANSLATION_LIMITS.summary} />
            </div>
            <Textarea id="etq-t-summary" rows={3} value={form.summary} onChange={(ev) => setForm({ ...form, summary: ev.target.value })} maxLength={TRANSLATION_LIMITS.summary} />
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="etq-t-body">Body</Label>
              <Counter value={form.body} max={TRANSLATION_LIMITS.body} />
            </div>
            <Textarea id="etq-t-body" rows={10} value={form.body} onChange={(ev) => setForm({ ...form, body: ev.target.value })} maxLength={TRANSLATION_LIMITS.body} />
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">English, to compare</p>
          <p className="font-medium">{item.title}</p>
          <p className="text-muted-foreground">{item.summary}</p>
          <div className="space-y-2 whitespace-pre-line text-muted-foreground">{item.body}</div>
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <Checkbox checked={form.isPublished} onChange={(ev) => setForm({ ...form, isPublished: ev.target.checked })} />
        Show this translation to readers
      </label>

      <Problem>{problem}</Problem>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {existing && (
          <Button variant="outline" className="mr-auto text-destructive" onClick={doDelete} disabled={remove.isPending || save.isPending}>
            {remove.isPending ? <Loader2 className="animate-spin" /> : <Trash2 />} Delete translation
          </Button>
        )}
        {dirty && (
          <Button variant="outline" onClick={() => setForm(start)} disabled={save.isPending}>
            <Undo2 /> Discard
          </Button>
        )}
        <Button onClick={submit} disabled={save.isPending || !dirty || !complete}>
          {save.isPending ? <Loader2 className="animate-spin" /> : <Save />} Save {languageName}
        </Button>
      </div>
    </div>
  );
}
