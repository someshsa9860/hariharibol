// A prayer in each language: the title, summary and about, and for every verse the meaning and — where the language's script is
// not the original's — the verse written out in it. A language needs one of three things (`how`, decided by the server from the
// original's script): nothing ("same script"), a rule that converts the original when it is read (a verse can be overridden by
// hand), or a stored rendering written by a run or by hand. English has no header or meanings here (it is the prayer itself),
// only the Roman spelling of the verses. A row saved by hand is never replaced by a run.

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Languages, Loader2, Save, Trash2, Undo2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Counter, Problem, VERSE_FONT, message, useReportDirty, type Dirty } from '@/components/prayer-form-bits';
import {
  HOW_HINT, HOW_LABEL, STATE_LABEL, STATE_VARIANT, languageName, languageState, useDeletePrayerLanguage, usePrayerLanguage, useSavePrayerLanguage,
  type LanguageDetail, type PrayerDetail, type PrayerOverview,
} from '@/lib/prayers';
import { cn } from '@/lib/utils';

const LIMITS = { title: 400, summary: 800 };

type Form = { title: string; summary: string; about: string; verses: Record<string, { text: string; meaning: string }> };

const fromDetail = (d: LanguageDetail): Form => ({
  title: d.header?.title ?? '',
  summary: d.header?.summary ?? '',
  about: d.header?.about ?? '',
  verses: Object.fromEntries(d.verses.map((v) => [v.verseId, { text: v.text ?? '', meaning: v.meaning ?? '' }])),
});

// ── The languages ───────────────────────────────────────────────────────────────────────────────────

export function PrayerLanguages({ prayer, overview, setDirty, canTranslate, onTranslate }: {
  prayer: PrayerDetail;
  overview: PrayerOverview;
  setDirty: Dirty;
  canTranslate: boolean;
  onTranslate: (language: string) => void;
}) {
  const [language, setLanguage] = useState<string>(prayer.languages[0]?.code ?? '');
  // Whether the open language has unsaved edits, so choosing another asks first (the editor's own state goes with it).
  const editing = useRef(false);
  const track: Dirty = (key, dirty) => {
    editing.current = dirty;
    setDirty(key, dirty);
  };
  const nameOf = (code: string) => overview.languages.find((l) => l.code === code)?.name ?? prayer.languages.find((l) => l.code === code)?.name ?? languageName(code);

  const choose = (code: string) => {
    if (code === language) return;
    if (editing.current && !confirm(`Leave ${nameOf(language)} without saving your changes?`)) return;
    editing.current = false;
    setLanguage(code);
  };

  if (prayer.verses.length === 0) {
    return <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">Add and save the prayer’s verses first; the languages are written from them.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Language">
        {prayer.languages.map((l) => {
          const state = languageState(l, prayer.verses);
          return (
            <button
              key={l.code}
              type="button"
              role="tab"
              aria-selected={l.code === language}
              onClick={() => choose(l.code)}
              className={cn('rounded-lg border px-3 py-1.5 text-left transition-colors', l.code === language ? 'border-primary bg-primary/5 ring-1 ring-primary/40' : 'bg-card hover:bg-accent')}
            >
              <span className="block text-sm font-semibold">{nameOf(l.code)}</span>
              <span className="mt-0.5 flex items-center gap-1.5">
                <Badge variant={STATE_VARIANT[state]} className="px-1.5 py-0 text-[10px]">{STATE_LABEL[state]}</Badge>
                <span className="text-[11px] text-muted-foreground">{HOW_LABEL[l.how]}</span>
              </span>
            </button>
          );
        })}
      </div>
      {language && <LanguageEditor key={language} prayer={prayer} language={language} languageLabel={nameOf(language)} setDirty={track} canTranslate={canTranslate} onTranslate={onTranslate} />}
    </div>
  );
}

// ── One language ────────────────────────────────────────────────────────────────────────────────────

function LanguageEditor({ prayer, language, languageLabel, setDirty, canTranslate, onTranslate }: {
  prayer: PrayerDetail;
  language: string;
  languageLabel: string;
  setDirty: Dirty;
  canTranslate: boolean;
  onTranslate: (language: string) => void;
}) {
  const query = usePrayerLanguage(prayer.id, language);
  if (query.isError && !query.data) return <Problem>{message(query.error)}</Problem>;
  if (!query.data) return <Skeleton className="h-64 w-full" />;
  return <LanguageForm prayer={prayer} language={language} languageLabel={languageLabel} detail={query.data} setDirty={setDirty} canTranslate={canTranslate} onTranslate={onTranslate} />;
}

function LanguageForm({ prayer, language, languageLabel, detail, setDirty, canTranslate, onTranslate }: {
  prayer: PrayerDetail;
  language: string;
  languageLabel: string;
  detail: LanguageDetail;
  setDirty: Dirty;
  canTranslate: boolean;
  onTranslate: (language: string) => void;
}) {
  const save = useSavePrayerLanguage(prayer.id);
  const remove = useDeletePrayerLanguage(prayer.id);
  const isEnglish = language === 'en';
  const { how } = detail;

  const [base, setBase] = useState<Form>(() => fromDetail(detail));
  const [form, setForm] = useState<Form>(base);
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = JSON.stringify(form) !== JSON.stringify(base);
  useReportDirty(`language:${language}`, dirty, setDirty);

  // A run that finishes, or a save from elsewhere, changes what the server holds. Take it in unless there is something typed here.
  const dirtyNow = useRef(dirty);
  dirtyNow.current = dirty;
  useEffect(() => {
    if (dirtyNow.current) return;
    const next = fromDetail(detail);
    setBase(next);
    setForm(next);
  }, [detail]);

  const headerChanged = form.title !== base.title || form.summary !== base.summary || form.about !== base.about;
  const headerProblem = !isEnglish && headerChanged && !form.title.trim() && (form.summary.trim() || form.about.trim()) ? 'Write the translated title first; the summary and about go with it.' : null;

  const setVerse = (id: string, changes: Partial<{ text: string; meaning: string }>) => setForm({ ...form, verses: { ...form.verses, [id]: { ...form.verses[id], ...changes } } });

  const submit = () => {
    setProblem(null);
    setSaved(false);
    const verses = detail.verses.flatMap((v) => {
      const now = form.verses[v.verseId];
      const before = base.verses[v.verseId];
      const item: { verseId: string; text?: string; meaning?: string } = { verseId: v.verseId };
      if (how !== 'same' && now.text !== before.text) item.text = now.text.trim();
      if (!isEnglish && now.meaning !== before.meaning) item.meaning = now.meaning.trim();
      return item.text !== undefined || item.meaning !== undefined ? [item] : [];
    });
    const header = !isEnglish && headerChanged ? { title: form.title.trim(), summary: form.summary.trim(), about: form.about.trim() } : undefined;
    save.mutate(
      { language, ...(header ? { header } : {}), verses },
      {
        onSuccess: () => {
          setBase(form);
          setSaved(true);
        },
        onError: (err) => setProblem(message(err)),
      }
    );
  };

  const doDelete = () => {
    if (!confirm(`Delete everything written in ${languageLabel} for this prayer — the title, the meanings and any verse written out? Readers then see the next language in their chain until it is written again.`)) return;
    setProblem(null);
    remove.mutate(language, { onError: (err) => setProblem(message(err)) });
  };

  const busy = save.isPending || remove.isPending;
  const summary = prayer.languages.find((l) => l.code === language);
  const written = !!summary && (summary.header || summary.texts > 0 || summary.meanings > 0);

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="space-y-1 text-xs text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">{HOW_LABEL[how]}.</span> {HOW_HINT[how]}
        </p>
        {isEnglish && <p>English is the prayer itself: its title, summary and meanings are the English fields. Only the Roman spelling of each verse is kept here.</p>}
        {!isEnglish && !detail.header && <p>No {languageLabel} title yet. Write one here, or let a run make it from the Translations tab.</p>}
        {detail.header?.isEdited && <p>The title, summary and about were written or corrected by hand; a run will not replace them.</p>}
      </div>

      {!isEnglish && (
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="prayer-l-title">Title</Label>
              <Counter value={form.title} max={LIMITS.title} />
            </div>
            <Input id="prayer-l-title" value={form.title} onChange={(ev) => setForm({ ...form, title: ev.target.value })} maxLength={LIMITS.title} disabled={busy} />
            <p className="text-xs text-muted-foreground">English: {prayer.title}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="prayer-l-summary">Summary</Label>
              <Counter value={form.summary} max={LIMITS.summary} />
            </div>
            <Textarea id="prayer-l-summary" rows={2} value={form.summary} onChange={(ev) => setForm({ ...form, summary: ev.target.value })} maxLength={LIMITS.summary} disabled={busy} />
            {prayer.summary && <p className="text-xs text-muted-foreground">English: {prayer.summary}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="prayer-l-about">About</Label>
            <Textarea id="prayer-l-about" rows={4} value={form.about} onChange={(ev) => setForm({ ...form, about: ev.target.value })} disabled={busy} />
            {prayer.about && <p className="line-clamp-3 whitespace-pre-line text-xs text-muted-foreground">English: {prayer.about}</p>}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {detail.verses.map((v, index) => {
          const now = form.verses[v.verseId] ?? { text: '', meaning: '' };
          const inputs = `prayer-l-${v.verseId}`;
          return (
            <div key={v.verseId} className="space-y-2 rounded-lg border bg-muted/20 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Verse {index + 1}</p>
                {v.isEdited && <Badge variant="outline">By hand</Badge>}
                {!v.isEdited && v.translatedBy && <Badge variant="secondary">{v.translatedBy}</Badge>}
                {v.stale && <Badge variant="destructive">Out of date</Badge>}
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="space-y-2 text-sm">
                  <p className="whitespace-pre-line text-base leading-relaxed" style={{ fontFamily: VERSE_FONT }}>{v.original}</p>
                  {!isEnglish && prayer.verses[index]?.meaning && <p className="whitespace-pre-line text-xs text-muted-foreground">English: {prayer.verses[index].meaning}</p>}
                  {how === 'rule' && v.automatic && (
                    <div className="rounded-md border bg-card px-2 py-1.5">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Automatic {languageLabel}</p>
                      <p className="whitespace-pre-line" style={{ fontFamily: VERSE_FONT }}>{v.automatic}</p>
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  {how !== 'same' && (
                    <div className="space-y-1">
                      <Label htmlFor={`${inputs}-text`}>{how === 'rule' ? `Override in ${languageLabel}` : `In ${languageLabel} script`}</Label>
                      <Textarea
                        id={`${inputs}-text`}
                        rows={3}
                        value={now.text}
                        onChange={(ev) => setVerse(v.verseId, { text: ev.target.value })}
                        disabled={busy}
                        style={{ fontFamily: VERSE_FONT }}
                        placeholder={how === 'rule' ? 'Empty: the automatic one is used' : 'Not written yet'}
                      />
                    </div>
                  )}
                  {!isEnglish && (
                    <div className="space-y-1">
                      <Label htmlFor={`${inputs}-meaning`}>Meaning in {languageLabel}</Label>
                      <Textarea id={`${inputs}-meaning`} rows={3} value={now.meaning} onChange={(ev) => setVerse(v.verseId, { meaning: ev.target.value })} disabled={busy} />
                    </div>
                  )}
                  {how === 'same' && <p className="text-xs text-muted-foreground">The verse is shown as the original.</p>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Problem>{headerProblem ?? problem}</Problem>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {written && (
          <Button variant="outline" className="mr-auto text-destructive" onClick={doDelete} disabled={busy}>
            {remove.isPending ? <Loader2 className="animate-spin" /> : <Trash2 />} Delete {languageLabel}
          </Button>
        )}
        {canTranslate && (
          <Button variant="outline" onClick={() => onTranslate(language)} disabled={busy} title="Opens the Translations tab with this language ready to start">
            <Languages /> Write with AI…
          </Button>
        )}
        {saved && !dirty && (
          <span className="inline-flex items-center gap-1 text-xs text-success">
            <CheckCircle2 className="h-3.5 w-3.5" /> Saved
          </span>
        )}
        {dirty && (
          <Button variant="outline" onClick={() => setForm(base)} disabled={busy}>
            <Undo2 /> Discard
          </Button>
        )}
        <Button onClick={submit} disabled={busy || !dirty || !!headerProblem}>
          {save.isPending ? <Loader2 className="animate-spin" /> : <Save />} Save {languageLabel}
        </Button>
      </div>
    </div>
  );
}
