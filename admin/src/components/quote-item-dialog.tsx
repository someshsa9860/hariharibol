// One quote as a full page: the English wording and its source, whether readers see it (publish, hold back,
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
  STATUS_LABEL, STATUS_VARIANT, useCreateQuote, useDeleteQuoteTranslation, useQuoteItem, useSaveQuoteTranslation,
  useSetQuoteStatus, useUpdateQuote,
  type QuoteDetail, type QuoteOverview, type QuoteStatus, type QuoteTranslation,
} from '@/lib/quote';
import { cn, formatDate } from '@/lib/utils';

const LIMITS = { text: 1000, reference: 200, author: 200, sourceName: 120 };
const TRANSLATION_LIMITS = { text: 2000 };

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
export function QuoteItemDialog({ target, onTarget, overview }: { target: string | null; onTarget: (target: string | null) => void; overview: QuoteOverview }) {
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
        {target === 'new' && <NewItem setDirty={setDirty} onCreated={(id) => { dirtyKeys.current.clear(); onTarget(id); }} />}
        {target && target !== 'new' && <ExistingItem key={target} id={target} overview={overview} setDirty={setDirty} />}
      </DialogContent>
    </Dialog>
  );
}

// ── The English fields ─────────────────────────────────────────────────────────────────────────────

type Form = { text: string; reference: string; author: string; sourceName: string; sourceUrl: string; sortOrder: string };

const EMPTY: Form = { text: '', reference: '', author: '', sourceName: '', sourceUrl: '', sortOrder: '' };

const toForm = (item: Pick<QuoteDetail, 'text' | 'reference' | 'author' | 'sourceName' | 'sourceUrl' | 'sortOrder'>): Form => ({
  text: item.text,
  reference: item.reference ?? '',
  author: item.author ?? '',
  sourceName: item.sourceName ?? '',
  sourceUrl: item.sourceUrl ?? '',
  sortOrder: String(item.sortOrder),
});

/** What is wrong with the form, in words, or null. The API checks the same things again. */
function formProblem(form: Form): string | null {
  if (!form.text.trim()) return 'Write the quote.';
  if (!form.author.trim()) return 'Say who said or wrote it.';
  if (!form.reference.trim()) return 'Give the reference — the book and verse, or the lecture or letter and its date.';
  if (!form.sourceUrl.trim()) return 'Give the link to the page where the quote can be read.';
  if (form.sourceUrl.trim() && !/^https?:\/\/\S+$/i.test(form.sourceUrl.trim())) return 'The source link must start with http:// or https://.';
  if (form.sortOrder.trim() && !/^\d+$/.test(form.sortOrder.trim())) return 'The order is a whole number.';
  return null;
}

const blankToNull = (value: string) => (value.trim() ? value.trim() : null);

function Fields({ form, setForm, disabled }: { form: Form; setForm: (form: Form) => void; disabled: boolean }) {
  const set = (key: keyof Form) => (ev: { target: { value: string } }) => setForm({ ...form, [key]: ev.target.value });
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="quo-text">Quote</Label>
          <Counter value={form.text} max={LIMITS.text} />
        </div>
        <Textarea id="quo-text" rows={4} value={form.text} onChange={set('text')} maxLength={LIMITS.text} disabled={disabled} />
        <p className="text-xs text-muted-foreground">The speaker’s own words, one or two sentences, copied from the page linked below — shown on the chanting page, so keep it short. Do not add quotation marks.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
        <div className="space-y-1">
          <Label htmlFor="quo-author">Author</Label>
          <Input id="quo-author" value={form.author} onChange={set('author')} maxLength={LIMITS.author} disabled={disabled} placeholder="Who said or wrote it" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="quo-order">Order</Label>
          <Input id="quo-order" inputMode="numeric" value={form.sortOrder} onChange={set('sortOrder')} disabled={disabled} placeholder="last" />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="quo-reference">Reference</Label>
        <Input id="quo-reference" value={form.reference} onChange={set('reference')} maxLength={LIMITS.reference} disabled={disabled} placeholder="Book and verse, or lecture or letter and its date" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="quo-source-name">Source name</Label>
          <Input id="quo-source-name" value={form.sourceName} onChange={set('sourceName')} maxLength={LIMITS.sourceName} disabled={disabled} placeholder="For example Vedabase" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="quo-source-url">Source link</Label>
          <Input id="quo-source-url" type="url" value={form.sourceUrl} onChange={set('sourceUrl')} disabled={disabled} placeholder="https://" />
        </div>
      </div>
    </div>
  );
}

// ── A new item ───────────────────────────────────────────────────────────────────────────────────────

function NewItem({ setDirty, onCreated }: { setDirty: Dirty; onCreated: (id: string) => void }) {
  const create = useCreateQuote();
  const [form, setForm] = useState<Form>(EMPTY);
  const [status, setStatus] = useState<QuoteStatus>('DRAFT');
  const [reason, setReason] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const dirty = JSON.stringify(form) !== JSON.stringify(EMPTY) || reason !== '';
  useReportDirty('item', dirty, setDirty);

  const invalid = formProblem(form) ?? (status === 'EXCLUDED' && !reason.trim() ? 'Say why it is excluded.' : null);

  const submit = () => {
    setProblem(null);
    create.mutate(
      {
        text: form.text.trim(),
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
        <DialogTitle>New quote</DialogTitle>
        <DialogDescription>Written in English first, with where it can be checked; translations come after, from a run or by hand. Added as a draft unless you choose otherwise, so nothing reaches readers by accident.</DialogDescription>
      </DialogHeader>
      <div className="space-y-6">
        <Fields form={form} setForm={setForm} disabled={create.isPending} />

        <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
          <Label htmlFor="quo-new-status">Who sees it</Label>
          <Select id="quo-new-status" className="w-full sm:w-64" value={status} onChange={(ev) => setStatus(ev.target.value as QuoteStatus)}>
            <option value="DRAFT">Draft — not shown yet</option>
            <option value="PUBLISHED">Published — readers see it while chanting</option>
            <option value="EXCLUDED">Excluded — kept here, never shown</option>
          </Select>
          {status === 'EXCLUDED' && (
            <div className="space-y-1">
              <Label htmlFor="quo-new-reason">Why it is excluded</Label>
              <Textarea id="quo-new-reason" rows={2} value={reason} onChange={(ev) => setReason(ev.target.value)} maxLength={500} />
            </div>
          )}
        </div>

        <Problem>{problem}</Problem>
        <div className="flex items-center justify-end gap-3">
          {invalid && <p className="text-xs text-muted-foreground">{invalid}</p>}
          <Button onClick={submit} disabled={create.isPending || !!invalid}>
            {create.isPending ? <Loader2 className="animate-spin" /> : <Plus />} Add quote
          </Button>
        </div>
      </div>
    </>
  );
}

// ── An existing item ─────────────────────────────────────────────────────────────────────────────────

function ExistingItem({ id, overview, setDirty }: { id: string; overview: QuoteOverview; setDirty: Dirty }) {
  const query = useQuoteItem(id);
  const item = query.data;

  if (!item) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Quote</DialogTitle>
          <DialogDescription>{query.isError ? 'This quote could not be loaded.' : 'Loading…'}</DialogDescription>
        </DialogHeader>
        {query.isError ? <Problem>{message(query.error)}</Problem> : <Skeleton className="h-64 w-full" />}
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 line-clamp-2">{item.text}</span>
          <Badge variant={STATUS_VARIANT[item.status]}>{STATUS_LABEL[item.status]}</Badge>
          {item.isEdited && <Badge variant="outline">Edited by hand</Badge>}
        </DialogTitle>
        <DialogDescription>
          <span className="font-mono">{item.slug}</span> · updated {formatDate(item.updatedAt)}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-8">
        <StatusPanel item={item} />
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">English</h3>
          <ItemForm key={item.id} item={item} setDirty={setDirty} />
        </section>
        <TranslationsPanel item={item} overview={overview} setDirty={setDirty} />
      </div>
    </>
  );
}

function ItemForm({ item, setDirty }: { item: QuoteDetail; setDirty: Dirty }) {
  const update = useUpdateQuote(item.id);
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
    if (form.text !== base.text) changes.text = form.text.trim();
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
      <Fields form={form} setForm={setForm} disabled={update.isPending} />
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

function StatusPanel({ item }: { item: QuoteDetail }) {
  const set = useSetQuoteStatus();
  const [excluding, setExcluding] = useState(false);
  const [reason, setReason] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const change = (status: QuoteStatus, why?: string) => {
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
      {item.status === 'PUBLISHED' && <p className="text-sm">Readers see this while chanting.</p>}
      {item.status === 'DRAFT' && <p className="text-sm">A draft: readers do not see it.</p>}
      {item.status === 'EXCLUDED' && (
        <div className="text-sm">
          <p className="font-medium text-destructive">Excluded — kept here, never shown.</p>
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
          <Label htmlFor="quo-reason">Why it is excluded</Label>
          <Textarea id="quo-reason" rows={2} value={reason} onChange={(ev) => setReason(ev.target.value)} maxLength={500} placeholder="For example: the wording could not be matched to its source, so it is kept but never shown." autoFocus />
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

function TranslationsPanel({ item, overview, setDirty }: { item: QuoteDetail; overview: QuoteOverview; setDirty: Dirty }) {
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

function TranslationEditor({ item, language, languageName, existing, setDirty }: { item: QuoteDetail; language: string; languageName: string; existing: QuoteTranslation | undefined; setDirty: Dirty }) {
  const save = useSaveQuoteTranslation(item.id);
  const remove = useDeleteQuoteTranslation(item.id);
  const start = { text: existing?.text ?? '', isPublished: existing?.isPublished ?? true };
  const [form, setForm] = useState(start);
  const [problem, setProblem] = useState<string | null>(null);

  const dirty = JSON.stringify(form) !== JSON.stringify(start);
  useReportDirty(`translation:${language}`, dirty, setDirty);
  const complete = form.text.trim();

  const submit = () => {
    setProblem(null);
    save.mutate({ language, text: form.text.trim(), isPublished: form.isPublished }, { onError: (err) => setProblem(message(err)) });
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
        <div className="space-y-1">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="quo-t-text">Quote in {languageName}</Label>
            <Counter value={form.text} max={TRANSLATION_LIMITS.text} />
          </div>
          <Textarea id="quo-t-text" rows={6} value={form.text} onChange={(ev) => setForm({ ...form, text: ev.target.value })} maxLength={TRANSLATION_LIMITS.text} />
        </div>

        <div className="space-y-3 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">English, to compare</p>
          <p className="whitespace-pre-line text-muted-foreground">{item.text}</p>
          <p className="text-xs text-muted-foreground">{item.reference}</p>
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
