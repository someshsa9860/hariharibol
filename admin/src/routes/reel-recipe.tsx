import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, Loader2, Music, Redo2, Save, Sparkles, Undo2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input, Label, Select } from '@/components/ui/input';
import { ReelDesigner } from '@/components/reel-designer';
import type { Creator } from '@/components/reel-details-panel';
import { api, ApiRequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useResource } from '@/lib/use-resource';
import {
  configFromDoc,
  docFromTemplate,
  emptyDoc,
  keepLocalUrls,
  useReelHistory,
  withMediaType,
  withUrlsFrom,
  type OverlayBind,
  type ReelDoc,
  type TemplateDetail,
} from '@/lib/reel-doc';
import { cn } from '@/lib/utils';

// Make reels from the verses of a book, in three steps:
//
//   1 Verses  — a book, narrowed by canto / chapter / range / topic / keywords
//   2 Design  — the same editor reels are made in, on a template: a background,
//               music, and text boxes that can be filled from the verse
//   3 Create  — one reel per verse, as drafts to review (or published straight away)
//
// The design is saved as a template (reels made from it keep working if it is
// later changed or deleted); creating reels is the API's job. What this page
// holds is the choices and the design.

type Step = 1 | 2 | 3;

type Book = { id: string; slug: string; title: string; totalVerses: number };
type Outline = {
  cantos: { number: number; title: string }[];
  chapters: { id: string; cantoNumber: number | null; number: number; title: string; totalVerses: number }[];
  tags: { tag: string; count: number }[];
};
type Sample = { id: string; verseId: string; sanskrit: string; transliteration: string | null; translation: string | null; reference: string; hasAudio: boolean };
type Preview = { total: number; willCreate: number; sample: Sample[] };
type Result = { created: number; published: boolean; reels: { id: string; verseId: string }[]; skipped: { verseId: string; reason: string }[] };
type Language = { code: string; englishName: string };

type Form = {
  bookId: string;
  cantoNumber: string;
  chapterId: string;
  verseFrom: string;
  verseTo: string;
  tag: string;
  hints: string;
  limit: string;
  languageCode: string;
};

const FALLBACK_LANGUAGES: Language[] = [
  { code: 'en', englishName: 'English' },
  { code: 'hi', englishName: 'Hindi' },
  { code: 'mr', englishName: 'Marathi' },
  { code: 'sa', englishName: 'Sanskrit' },
];

// Shown in the editor until a real verse is chosen to preview with.
const PLACEHOLDER: Record<OverlayBind, string> = {
  sanskrit: 'ॐ नमो भगवते वासुदेवाय',
  transliteration: 'oṁ namo bhagavate vāsudevāya',
  translation: 'I offer my respectful obeisances unto the Supreme Lord.',
  reference: 'Book 1.1.1',
};

const num = (value: string) => (value.trim() === '' ? null : Number(value));
const keywords = (value: string) => value.split(/[,\n]/).map((t) => t.trim()).filter(Boolean).slice(0, 10);

function toSelection(form: Form) {
  return {
    bookId: form.bookId,
    cantoNumber: num(form.cantoNumber),
    chapterId: form.chapterId || null,
    verseFrom: num(form.verseFrom),
    verseTo: num(form.verseTo),
    tag: form.tag || null,
    hints: keywords(form.hints),
    limit: Math.min(100, Math.max(1, Number(form.limit) || 20)),
    languageCode: form.languageCode,
  };
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

const messageOf = (error: unknown, fallback: string) => {
  if (!(error instanceof ApiRequestError)) return fallback;
  const rows = Array.isArray(error.details) ? (error.details as { field?: string; message?: string }[]) : [];
  return rows.length ? `${error.message}: ${rows.map((r) => (r.field ? `${r.field} ${r.message}` : r.message)).join('; ')}` : error.message;
};

const snapshot = (name: string, doc: ReelDoc) => JSON.stringify([name, configFromDoc(doc)]);

export function ReelRecipePage() {
  const [params] = useSearchParams();
  const wanted = params.get('template');

  const books = useResource<Book[]>(['recipe-books'], '/api/admin/reel-recipes/books');
  const creators = useResource<Creator[]>(['reel-creators'], '/api/admin/reels/creators');
  const templates = useResource<TemplateDetail[]>(['recipe-templates'], '/api/admin/reel-recipes/templates');
  const start = useResource<TemplateDetail>(['recipe-template', wanted], `/api/admin/reel-recipes/templates/${wanted}`, undefined, { enabled: !!wanted });

  if (books.isError || creators.isError || templates.isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <AlertTriangle className="h-8 w-8" />
        <p className="text-sm">Could not load what a recipe needs.</p>
        <Button variant="outline" size="sm" asChild>
          <Link to="/reels">Back to reels</Link>
        </Button>
      </div>
    );
  }
  if (!books.data || !creators.data || !templates.data || (wanted && !start.data && !start.isError)) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <Recipe books={books.data} creators={creators.data} templates={templates.data} start={start.data ?? null} />;
}

function Recipe({ books, creators, templates, start }: { books: Book[]; creators: Creator[]; templates: TemplateDetail[]; start: TemplateDetail | null }) {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canPublish = hasPermission('reel.publish');
  const canWrite = hasPermission('reel.write');

  const [step, setStep] = useState<Step>(1);

  // ── 1 · verses ───────────────────────────────────────────────────────────

  const [form, setForm] = useState<Form>({
    bookId: books[0]?.id ?? '',
    cantoNumber: '',
    chapterId: '',
    verseFrom: '',
    verseTo: '',
    tag: '',
    hints: '',
    limit: '20',
    languageCode: 'en',
  });
  const [useVerseAudio, setUseVerseAudio] = useState(false);
  const [creatorId, setCreatorId] = useState(() => (creators.find((c) => c.isOfficial) ?? creators[0])?.id ?? '');
  const field = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  const canDeity = hasPermission('reference.manage');
  const languageQuery = useResource<Language[]>(['reel-languages'], '/api/admin/reference/languages', { page: 1, pageSize: 100 }, { enabled: canDeity });
  const languages = languageQuery.data?.length ? languageQuery.data : FALLBACK_LANGUAGES;

  const outline = useResource<Outline>(['recipe-outline', form.bookId], '/api/admin/reel-recipes/outline', { bookId: form.bookId }, { enabled: !!form.bookId });
  const book = books.find((b) => b.id === form.bookId);
  const chapters = (outline.data?.chapters ?? []).filter((c) => !form.cantoNumber || c.cantoNumber === Number(form.cantoNumber));

  // ── 2 · design ───────────────────────────────────────────────────────────

  const [templateId, setTemplateId] = useState<string | null>(start?.id ?? null);
  const [name, setName] = useState(start?.name ?? '');
  const history = useReelHistory(start ? docFromTemplate(start) : emptyDoc('IMAGE'));
  const { doc, replace, set, undo, redo, canUndo, canRedo } = history;
  const [saved, setSaved] = useState(() => snapshot(start?.name ?? '', start ? docFromTemplate(start) : emptyDoc('IMAGE')));
  const [sampleIndex, setSampleIndex] = useState(0);
  const [busy, setBusy] = useState<'template' | 'create' | null>(null);
  const [error, setError] = useState('');
  const docRef = useRef(doc);
  docRef.current = doc;

  const dirty = useMemo(() => snapshot(name, doc) !== saved, [name, doc, saved]);
  const hasBinding = doc.overlays.some((o) => o.bind);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // ── preview ──────────────────────────────────────────────────────────────

  const settled = useDebounced(form, 450);
  const preview = useQuery({
    queryKey: ['recipe-preview', settled, useVerseAudio, templateId],
    enabled: !!settled.bookId,
    placeholderData: (previous) => previous,
    queryFn: async () =>
      (await api.post<Preview>('/api/admin/reel-recipes/preview', { selection: toSelection(settled), templateId, useVerseAudio })).data,
  });
  const total = preview.data?.total ?? 0;
  const willCreate = preview.data?.willCreate ?? 0;
  const sample = preview.data?.sample ?? [];

  // The sample verse the design is previewed with; a field it lacks falls back
  // to the placeholder so a box never shows empty.
  const picked = sample[Math.min(sampleIndex, Math.max(0, sample.length - 1))];
  const verseTexts = useMemo<Record<OverlayBind, string>>(
    () => ({
      sanskrit: picked?.sanskrit || PLACEHOLDER.sanskrit,
      transliteration: picked?.transliteration || PLACEHOLDER.transliteration,
      translation: picked?.translation || PLACEHOLDER.translation,
      reference: picked?.reference || PLACEHOLDER.reference,
    }),
    [picked]
  );

  // ── templates ────────────────────────────────────────────────────────────

  async function openTemplate(id: string) {
    if (dirty && !confirm('Discard the changes to this design?')) return;
    setError('');
    if (!id) {
      replace(emptyDoc('IMAGE'));
      setTemplateId(null);
      setName('');
      setSaved(snapshot('', emptyDoc('IMAGE')));
      return;
    }
    try {
      const { data } = await api.get<TemplateDetail>(`/api/admin/reel-recipes/templates/${id}`);
      const next = docFromTemplate(data);
      replace(next);
      setTemplateId(data.id);
      setName(data.name);
      setSaved(snapshot(data.name, next));
    } catch (e) {
      setError(messageOf(e, 'Could not open that template.'));
    }
  }

  function changeMediaType(next: 'VIDEO' | 'IMAGE') {
    if (next === doc.mediaType) return;
    const hasMedia = doc.videoPath || doc.images.length || doc.thumbnailPath;
    if (hasMedia && !confirm('Switching the background type drops the media you have uploaded. Continue?')) return;
    set((d) => withMediaType({ ...d, audioPath: d.audioPath, audioUrl: d.audioUrl }, next));
  }

  /** Saves the design, creating the template the first time. Returns its id. */
  async function saveTemplate(): Promise<string | null> {
    setError('');
    const title = name.trim() || `${book?.title ?? 'Verse'} design`;
    setBusy('template');
    try {
      const sent = snapshot(title, docRef.current);
      const body = { name: title, config: configFromDoc(docRef.current) };
      const { data } = templateId
        ? await api.patch<TemplateDetail>(`/api/admin/reel-recipes/templates/${templateId}`, body)
        : await api.post<TemplateDetail>('/api/admin/reel-recipes/templates', body);

      // Keep this browser's own copies of what was just uploaded (see keepLocalUrls);
      // edits made while the request was out stay unsaved.
      const current = docRef.current;
      const server = keepLocalUrls(docFromTemplate(data), current);
      if (snapshot(title, current) === sent) {
        replace(server);
        setSaved(snapshot(title, server));
      } else {
        replace(withUrlsFrom(current, server));
        setSaved(sent);
      }
      setTemplateId(data.id);
      setName(title);
      queryClient.invalidateQueries({ queryKey: ['recipe-templates'] });
      return data.id;
    } catch (e) {
      setError(messageOf(e, 'Could not save the design.'));
      return null;
    } finally {
      setBusy(null);
    }
  }

  // ── 3 · create ───────────────────────────────────────────────────────────

  const [publish, setPublish] = useState(false);
  const [extraTags, setExtraTags] = useState('');
  const [result, setResult] = useState<Result | null>(null);

  const backgroundReady = doc.mediaType === 'VIDEO' ? Boolean(doc.videoPath) : doc.images.length > 0;

  async function create() {
    setError('');
    const id = !templateId || dirty ? await saveTemplate() : templateId;
    if (!id) return;

    setBusy('create');
    try {
      const { data } = await api.post<Result>('/api/admin/reel-recipes/generate', {
        templateId: id,
        creatorId,
        selection: toSelection(form),
        useVerseAudio,
        publish: publish && canPublish,
        extraTags: keywords(extraTags),
      });
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ['reels'] });
      queryClient.invalidateQueries({ queryKey: ['recipe-preview'] });
    } catch (e) {
      setError(messageOf(e, 'Could not create the reels.'));
    } finally {
      setBusy(null);
    }
  }

  const canLeaveStep1 = Boolean(form.bookId) && total > 0 && Boolean(creatorId);
  const go = (next: Step) => {
    setError('');
    setResult(null);
    setStep(next);
  };

  function leave() {
    if (dirty && !confirm('Discard the changes to this design?')) return;
    navigate('/reels');
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={leave}>
          <ArrowLeft className="h-4 w-4" />
          Reels
        </Button>
        <h2 className="text-lg font-semibold">Make reels from verses</h2>
        <nav aria-label="Steps" className="ml-auto flex items-center gap-1 text-sm">
          {([1, 2, 3] as Step[]).map((n) => {
            const label = { 1: 'Verses', 2: 'Design', 3: 'Create' }[n];
            const reachable = n === 1 || canLeaveStep1;
            return (
              <button
                key={n}
                type="button"
                disabled={!reachable}
                onClick={() => go(n)}
                aria-current={step === n ? 'step' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-1.5 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                  step === n ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                )}
              >
                <span className={cn('flex h-5 w-5 items-center justify-center rounded-full text-xs', step === n ? 'bg-primary-foreground/20' : 'bg-muted')}>
                  {n < step ? <Check className="h-3 w-3" /> : n}
                </span>
                {label}
              </button>
            );
          })}
        </nav>
      </header>

      {!canWrite && <Notice tone="error">You need permission to edit reels to use this.</Notice>}
      {creators.length === 0 && <Notice tone="error">There is no approved creator to publish reels as. Approve a creator profile first.</Notice>}
      {error && <Notice tone="error">{error}</Notice>}

      {step === 1 && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
          <fieldset disabled={!canWrite} className="min-w-0 space-y-4">
            <Field label="Book" htmlFor="rb">
              <Select
                id="rb"
                value={form.bookId}
                onChange={(e) => setForm((f) => ({ ...f, bookId: e.target.value, cantoNumber: '', chapterId: '', tag: '' }))}
              >
                {books.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title} ({b.totalVerses} verses)
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              {(outline.data?.cantos.length ?? 0) > 0 && (
                <Field label="Canto / Skanda" htmlFor="rc">
                  <Select id="rc" value={form.cantoNumber} onChange={(e) => setForm((f) => ({ ...f, cantoNumber: e.target.value, chapterId: '' }))}>
                    <option value="">All</option>
                    {outline.data!.cantos.map((c) => (
                      <option key={c.number} value={c.number}>
                        {c.number}. {c.title}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              {chapters.length > 0 && (
                <Field label="Chapter" htmlFor="rch">
                  <Select id="rch" value={form.chapterId} onChange={(e) => field('chapterId', e.target.value)}>
                    <option value="">All</option>
                    {chapters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.number}. {c.title}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Verse from" htmlFor="rf">
                <Input id="rf" type="number" min={1} placeholder="first" value={form.verseFrom} onChange={(e) => field('verseFrom', e.target.value)} />
              </Field>
              <Field label="Verse to" htmlFor="rt">
                <Input id="rt" type="number" min={1} placeholder="last" value={form.verseTo} onChange={(e) => field('verseTo', e.target.value)} />
              </Field>
            </div>

            {(outline.data?.tags.length ?? 0) > 0 && (
              <Field label="Topic" htmlFor="rtag">
                <Select id="rtag" value={form.tag} onChange={(e) => field('tag', e.target.value)}>
                  <option value="">Any topic</option>
                  {outline.data!.tags.map((t) => (
                    <option key={t.tag} value={t.tag}>
                      {t.tag} ({t.count})
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            <Field label="Hints" htmlFor="rh" hint="Keywords, separated by commas. A verse matches if any appears in its text, translation or tags — e.g. surrender, devotion.">
              <Input id="rh" placeholder="surrender, devotion" value={form.hints} onChange={(e) => field('hints', e.target.value)} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Most reels to make" htmlFor="rl" hint="Up to 100 a run.">
                <Input id="rl" type="number" min={1} max={100} value={form.limit} onChange={(e) => field('limit', e.target.value)} />
              </Field>
              <Field label="Text written in" htmlFor="rlang" hint="Readers still see their own language.">
                <Select id="rlang" value={form.languageCode} onChange={(e) => field('languageCode', e.target.value)}>
                  {languages.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.englishName}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <Checkbox className="mt-0.5" checked={useVerseAudio} onChange={(e) => setUseVerseAudio(e.target.checked)} />
              <span>
                Use each verse&apos;s recitation as the audio
                <span className="block text-xs text-muted-foreground">Verses without a recitation are left out. Off: the design&apos;s background music, if any.</span>
              </span>
            </label>

            <Field label="Publish as" htmlFor="rcr">
              <Select id="rcr" value={creatorId} onChange={(e) => setCreatorId(e.target.value)}>
                {creators.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.displayName}
                  </option>
                ))}
              </Select>
            </Field>
          </fieldset>

          <Card className="self-start">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                Matching verses
                {preview.isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!preview.data ? (
                <p className="text-sm text-muted-foreground">Choose a book.</p>
              ) : total === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No verses match{useVerseAudio ? ' (only verses with a recitation count)' : ''}
                  {templateId ? ', or all of them already have a reel from this design' : ''}. Loosen the choices on the left.
                </p>
              ) : (
                <>
                  <p className="text-sm">
                    <span className="font-semibold">{total}</span> {total === 1 ? 'verse matches' : 'verses match'} — <span className="font-semibold">{willCreate}</span>{' '}
                    {willCreate === 1 ? 'reel' : 'reels'} will be made{total > willCreate ? `, first ${willCreate} in book order` : ''}.
                  </p>
                  <ul className="divide-y rounded-md border">
                    {sample.map((v) => (
                      <li key={v.id} className="space-y-0.5 px-3 py-2 text-sm">
                        <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                          {v.reference}
                          {v.hasAudio && <Music className="h-3 w-3" aria-label="Has a recitation" />}
                        </p>
                        <p className="line-clamp-2">{v.sanskrit}</p>
                        {v.translation && <p className="line-clamp-2 text-xs text-muted-foreground">{v.translation}</p>}
                      </li>
                    ))}
                  </ul>
                  {total > sample.length && <p className="text-xs text-muted-foreground">…and more. Showing the first {sample.length}.</p>}
                </>
              )}
              <div className="flex justify-end pt-2">
                <Button onClick={() => go(2)} disabled={!canLeaveStep1}>
                  Design the reel
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-56">
              <Label htmlFor="rtpl">Design</Label>
              <Select id="rtpl" className="mt-1.5" value={templateId ?? ''} onChange={(e) => void openTemplate(e.target.value)}>
                <option value="">New design</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
                {templateId && !templates.some((t) => t.id === templateId) && <option value={templateId}>{name}</option>}
              </Select>
            </div>
            <div className="w-56">
              <Label htmlFor="rname">Name</Label>
              <Input id="rname" className="mt-1.5" placeholder={`${book?.title ?? 'Verse'} design`} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="w-44">
              <Label htmlFor="rbg">Background</Label>
              <Select id="rbg" className="mt-1.5" value={doc.mediaType} onChange={(e) => changeMediaType(e.target.value as 'VIDEO' | 'IMAGE')}>
                <option value="IMAGE">Image(s)</option>
                <option value="VIDEO">Video</option>
              </Select>
            </div>
            {sample.length > 1 && (
              <div className="w-56">
                <Label htmlFor="rsample">Preview with</Label>
                <Select id="rsample" className="mt-1.5" value={Math.min(sampleIndex, sample.length - 1)} onChange={(e) => setSampleIndex(Number(e.target.value))}>
                  {sample.map((v, i) => (
                    <option key={v.id} value={i}>
                      {v.reference}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <div className="ml-auto flex items-center gap-2">
              {dirty && <span className="text-xs font-medium text-amber-600">Unsaved changes</span>}
              <Button variant="outline" size="icon" aria-label="Undo" title="Undo (Ctrl/⌘ Z)" disabled={!canUndo} onClick={undo}>
                <Undo2 className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" aria-label="Redo" title="Redo (Ctrl/⌘ Shift Z)" disabled={!canRedo} onClick={redo}>
                <Redo2 className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => void saveTemplate()} disabled={busy !== null || !canWrite || (!!templateId && !dirty)}>
                {busy === 'template' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save design
              </Button>
              <Button onClick={() => go(3)} disabled={!backgroundReady}>
                Next
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {!backgroundReady && (
            <Notice tone="info">Add a background {doc.mediaType === 'VIDEO' ? 'video' : 'image'} in the Media tab — every reel is made on it.</Notice>
          )}
          {backgroundReady && !hasBinding && (
            <Notice tone="info">
              Choose where the verse goes: <strong>Verse field</strong> on the left adds a box that is filled from each verse (Sanskrit, transliteration, translation or reference).
            </Notice>
          )}

          <ReelDesigner history={history} canWrite={canWrite} initialTab="media" verseTexts={verseTexts} onSave={() => void saveTemplate()} />
        </div>
      )}

      {step === 3 && (
        <div className="mx-auto max-w-2xl space-y-4">
          {result ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  {result.created} {result.created === 1 ? 'reel' : 'reels'} made{result.published ? ' and published' : ' as drafts'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {!result.published && result.created > 0 && <p className="text-muted-foreground">Review them in Reels, change anything you like, then publish.</p>}
                {result.skipped.length > 0 && (
                  <div>
                    <p className="mb-1 font-medium">Left out ({result.skipped.length})</p>
                    <ul className="max-h-40 space-y-0.5 overflow-auto rounded-md border p-2 text-xs text-muted-foreground">
                      {result.skipped.map((s) => (
                        <li key={s.verseId}>
                          <span className="font-mono">{s.verseId}</span> — {s.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button asChild>
                    <Link to={result.published ? '/reels?status=PUBLISHED' : '/reels?status=DRAFT'}>View in Reels</Link>
                  </Button>
                  {result.reels[0] && (
                    <Button variant="outline" asChild>
                      <Link to={`/reels/${result.reels[0].id}`}>Open the first one</Link>
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => go(1)}>
                    Make the next batch
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ready to create</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-1.5">
                  <Row label="Book">{book?.title}</Row>
                  <Row label="Reels">
                    {willCreate} of {total} matching {total === 1 ? 'verse' : 'verses'}
                  </Row>
                  <Row label="Design">
                    {name.trim() || `${book?.title ?? 'Verse'} design`}
                    {dirty && <span className="ml-2 text-xs text-amber-600">(saved when you create)</span>}
                  </Row>
                  <Row label="Audio">{useVerseAudio ? 'Each verse’s recitation' : doc.audioPath ? 'The design’s background music' : 'None'}</Row>
                  <Row label="Published as">{creators.find((c) => c.id === creatorId)?.displayName}</Row>
                  <Row label="Tagged">
                    <span className="flex flex-wrap gap-1">
                      {['book', 'canto', 'chapter'].map((t) => (
                        <Badge key={t} variant="secondary">
                          {t}
                        </Badge>
                      ))}
                      <span className="text-xs text-muted-foreground">+ their names, and the hints — so readers can play more like it</span>
                    </span>
                  </Row>
                </dl>

                <Field label="Extra tags" htmlFor="rxt" hint="Optional, separated by commas — added to every reel.">
                  <Input id="rxt" placeholder="gita-wisdom, daily" value={extraTags} onChange={(e) => setExtraTags(e.target.value)} />
                </Field>

                {canPublish && (
                  <label className="flex cursor-pointer items-start gap-2">
                    <Checkbox className="mt-0.5" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
                    <span>
                      Publish them straight away
                      <span className="block text-xs text-muted-foreground">Off: they are made as drafts to look over first.</span>
                    </span>
                  </label>
                )}

                {!hasBinding && <Notice tone="info">The design has no verse field, so every reel will show the same background and text. Go back to add one.</Notice>}

                <div className="flex justify-between pt-2">
                  <Button variant="outline" onClick={() => go(2)}>
                    <ArrowLeft className="h-4 w-4" />
                    Back to design
                  </Button>
                  <Button onClick={() => void create()} disabled={busy !== null || !canWrite || willCreate === 0 || !backgroundReady}>
                    {busy === 'create' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Create {willCreate} {willCreate === 1 ? 'reel' : 'reels'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

function Notice({ tone, children }: { tone: 'info' | 'error'; children: ReactNode }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={
        tone === 'error'
          ? 'rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive'
          : 'rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground'
      }
    >
      {children}
    </div>
  );
}
