import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input, Label, Select } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useResource } from '@/lib/use-resource';
import { api, ApiRequestError } from '@/lib/api';
import { uploadFile, UploadError } from '@/lib/upload';

const KEY = 'book-reel-style';

type Style = {
  background: 'gradient' | 'solid' | 'image';
  colorTop: string;
  colorBottom: string;
  imageKey: string | null;
  imageDim: number;
  sanskritColor: string;
  transliterationColor: string;
  meaningColor: string;
  purportColor: string;
  accentColor: string;
  textScale: number;
  minPageSeconds: number;
  wordsPerSecond: number;
  showLike: number;
  showComments: number;
  showSave: number;
  showShare: number;
  showMore: number;
  showReference: number;
};
type Payload = { style: Style; imageUrl: string | null; defaults: Style };

const COLORS: { key: keyof Style; label: string }[] = [
  { key: 'sanskritColor', label: 'Sanskrit' },
  { key: 'transliterationColor', label: 'Transliteration' },
  { key: 'meaningColor', label: 'Meaning' },
  { key: 'purportColor', label: 'Purport' },
  { key: 'accentColor', label: 'Accent (reference, progress bar)' },
];

const BUTTONS: { key: keyof Style; label: string }[] = [
  { key: 'showLike', label: 'Like' },
  { key: 'showComments', label: 'Comments' },
  { key: 'showSave', label: 'Save' },
  { key: 'showShare', label: 'Share (opens the Share Studio)' },
  { key: 'showMore', label: 'More (copy link, report)' },
  { key: 'showReference', label: 'Verse reference at the top, such as “Bhagavad Gita 2.47”' },
];

const errorText = (error: unknown) =>
  error instanceof ApiRequestError || error instanceof UploadError ? error.message : 'Request failed.';

export function BookReelStylePage() {
  const queryClient = useQueryClient();
  const data = useResource<Payload>([KEY], '/api/admin/reels/book-style');
  const [style, setStyle] = useState<Style | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (data.data) {
      setStyle(data.data.style);
      setImageUrl(data.data.imageUrl);
    }
  }, [data.data]);

  if (!style || !data.data) {
    return data.error ? <p className="text-sm text-destructive">{errorText(data.error)}</p> : <Skeleton className="h-64 w-full" />;
  }

  const set = <K extends keyof Style>(key: K, value: Style[K]) => setStyle({ ...style, [key]: value });

  async function pickImage(file: File | undefined) {
    if (!file) return;
    try {
      const key = await uploadFile('reelImage', file);
      setStyle((current) => (current ? { ...current, imageKey: key, background: 'image' } : current));
      setImageUrl(URL.createObjectURL(file));
    } catch (e) {
      setNotice({ tone: 'error', text: errorText(e) });
    }
  }

  async function save() {
    if (!style) return;
    setSaving(true);
    setNotice(null);
    try {
      await api.put('/api/admin/reels/book-style', style);
      await queryClient.invalidateQueries({ queryKey: [KEY] });
      setNotice({ tone: 'success', text: 'Saved. Readers see it the next time they open a book reel.' });
    } catch (e) {
      setNotice({ tone: 'error', text: errorText(e) });
    } finally {
      setSaving(false);
    }
  }

  const background =
    style.background === 'gradient'
      ? `linear-gradient(${style.colorTop}, ${style.colorBottom})`
      : style.background === 'solid'
        ? style.colorTop
        : style.colorTop;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Book reels"
        description="How the verse reels (Bhagavad Gita and Srimad Bhagavatam) look and which buttons they show. Their text is always the verse itself, in each reader’s reading language."
        actions={
          <Button variant="outline" asChild>
            <Link to="/reels">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Reels
            </Link>
          </Button>
        }
      />
      {notice && <p className={notice.tone === 'error' ? 'text-sm text-destructive' : 'text-sm text-emerald-600'}>{notice.text}</p>}

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-4 py-4">
              <h3 className="font-medium">Background</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="bg">Kind</Label>
                  <Select id="bg" value={style.background} onChange={(e) => set('background', e.target.value as Style['background'])}>
                    <option value="gradient">Gradient</option>
                    <option value="solid">One colour</option>
                    <option value="image">Picture</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="top">{style.background === 'gradient' ? 'Top colour' : 'Colour'}</Label>
                  <Input id="top" type="color" value={style.colorTop} onChange={(e) => set('colorTop', e.target.value)} />
                </div>
                {style.background === 'gradient' && (
                  <div>
                    <Label htmlFor="bottom">Bottom colour</Label>
                    <Input id="bottom" type="color" value={style.colorBottom} onChange={(e) => set('colorBottom', e.target.value)} />
                  </div>
                )}
              </div>
              {style.background === 'image' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="img">Picture (JPEG, PNG or WebP)</Label>
                    <Input id="img" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => pickImage(e.target.files?.[0])} />
                  </div>
                  <div>
                    <Label htmlFor="dim">Dark wash over it: {style.imageDim}%</Label>
                    <Input id="dim" type="range" min={0} max={90} value={style.imageDim} onChange={(e) => set('imageDim', Number(e.target.value))} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 py-4">
              <h3 className="font-medium">Text</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                {COLORS.map(({ key, label }) => (
                  <div key={key}>
                    <Label htmlFor={key}>{label}</Label>
                    <Input id={key} type="color" value={style[key] as string} onChange={(e) => set(key, e.target.value as never)} />
                  </div>
                ))}
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="scale">Size: {style.textScale.toFixed(2)}×</Label>
                  <Input id="scale" type="range" min={0.7} max={1.5} step={0.05} value={style.textScale} onChange={(e) => set('textScale', Number(e.target.value))} />
                </div>
                <div>
                  <Label htmlFor="minsec">Shortest page: {style.minPageSeconds}s</Label>
                  <Input id="minsec" type="range" min={2} max={30} step={1} value={style.minPageSeconds} onChange={(e) => set('minPageSeconds', Number(e.target.value))} />
                </div>
                <div>
                  <Label htmlFor="wps">Reading speed: {style.wordsPerSecond} words/s</Label>
                  <Input id="wps" type="range" min={1} max={8} step={0.5} value={style.wordsPerSecond} onChange={(e) => set('wordsPerSecond', Number(e.target.value))} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                A page stays up for as long as it takes to read at this speed, never less than the shortest page, then the next one comes in and the last page hands over to the next reel.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 py-4">
              <h3 className="font-medium">Buttons</h3>
              {BUTTONS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={style[key] === 1} onChange={(e) => set(key, (e.target.checked ? 1 : 0) as never)} />
                  {label}
                </label>
              ))}
              <p className="text-xs text-muted-foreground">With every button off the text takes the whole width of the screen.</p>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button variant="ghost" onClick={() => setStyle(data.data!.defaults)}>
              Reset to defaults
            </Button>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Preview</p>
          <div
            className="relative aspect-[9/16] w-full overflow-hidden rounded-xl border"
            style={{
              background,
              backgroundImage: style.background === 'image' && imageUrl ? `url(${imageUrl})` : undefined,
              backgroundSize: 'cover',
            }}
          >
            {style.background === 'image' && <div className="absolute inset-0 bg-black" style={{ opacity: style.imageDim / 100 }} />}
            <div className="relative flex h-full flex-col items-center justify-center gap-3 px-6 text-center" style={{ paddingRight: style.showLike || style.showComments || style.showSave || style.showShare || style.showMore ? 56 : 24 }}>
              {style.showReference === 1 && <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: style.accentColor }}>Bhagavad Gita 2.47</span>}
              <span style={{ color: style.sanskritColor, fontSize: 20 * style.textScale }}>कर्मण्येवाधिकारस्ते मा फलेषु कदाचन</span>
              <span style={{ color: style.transliterationColor, fontSize: 14 * style.textScale }}>karmaṇy-evādhikāras te mā phaleṣu kadācana</span>
              <span style={{ color: style.meaningColor, fontSize: 14 * style.textScale }}>You have a right to perform your duty, but not to the fruits.</span>
            </div>
            <div className="absolute bottom-4 right-2 flex flex-col gap-3 text-xs text-white">
              {style.showLike === 1 && <span>♥</span>}
              {style.showComments === 1 && <span>💬</span>}
              {style.showShare === 1 && <span>↪</span>}
              {style.showSave === 1 && <span>🔖</span>}
              {style.showMore === 1 && <span>⋯</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
