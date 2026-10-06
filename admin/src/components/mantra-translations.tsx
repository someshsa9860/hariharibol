import { useEffect, useState } from 'react';
import { Check, Languages, Sparkles, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/input';
import { useResource, useResourceMutation } from '@/lib/use-resource';
import { api, ApiRequestError } from '@/lib/api';
import { cn } from '@/lib/utils';

type Language = { code: string; nativeName: string; englishName: string; isRtl: boolean };

type Translation = {
  id: string;
  languageCode: string;
  name: string | null;
  text: string;
  meaning: string | null;
  purport: string | null;
  isPublished: boolean;
};

type MantraDetail = { id: string; name: string; sanskrit: string; translations: Translation[] };

const EMPTY = { name: '', text: '', meaning: '', purport: '', isPublished: true };

// Languages written in Devanagari — the Sanskrit source is already their script.
const DEVANAGARI = ['sa', 'hi', 'mr'];

/**
 * Every language rendering of one mantra, in one place. `text` is the mantra in
 * that language's script (what someone who cannot read Devanagari or English
 * chants from); `meaning` and `purport` are what a reader in that language
 * sees. The app picks the two by separate user settings, so both live on the
 * same row.
 */
export function MantraTranslations({
  mantra,
  onClose,
  canWrite,
  canDelete,
}: {
  mantra: { id: string; name: string } | null;
  onClose: () => void;
  canWrite: boolean;
  canDelete: boolean;
}) {
  const mutate = useResourceMutation('mantras');
  const languages = useResource<Language[]>(['mantras', 'languages'], '/api/admin/mantras/languages', undefined, {
    enabled: !!mantra,
  });
  const detail = useResource<MantraDetail>(['mantras', 'detail', mantra?.id], `/api/admin/mantras/${mantra?.id}`, undefined, {
    enabled: !!mantra,
  });

  const [code, setCode] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const byCode = new Map((detail.data?.translations ?? []).map((t) => [t.languageCode, t]));
  const list = languages.data ?? [];
  const existing = byCode.get(code);

  // Start on the first language that still needs doing, or the first at all.
  useEffect(() => {
    if (!mantra) return setCode('');
    if (!code && list.length && detail.data) setCode((list.find((l) => !byCode.has(l.code)) ?? list[0]).code);
  }, [mantra, code, list.length, detail.data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load the chosen language's row (or a blank one) into the form.
  useEffect(() => {
    setError('');
    if (!detail.data) return;
    const t = byCode.get(code);
    setForm(t ? { name: t.name ?? '', text: t.text, meaning: t.meaning ?? '', purport: t.purport ?? '', isPublished: t.isPublished } : EMPTY);
  }, [code, detail.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const language = list.find((l) => l.code === code);
  const done = list.filter((l) => byCode.has(l.code)).length;

  async function draftFromSanskrit() {
    if (!detail.data) return;
    setBusy(true);
    setError('');
    try {
      const res = await api.post<{ text: string }>('/api/admin/mantras/transliterate', { text: detail.data.sanskrit, languageCode: code });
      setForm((f) => ({ ...f, text: res.data.text }));
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Could not convert the text.');
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!mantra) return;
    setError('');
    try {
      await mutate.mutateAsync({
        path: `/api/admin/mantras/${mantra.id}/translations`,
        method: 'put',
        body: {
          languageCode: code,
          name: form.name.trim() || null,
          text: form.text,
          meaning: form.meaning.trim() || null,
          purport: form.purport.trim() || null,
          isPublished: form.isPublished,
        },
      });
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Could not save this translation.');
    }
  }

  async function remove() {
    if (!mantra || !existing || !confirm(`Delete the ${language?.englishName} translation?`)) return;
    try {
      await mutate.mutateAsync({ path: `/api/admin/mantras/${mantra.id}/translations/${existing.id}`, method: 'delete' });
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Could not delete this translation.');
    }
  }

  return (
    <Dialog open={!!mantra} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Languages className="h-5 w-5" />
            Translations — {mantra?.name}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {done} of {list.length} languages. Text is the mantra in that script; meaning and purport are what readers of that language see.
          </p>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-[13rem_1fr]">
          <ul className="max-h-[60vh] space-y-1 overflow-y-auto pr-1">
            {list.map((l) => {
              const t = byCode.get(l.code);
              return (
                <li key={l.code}>
                  <button
                    type="button"
                    onClick={() => setCode(l.code)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-accent',
                      l.code === code && 'bg-accent font-medium'
                    )}
                  >
                    <span>
                      {l.nativeName}
                      <span className="ml-1.5 text-xs text-muted-foreground">{l.englishName}</span>
                    </span>
                    {t ? <Check className={cn('h-4 w-4', t.isPublished ? 'text-success' : 'text-muted-foreground')} /> : null}
                  </button>
                </li>
              );
            })}
          </ul>

          {language && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-medium">
                  {language.nativeName} <span className="text-sm text-muted-foreground">({language.code})</span>
                </p>
                {existing ? (
                  <Badge variant={existing.isPublished ? 'success' : 'secondary'}>{existing.isPublished ? 'Published' : 'Hidden'}</Badge>
                ) : (
                  <Badge variant="warning">Missing</Badge>
                )}
              </div>

              <div>
                <Label>Name in this language (optional)</Label>
                <Input className="mt-1" dir={language.isRtl ? 'rtl' : undefined} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={!canWrite} />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label>Mantra text</Label>
                  {canWrite && detail.data && (
                    <Button type="button" variant="ghost" size="sm" onClick={draftFromSanskrit} disabled={busy}>
                      <Sparkles className="h-3.5 w-3.5" />
                      {DEVANAGARI.includes(code) ? 'Copy Sanskrit' : 'Draft from Sanskrit'}
                    </Button>
                  )}
                </div>
                <Textarea className="mt-1 min-h-24 text-base" dir={language.isRtl ? 'rtl' : undefined} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} disabled={!canWrite} />
              </div>
              <div>
                <Label>Meaning</Label>
                <Textarea className="mt-1" dir={language.isRtl ? 'rtl' : undefined} value={form.meaning} onChange={(e) => setForm({ ...form, meaning: e.target.value })} disabled={!canWrite} />
              </div>
              <div>
                <Label>Purport (optional)</Label>
                <Textarea className="mt-1" dir={language.isRtl ? 'rtl' : undefined} value={form.purport} onChange={(e) => setForm({ ...form, purport: e.target.value })} disabled={!canWrite} />
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} disabled={!canWrite} />
                Show to readers
              </label>

              {error && <p className="text-sm text-destructive">{error}</p>}

              {canWrite && (
                <div className="flex justify-between">
                  {canDelete && existing ? (
                    <Button variant="outline" className="text-destructive" onClick={remove} disabled={mutate.isPending}>
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  ) : (
                    <span />
                  )}
                  <Button onClick={save} disabled={!form.text.trim() || mutate.isPending}>
                    {existing ? 'Save changes' : 'Add translation'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
