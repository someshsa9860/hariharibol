// One prayer as a full page: its English wording and source, whether readers see it (publish, hold back, delete), its verses as
// one ordered list, and each language it can be read in. Opened for a new prayer with target "new". Built like
// etiquette-item-dialog.tsx; the verses and the languages are the two editors beside it.

import { useRef, useState } from 'react';
import { CheckCircle2, ExternalLink, EyeOff, Loader2, Plus, Save, Send, Trash2, Undo2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Counter, Problem, message, useReportDirty, type Dirty } from '@/components/prayer-form-bits';
import { PrayerLanguages } from '@/components/prayer-language-editor';
import { SavedVersesEditor, VersesEditor, toInputs, versesProblem, type VerseRow } from '@/components/prayer-verses-editor';
import {
  ORIGINAL_LANGUAGES, STATUS_LABEL, STATUS_VARIANT, categoriesOf, categoryName, languageName, useCreatePrayer, useDeletePrayer, usePrayer, useSetPrayerStatus, useUpdatePrayer,
  type PrayerDetail, type PrayerOverview, type PrayerStatus,
} from '@/lib/prayers';
import { formatDate } from '@/lib/utils';

// The columns' sizes (backend/prisma/schema.prisma, model Prayer).
const LIMITS = { title: 200, summary: 400, author: 200, reference: 200, sourceName: 200, sourceUrl: 500 };

type DialogProps = {
  /** A prayer's id, "new" for a new prayer, or null when closed. */
  target: string | null;
  onTarget: (target: string | null) => void;
  overview: PrayerOverview;
  /** Whether the person may start a translation run (`prayer.translate`). */
  canTranslate: boolean;
  /** Leaves the dialog for the Translations tab with the language ready to start. */
  onTranslate: (language: string) => void;
};

export function PrayerDialog({ target, onTarget, overview, canTranslate, onTranslate }: DialogProps) {
  const dirtyKeys = useRef(new Set<string>());
  const setDirty: Dirty = (key, dirty) => {
    if (dirty) dirtyKeys.current.add(key);
    else dirtyKeys.current.delete(key);
  };
  // Every way out of the page passes through here, so unsaved work is asked about once, in one place.
  const leave = (then: () => void) => {
    if (dirtyKeys.current.size > 0 && !confirm('Close without saving your changes?')) return;
    dirtyKeys.current.clear();
    then();
  };
  const finished = (id: string | null) => {
    dirtyKeys.current.clear();
    onTarget(id);
  };

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && leave(() => onTarget(null))}>
      <DialogContent page className="max-w-5xl">
        {target === 'new' && <NewPrayer overview={overview} setDirty={setDirty} onCreated={finished} />}
        {target && target !== 'new' && (
          <ExistingPrayer key={target} id={target} overview={overview} setDirty={setDirty} canTranslate={canTranslate} onTranslate={(language) => leave(() => onTranslate(language))} onGone={() => finished(null)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── The English fields ─────────────────────────────────────────────────────────────────────────────

type Form = { category: string; originalLanguage: string; title: string; summary: string; about: string; author: string; reference: string; sourceName: string; sourceUrl: string; sortOrder: string };

const EMPTY: Form = { category: '', originalLanguage: 'sa', title: '', summary: '', about: '', author: '', reference: '', sourceName: '', sourceUrl: '', sortOrder: '' };

const toForm = (item: PrayerDetail): Form => ({
  category: item.category,
  originalLanguage: item.originalLanguage,
  title: item.title,
  summary: item.summary ?? '',
  about: item.about ?? '',
  author: item.author ?? '',
  reference: item.reference ?? '',
  sourceName: item.sourceName ?? '',
  sourceUrl: item.sourceUrl ?? '',
  sortOrder: String(item.sortOrder),
});

const trimmed = (form: Form): Form => ({ ...form, title: form.title.trim(), summary: form.summary.trim(), about: form.about.trim(), author: form.author.trim(), reference: form.reference.trim(), sourceName: form.sourceName.trim(), sourceUrl: form.sourceUrl.trim(), sortOrder: form.sortOrder.trim() });

const blankToNull = (value: string) => (value.trim() ? value.trim() : null);

/** What is wrong with the form, in words, or null. The API checks the same things again. */
function formProblem(form: Form): string | null {
  if (!form.category) return 'Choose a category.';
  if (!form.title.trim()) return 'Write a title.';
  if (form.sourceUrl.trim() && !/^https?:\/\/\S+$/i.test(form.sourceUrl.trim())) return 'The source link must start with http:// or https://.';
  if (form.sortOrder.trim() && !/^\d+$/.test(form.sortOrder.trim())) return 'The order is a whole number.';
  return null;
}

function Fields({ form, setForm, disabled, overview }: { form: Form; setForm: (form: Form) => void; disabled: boolean; overview: PrayerOverview }) {
  const set = (key: keyof Form) => (ev: { target: { value: string } }) => setForm({ ...form, [key]: ev.target.value });
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_9rem]">
        <div className="space-y-1">
          <Label htmlFor="pr-category">Category</Label>
          <Select id="pr-category" className="w-full" value={form.category} onChange={set('category')} disabled={disabled}>
            {!form.category && <option value="">Choose…</option>}
            {categoriesOf(overview).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="pr-language">Written in</Label>
          <Select id="pr-language" className="w-full" value={form.originalLanguage} onChange={set('originalLanguage')} disabled={disabled}>
            {ORIGINAL_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="pr-order">Order</Label>
          <Input id="pr-order" inputMode="numeric" value={form.sortOrder} onChange={set('sortOrder')} disabled={disabled} placeholder="last" />
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="pr-title">Title</Label>
          <Counter value={form.title} max={LIMITS.title} />
        </div>
        <Input id="pr-title" value={form.title} onChange={set('title')} maxLength={LIMITS.title} disabled={disabled} placeholder="In English, for example: Guru Vandana" />
      </div>

      <div className="space-y-1">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="pr-summary">Summary</Label>
          <Counter value={form.summary} max={LIMITS.summary} />
        </div>
        <Textarea id="pr-summary" rows={2} value={form.summary} onChange={set('summary')} maxLength={LIMITS.summary} disabled={disabled} />
        <p className="text-xs text-muted-foreground">One or two plain sentences: the line on the prayer’s card in the list.</p>
      </div>

      <div className="space-y-1">
        <Label htmlFor="pr-about">About</Label>
        <Textarea id="pr-about" rows={5} value={form.about} onChange={set('about')} disabled={disabled} />
        <p className="text-xs text-muted-foreground">When it is said and what it is. A blank line starts a new paragraph.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="pr-author">Composed by</Label>
          <Input id="pr-author" value={form.author} onChange={set('author')} maxLength={LIMITS.author} disabled={disabled} placeholder="The poet or saint, if known" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pr-reference">Reference</Label>
          <Input id="pr-reference" value={form.reference} onChange={set('reference')} maxLength={LIMITS.reference} disabled={disabled} placeholder="Scripture and verse, if it rests on one" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="pr-source-name">Source name</Label>
          <Input id="pr-source-name" value={form.sourceName} onChange={set('sourceName')} maxLength={LIMITS.sourceName} disabled={disabled} placeholder="Where the text is published" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pr-source-url">Source link</Label>
          <Input id="pr-source-url" type="url" value={form.sourceUrl} onChange={set('sourceUrl')} maxLength={LIMITS.sourceUrl} disabled={disabled} placeholder="https://" />
        </div>
      </div>
    </div>
  );
}

// ── A new prayer ───────────────────────────────────────────────────────────────────────────────────

function NewPrayer({ overview, setDirty, onCreated }: { overview: PrayerOverview; setDirty: Dirty; onCreated: (id: string) => void }) {
  const create = useCreatePrayer();
  const [form, setForm] = useState<Form>(EMPTY);
  const [rows, setRows] = useState<VerseRow[]>([]);
  const [problem, setProblem] = useState<string | null>(null);

  const dirty = JSON.stringify(form) !== JSON.stringify(EMPTY) || rows.length > 0;
  useReportDirty('prayer', dirty, setDirty);
  const invalid = formProblem(form) ?? versesProblem(rows, false);

  const submit = () => {
    setProblem(null);
    create.mutate(
      {
        category: form.category,
        originalLanguage: form.originalLanguage,
        title: form.title.trim(),
        summary: blankToNull(form.summary),
        about: blankToNull(form.about),
        author: blankToNull(form.author),
        reference: blankToNull(form.reference),
        sourceName: blankToNull(form.sourceName),
        sourceUrl: blankToNull(form.sourceUrl),
        ...(form.sortOrder.trim() ? { sortOrder: Number(form.sortOrder) } : {}),
        verses: toInputs(rows).map(({ text, meaning }) => ({ text, meaning })),
      },
      { onSuccess: (item) => onCreated(item.id), onError: (err) => setProblem(message(err)) }
    );
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>New prayer</DialogTitle>
        <DialogDescription>Written in its own script first, with the English title and meaning; the other languages come after, from a run or by hand. Added as a draft, so nothing reaches readers by accident.</DialogDescription>
      </DialogHeader>
      <div className="space-y-6">
        <Fields form={form} setForm={setForm} disabled={create.isPending} overview={overview} />
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Verses</h3>
          <VersesEditor rows={rows} onChange={setRows} originalLanguage={form.originalLanguage} disabled={create.isPending} />
        </section>
        <Problem>{problem}</Problem>
        <div className="flex items-center justify-end gap-3">
          {invalid && <p className="text-xs text-muted-foreground">{invalid}</p>}
          <Button onClick={submit} disabled={create.isPending || !!invalid}>
            {create.isPending ? <Loader2 className="animate-spin" /> : <Plus />} Add prayer
          </Button>
        </div>
      </div>
    </>
  );
}

// ── An existing prayer ─────────────────────────────────────────────────────────────────────────────

function ExistingPrayer({ id, overview, setDirty, canTranslate, onTranslate, onGone }: {
  id: string;
  overview: PrayerOverview;
  setDirty: Dirty;
  canTranslate: boolean;
  onTranslate: (language: string) => void;
  onGone: () => void;
}) {
  const query = usePrayer(id);
  const item = query.data;

  if (!item) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Prayer</DialogTitle>
          <DialogDescription>{query.isError ? 'This prayer could not be loaded.' : 'Loading…'}</DialogDescription>
        </DialogHeader>
        {query.isError ? <Problem>{message(query.error)}</Problem> : <Skeleton className="h-64 w-full" />}
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex flex-wrap items-center gap-2">
          <span className="min-w-0">{item.title}</span>
          <Badge variant={STATUS_VARIANT[item.status]}>{STATUS_LABEL[item.status]}</Badge>
        </DialogTitle>
        <DialogDescription>
          {categoryName(item.category, overview)} · written in {languageName(item.originalLanguage)} · <span className="font-mono">{item.slug}</span> · {item.verses.length} verse{item.verses.length === 1 ? '' : 's'} · updated {formatDate(item.updatedAt)}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-8">
        <StatusPanel item={item} onGone={onGone} />
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">English</h3>
          <PrayerForm key={item.id} item={item} overview={overview} setDirty={setDirty} />
        </section>
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Verses</h3>
            <p className="text-xs text-muted-foreground">One list, saved whole. A verse keeps what was written for it in other languages when it moves; taking it out deletes that too.</p>
          </div>
          <SavedVersesEditor prayer={item} setDirty={setDirty} />
        </section>
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Languages</h3>
            <p className="text-xs text-muted-foreground">
              {item.languages.filter((l) => l.header || l.texts > 0 || l.meanings > 0).length} of {item.languages.length} have something written. A reader with nothing in their language sees the next one in their chain, ending in English. Text made by a run is an AI
              draft; text you write or correct here is never replaced by a run.
            </p>
          </div>
          <PrayerLanguages prayer={item} overview={overview} setDirty={setDirty} canTranslate={canTranslate} onTranslate={onTranslate} />
        </section>
      </div>
    </>
  );
}

function PrayerForm({ item, overview, setDirty }: { item: PrayerDetail; overview: PrayerOverview; setDirty: Dirty }) {
  const update = useUpdatePrayer(item.id);
  const [base, setBase] = useState<Form>(() => toForm(item));
  const [form, setForm] = useState<Form>(base);
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = JSON.stringify(form) !== JSON.stringify(base);
  useReportDirty('prayer', dirty, setDirty);
  const invalid = formProblem(form);
  const hasTranslations = item.languages.some((l) => l.header || l.texts > 0 || l.meanings > 0);

  const submit = () => {
    const languageChanged = form.originalLanguage !== base.originalLanguage;
    if (languageChanged && hasTranslations && !confirm(`Change the language this prayer is written in from ${languageName(base.originalLanguage)} to ${languageName(form.originalLanguage)}? Every verse written out in another script was made from the old one, so each will show “Out of date” until it is written again.`)) return;
    setProblem(null);
    setSaved(false);
    const next = trimmed(form);
    const changes: Record<string, unknown> = {};
    if (next.category !== base.category) changes.category = next.category;
    if (languageChanged) changes.originalLanguage = next.originalLanguage;
    if (next.title !== base.title) changes.title = next.title;
    if (next.summary !== base.summary) changes.summary = blankToNull(next.summary);
    if (next.about !== base.about) changes.about = blankToNull(next.about);
    if (next.author !== base.author) changes.author = blankToNull(next.author);
    if (next.reference !== base.reference) changes.reference = blankToNull(next.reference);
    if (next.sourceName !== base.sourceName) changes.sourceName = blankToNull(next.sourceName);
    if (next.sourceUrl !== base.sourceUrl) changes.sourceUrl = blankToNull(next.sourceUrl);
    if (next.sortOrder !== base.sortOrder && next.sortOrder) changes.sortOrder = Number(next.sortOrder);
    update.mutate(changes, {
      onSuccess: () => {
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

// ── Who sees it ────────────────────────────────────────────────────────────────────────────────────

function StatusPanel({ item, onGone }: { item: PrayerDetail; onGone: () => void }) {
  const set = useSetPrayerStatus();
  const remove = useDeletePrayer();
  const [problem, setProblem] = useState<string | null>(null);
  const noVerses = item.verses.length === 0;

  const change = (status: PrayerStatus) => {
    setProblem(null);
    set.mutate({ id: item.id, status }, { onError: (err) => setProblem(message(err)) });
  };
  const doDelete = () => {
    if (!confirm(`Delete “${item.title}” with its ${item.verses.length} verse${item.verses.length === 1 ? '' : 's'} and every translation? This cannot be undone.`)) return;
    setProblem(null);
    remove.mutate(item.id, { onSuccess: onGone, onError: (err) => setProblem(message(err)) });
  };
  const busy = set.isPending || remove.isPending;

  return (
    <section className="space-y-3 rounded-lg border bg-muted/30 p-4">
      {item.status === 'PUBLISHED' && <p className="text-sm">Readers see this prayer in the app, in the list for its category.</p>}
      {item.status === 'DRAFT' && <p className="text-sm">A draft: readers do not see it, and a translation run skips it.</p>}
      <div className="flex flex-wrap gap-2">
        {item.status === 'DRAFT' ? (
          <Button size="sm" onClick={() => change('PUBLISHED')} disabled={busy || noVerses} title={noVerses ? 'Add at least one verse first' : undefined}>
            {set.isPending ? <Loader2 className="animate-spin" /> : <Send />} Publish
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => change('DRAFT')} disabled={busy}>
            {set.isPending ? <Loader2 className="animate-spin" /> : <EyeOff />} Hold back as a draft
          </Button>
        )}
        <Button size="sm" variant="outline" className="ml-auto text-destructive" onClick={doDelete} disabled={busy}>
          {remove.isPending ? <Loader2 className="animate-spin" /> : <Trash2 />} Delete…
        </Button>
      </div>
      {item.status === 'DRAFT' && noVerses && <p className="text-xs text-muted-foreground">A prayer needs at least one verse before it can be published.</p>}
      <Problem>{problem}</Problem>
    </section>
  );
}
