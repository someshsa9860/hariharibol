'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { Sheet } from '@/components/ui/sheet';
import { Icon } from '@/components/ui/icon';
import { useToast } from '@/components/ui/toast';
import { api, describeError, rawRequest } from '@/lib/api/client';
import { ApiError } from '@/lib/api/core';
import { useAuth } from '@/lib/auth/auth-provider';
import { copyText } from '@/lib/share';
import { linkFor, plainText, type MadeLink, type ShareTarget } from '@/lib/share-link';
import {
  FONTS, PHOTO_PRESETS, RATIOS, THEMES, canvasToBlob, checkImageFile, defaultSpec, loadCardFonts, renderCard, themeToBackground,
  type CardSpec, type FontKey, type Layout, type PatternKey, type RatioKey,
} from '@/lib/share-card';

type Tab = 'look' | 'text' | 'layout' | 'ai' | 'reel' | 'share';
const TABS: { id: Tab; label: string }[] = [
  { id: 'look', label: 'Background' }, { id: 'text', label: 'Text' }, { id: 'layout', label: 'Layout' }, { id: 'ai', label: 'AI picture' }, { id: 'reel', label: 'Make reel' }, { id: 'share', label: 'Share' },
];

interface Quote { enabled: boolean; affordable: boolean; costPercent: number | null; blockedBy: string | null; canUpgrade: boolean; suggestions: string[] }
interface Job { id: string; status: 'PENDING' | 'DONE' | 'FAILED'; error: string | null }

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = src; });

export function ShareStudio({ target, onClose }: { target: ShareTarget; onClose: () => void }) {
  const toast = useToast();
  const { status, requireSignIn } = useAuth();
  const original = useMemo(() => defaultSpec({ sanskrit: target.sanskrit, transliteration: target.transliteration, translation: target.translation, reference: target.reference ?? target.title }), [target]);
  const [spec, setSpecState] = useState<CardSpec>(original);
  const history = useRef<CardSpec[]>([]);
  const [tab, setTab] = useState<Tab>('look');
  const [ready, setReady] = useState(false);
  const [link, setLink] = useState<MadeLink | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const logo = useRef<HTMLImageElement | null>(null);
  const layout = useRef<Layout | null>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Every change goes through here so Undo has something to go back to.
  const setSpec = useCallback((next: CardSpec | ((current: CardSpec) => CardSpec), remember = true) => {
    setSpecState((current) => {
      const value = typeof next === 'function' ? next(current) : next;
      if (remember) history.current = [...history.current.slice(-29), current];
      return value;
    });
  }, []);
  const undo = () => { const last = history.current.pop(); if (last) setSpecState(last); };
  const reset = () => { history.current = []; setSpecState(original); };

  useEffect(() => {
    let live = true;
    Promise.all([loadImage('/img/logo-transparent.png'), loadCardFonts()]).then(([img]) => { if (live) { logo.current = img; setReady(true); } }, () => { if (live) toast('The logo could not be loaded'); });
    return () => { live = false; };
  }, [toast]);

  useEffect(() => { linkFor(target).then(setLink, () => setLink(null)); }, [target, status]);

  useEffect(() => {
    if (!ready || !canvas.current || !logo.current) return;
    layout.current = renderCard(spec, logo.current, 900, canvas.current).layout;
  }, [spec, ready]);

  // Dragging the text on the card. Arrow keys do the same for anyone not using a pointer.
  const point = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { fx: (event.clientX - rect.left) / rect.width, fy: (event.clientY - rect.top) / rect.height };
  };
  const onDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const { fx, fy } = point(event);
    const { w, h } = RATIOS[spec.ratio];
    const box = layout.current?.box;
    if (!box || fx * w < box.x - 30 || fx * w > box.x + box.w + 30 || fy * h < box.y - 30 || fy * h > box.y + box.h + 30) return;
    history.current = [...history.current.slice(-29), spec];
    drag.current = { dx: spec.text.x - fx, dy: spec.text.y - fy };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drag.current) return;
    const { fx, fy } = point(event);
    const d = drag.current;
    setSpec((s) => ({ ...s, text: { ...s.text, x: Math.min(1, Math.max(0, fx + d.dx)), y: Math.min(1, Math.max(0, fy + d.dy)) } }), false);
  };
  const onKey = (event: React.KeyboardEvent) => {
    const step = event.shiftKey ? 0.05 : 0.01;
    const move: Record<string, [number, number]> = { ArrowUp: [0, -step], ArrowDown: [0, step], ArrowLeft: [-step, 0], ArrowRight: [step, 0] };
    const m = move[event.key];
    if (!m) return;
    event.preventDefault();
    setSpec((s) => ({ ...s, text: { ...s.text, x: Math.min(1, Math.max(0, s.text.x + m[0])), y: Math.min(1, Math.max(0, s.text.y + m[1])) } }));
  };

  const patchText = (patch: Partial<CardSpec['text']>) => setSpec((s) => ({ ...s, text: { ...s.text, ...patch } }));
  const patchBg = (patch: Partial<CardSpec['background']>) => setSpec((s) => ({ ...s, background: { ...s.background, ...patch } }));
  const theme = (id: string) => {
    const t = THEMES.find((x) => x.id === id);
    if (t) setSpec((s) => ({ ...s, background: themeToBackground(t, s.background), text: { ...s.text, color: t.text } }));
  };
  const applyImage = (image: CanvasImageSource, w: number, h: number) =>
    setSpec((s) => ({ ...s, background: { ...s.background, kind: 'image', image, imageSize: { w, h }, zoom: 1, panX: 0, panY: 0, overlay: Math.max(s.background.overlay, 0.25), overlayColor: '#000000' }, text: { ...s.text, color: '#ffffff' } }));

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    const result = await checkImageFile(file);
    if (!result.ok) { toast(result.message); return; }
    applyImage(result.bitmap, result.bitmap.width, result.bitmap.height);
  };
  const usePhoto = async (src: string) => {
    try { const img = await loadImage(src); applyImage(img, img.naturalWidth, img.naturalHeight); } catch { toast('That picture could not be loaded'); }
  };

  // ── AI picture ──
  const [quote, setQuote] = useState<Quote | null>(null);
  const [prompt, setPrompt] = useState('');
  const [job, setJob] = useState<{ job: Job; image: ImageBitmap | null } | null>(null);
  const [aiProblem, setAiProblem] = useState<{ kind: 'credit' | 'other'; text: string } | null>(null);
  const attempt = useRef<string | null>(null);

  useEffect(() => {
    if (tab !== 'ai' || status !== 'in' || quote) return;
    api<Quote>('/share/background/quote', { auth: 'required' }).then(setQuote, () => setQuote(null));
  }, [tab, status, quote]);

  const generate = async () => {
    if (!requireSignIn('Sign in to make a picture with your Ask Sakha credit')) return;
    // One key per attempt: pressing again after a failure re-sends the same key, so it can never be charged twice.
    attempt.current ??= `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    setBusy('ai'); setAiProblem(null);
    try {
      const made = await api<Job>('/share/background', { method: 'POST', auth: 'required', body: { requestKey: attempt.current, prompt: `${prompt}${target.sanskrit ? '' : ''}` } });
      if (made.status === 'DONE') {
        const response = await rawRequest(`/share/background/${made.id}/image`, { auth: 'required' });
        if (!response.ok) throw new Error('image');
        const bitmap = await createImageBitmap(await response.blob());
        setJob({ job: made, image: bitmap });
        attempt.current = null;
      } else if (made.status === 'FAILED') {
        setJob(null);
        setAiProblem({ kind: 'other', text: 'The picture could not be made, and you were not charged. You can try again.' });
      } else {
        setAiProblem({ kind: 'other', text: 'Your picture is still being made. Please try again in a moment — you will not be charged twice.' });
      }
      setQuote(null);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'CREDIT_REQUIRED') setAiProblem({ kind: 'credit', text: error.message });
      else if (error instanceof ApiError && error.status === 503) setAiProblem({ kind: 'other', text: 'Pictures are not available right now.' });
      else setAiProblem({ kind: 'other', text: describeError(error, 'The picture could not be made. You were not charged.') });
    } finally { setBusy(null); }
  };

  // ── Make reel ──
  // The card becomes a reel for everyone, and the reader becomes an approved creator on the spot (no review).
  const [music, setMusic] = useState<File | null>(null);
  const [reelDone, setReelDone] = useState(false);
  const musicInput = useRef<HTMLInputElement>(null);
  const pickMusic = (file: File | undefined) => {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) { toast('That music file is too large (up to 25 MB)'); return; }
    if (!/\.(mp3|m4a|mp4|aac|wav)$/i.test(file.name)) { toast('Please choose an MP3, M4A, AAC or WAV file'); return; }
    setMusic(file);
  };
  const audioType = (file: File) => /\.(m4a|mp4)$/i.test(file.name) ? 'audio/mp4' : /\.aac$/i.test(file.name) ? 'audio/aac' : /\.wav$/i.test(file.name) ? 'audio/wav' : 'audio/mpeg';
  const postReel = async () => {
    if (!requireSignIn('Sign in to make a reel')) return;
    setBusy('reel');
    try {
      const blob = await exportBlob();
      if (!blob) { toast('The picture could not be made'); return; }
      const up = (kind: 'image' | 'audio', body: Blob) => api<{ key: string }>('/reels/media', { method: 'POST', auth: 'required', query: { kind }, body });
      const image = await up('image', blob);
      const audio = music ? await up('audio', new Blob([music], { type: audioType(music) })) : null;
      await api('/reels/make', { method: 'POST', auth: 'required', body: {
        imageKey: image.key, ...(audio ? { audioKey: audio.key } : {}), caption: target.title, ...(target.type === 'MANTRA' ? { mantraSlug: target.id } : {}),
      } });
      setReelDone(true);
      toast('Your reel is live');
    } catch (error) {
      toast(describeError(error, 'The reel could not be posted. Please try again.'));
    } finally { setBusy(null); }
  };

  // ── Sharing ──
  const exportBlob = async (): Promise<Blob | null> => {
    if (!logo.current) return null;
    const { canvas: out } = renderCard(spec, logo.current, RATIOS[spec.ratio].w * 2);
    return canvasToBlob(out);
  };
  const filename = `hariharibol-${target.id.replace(/[^a-z0-9.-]/gi, '-')}.png`;
  const url = link?.url ?? '';
  const message = `${plainText(target)}${url ? `\n\n${url}` : ''}`;

  const run = async (name: string, fn: () => Promise<void>) => {
    setBusy(name);
    try { await fn(); } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) toast('That did not work. Please try again.');
    } finally { setBusy(null); }
  };
  const shareImage = () => run('image', async () => {
    const blob = await exportBlob();
    if (!blob) { toast('The picture could not be made'); return; }
    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text: message, title: target.title }); return; }
    download(blob);
    toast('Saved to your device — your browser cannot share pictures directly');
  });
  const download = (blob: Blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };
  const save = () => run('save', async () => { const blob = await exportBlob(); if (blob) { download(blob); toast('Saved'); } else toast('The picture could not be made'); });
  const copy = (text: string, done: string) => copyText(text).then((ok) => toast(ok ? done : 'Could not copy'));
  const shareText = () => run('text', async () => {
    if (navigator.share) await navigator.share({ title: target.title, text: plainText(target), url });
    else await copy(message, 'Copied');
  });
  const shareLinkOnly = () => run('link', async () => {
    if (navigator.share) await navigator.share({ title: target.title, url });
    else await copy(url, 'Link copied');
  });

  const t = spec.text;
  const showSignInNote = status !== 'in';

  return (
    <Sheet title="Share studio" onClose={onClose} wide className="studio-sheet">
      <div className="studio">
        <div className="studio-stage">
          <div className="studio-canvas-wrap" style={{ aspectRatio: `${RATIOS[spec.ratio].w} / ${RATIOS[spec.ratio].h}` }}>
            {!ready && <div className="skeleton studio-skel" aria-hidden />}
            <canvas
              ref={canvas}
              className="studio-canvas"
              tabIndex={0}
              role="img"
              aria-label="Preview of your share card. Drag the text, or use the arrow keys, to move it."
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={() => { drag.current = null; }}
              onPointerCancel={() => { drag.current = null; }}
              onKeyDown={onKey}
            />
          </div>
          <div className="studio-bar">
            <div className="segmented" role="group" aria-label="Card shape">
              {(Object.keys(RATIOS) as RatioKey[]).map((key) => (
                <button key={key} aria-pressed={spec.ratio === key} onClick={() => setSpec((s) => ({ ...s, ratio: key }))} title={RATIOS[key].hint}>{RATIOS[key].label}</button>
              ))}
            </div>
            <button className="btn btn-quiet btn-sm" onClick={undo} disabled={!history.current.length}>Undo</button>
            <button className="btn btn-quiet btn-sm" onClick={reset}>Reset</button>
          </div>
        </div>

        <div className="studio-panel">
          <div className="chip-row" role="tablist" aria-label="Studio tools">
            {TABS.map((item) => (
              <button key={item.id} role="tab" aria-selected={tab === item.id} className="chip" onClick={() => setTab(item.id)}>{item.id === 'reel' && <Icon name="feather" size={14} />} {item.label}</button>
            ))}
          </div>

          {tab === 'look' && (
            <div className="studio-section">
              {(['Devotional', 'Light', 'Dark', 'Festive'] as const).map((group) => (
                <div key={group}>
                  <p className="field-label">{group}</p>
                  <div className="swatches">
                    {THEMES.filter((x) => x.group === group).map((x) => (
                      <button key={x.id} className="swatch" title={x.name} aria-label={x.name} onClick={() => theme(x.id)}
                        style={{ background: x.colors.length > 1 ? `linear-gradient(${x.angle}deg, ${x.colors.join(',')})` : x.colors[0] }} />
                    ))}
                  </div>
                </div>
              ))}

              <p className="field-label">Your own colours</p>
              <div className="studio-row">
                {[0, 1, 2].map((i) => (
                  <input key={i} type="color" aria-label={`Colour ${i + 1}`} value={spec.background.colors[i] ?? spec.background.colors[spec.background.colors.length - 1] ?? '#ffffff'}
                    disabled={i > 0 && spec.background.kind === 'solid'}
                    onChange={(e) => { const colors = [...(spec.background.colors.length ? spec.background.colors : ['#ffffff'])]; while (colors.length <= i) colors.push(colors[colors.length - 1]); colors[i] = e.target.value; patchBg({ kind: colors.length > 1 && spec.background.kind !== 'solid' ? 'gradient' : spec.background.kind === 'image' ? 'image' : 'gradient', colors }); }} />
                ))}
                <button className="chip" onClick={() => patchBg({ kind: 'solid', colors: [spec.background.colors[0] ?? '#ffffff'] })}>Solid</button>
              </div>
              <label className="studio-slider">Direction <input type="range" min={0} max={360} value={spec.background.angle} onChange={(e) => patchBg({ angle: Number(e.target.value) })} /></label>

              <p className="field-label">Pattern</p>
              <div className="chip-row">
                {(['none', 'dots', 'rays', 'rings'] as PatternKey[]).map((p) => <button key={p} className="chip" aria-pressed={spec.background.pattern === p} onClick={() => patchBg({ pattern: p })}>{p === 'none' ? 'None' : p[0].toUpperCase() + p.slice(1)}</button>)}
              </div>

              <p className="field-label">Picture</p>
              <div className="studio-row">
                <button className="btn btn-ghost btn-sm" onClick={() => fileInput.current?.click()}><Icon name="image" size={16} /> Choose a picture</button>
                {PHOTO_PRESETS.map((p) => <button key={p.id} className="chip" onClick={() => usePhoto(p.src)}>{p.name}</button>)}
                <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ''; }} />
              </div>
              {spec.background.kind === 'image' && (
                <>
                  <label className="studio-slider">Zoom <input type="range" min={1} max={3} step={0.01} value={spec.background.zoom} onChange={(e) => patchBg({ zoom: Number(e.target.value) })} /></label>
                  <label className="studio-slider">Left–right <input type="range" min={-1} max={1} step={0.01} value={spec.background.panX} onChange={(e) => patchBg({ panX: Number(e.target.value) })} /></label>
                  <label className="studio-slider">Up–down <input type="range" min={-1} max={1} step={0.01} value={spec.background.panY} onChange={(e) => patchBg({ panY: Number(e.target.value) })} /></label>
                  <label className="studio-slider">Blur <input type="range" min={0} max={40} value={spec.background.blur} onChange={(e) => patchBg({ blur: Number(e.target.value) })} /></label>
                  <button className="btn btn-quiet btn-sm" onClick={() => theme(THEMES[0].id)}>Remove picture</button>
                </>
              )}
              <label className="studio-slider">Darken / lighten
                <input type="range" min={0} max={0.8} step={0.01} value={spec.background.overlay} onChange={(e) => patchBg({ overlay: Number(e.target.value) })} />
              </label>
              <div className="studio-row">
                <button className="chip" aria-pressed={spec.background.overlayColor === '#000000'} onClick={() => patchBg({ overlayColor: '#000000' })}>Dark wash</button>
                <button className="chip" aria-pressed={spec.background.overlayColor === '#ffffff'} onClick={() => patchBg({ overlayColor: '#ffffff' })}>Light wash</button>
              </div>
            </div>
          )}

          {tab === 'text' && (
            <div className="studio-section">
              {([
                ['sanskrit', 'Sanskrit', target.sanskrit], ['transliteration', 'Transliteration', target.transliteration], ['translation', 'Meaning', target.translation], ['reference', 'Reference', target.reference ?? target.title],
              ] as const).map(([key, label, source]) => source ? (
                <div key={key} className="studio-field">
                  <div className="studio-row between">
                    <label className="field-label" htmlFor={`txt-${key}`}>{label}</label>
                    <label className="studio-check"><input type="checkbox" checked={t.show[key]} onChange={(e) => patchText({ show: { ...t.show, [key]: e.target.checked } })} /> Show</label>
                  </div>
                  <textarea id={`txt-${key}`} className="input" rows={key === 'reference' ? 1 : 3} value={t[key]} onChange={(e) => patchText({ [key]: e.target.value })} />
                  {t[key] !== source && <button className="btn btn-quiet btn-sm" onClick={() => patchText({ [key]: source })}>Restore original</button>}
                </div>
              ) : null)}
              <p className="muted small">Editing here changes only this card, never the verse.</p>

              <p className="field-label">Font</p>
              <div className="chip-row">
                {(Object.keys(FONTS) as FontKey[]).map((f) => <button key={f} className="chip" aria-pressed={t.font === f} onClick={() => patchText({ font: f })}>{FONTS[f].label}</button>)}
              </div>
              <label className="studio-slider">Size <input type="range" min={0.5} max={1.8} step={0.02} value={t.size} onChange={(e) => patchText({ size: Number(e.target.value) })} /></label>
              <label className="studio-slider">Weight <input type="range" min={300} max={800} step={100} value={t.weight} onChange={(e) => patchText({ weight: Number(e.target.value) })} /></label>
              <label className="studio-slider">Line height <input type="range" min={1} max={2} step={0.05} value={t.lineHeight} onChange={(e) => patchText({ lineHeight: Number(e.target.value) })} /></label>
              <div className="studio-row">
                <button className="chip" aria-pressed={t.italic} onClick={() => patchText({ italic: !t.italic })}><em>Italic</em></button>
                <div className="segmented" role="group" aria-label="Alignment">
                  {(['left', 'center', 'right'] as const).map((a) => <button key={a} aria-pressed={t.align === a} onClick={() => patchText({ align: a })}>{a[0].toUpperCase() + a.slice(1)}</button>)}
                </div>
              </div>
              <div className="studio-row">
                <label className="studio-check">Colour <input type="color" value={t.color} onChange={(e) => patchText({ color: e.target.value })} /></label>
                <label className="studio-slider grow">Opacity <input type="range" min={0.3} max={1} step={0.01} value={t.opacity} onChange={(e) => patchText({ opacity: Number(e.target.value) })} /></label>
              </div>
              <label className="studio-slider">Soft plate behind the text <input type="range" min={0} max={0.8} step={0.01} value={t.plate} onChange={(e) => patchText({ plate: Number(e.target.value) })} /></label>
              <div className="studio-row">
                <button className="chip" aria-pressed={t.plateColor === '#000000'} onClick={() => patchText({ plateColor: '#000000' })}>Dark plate</button>
                <button className="chip" aria-pressed={t.plateColor === '#ffffff'} onClick={() => patchText({ plateColor: '#ffffff' })}>Light plate</button>
              </div>
            </div>
          )}

          {tab === 'layout' && (
            <div className="studio-section">
              <p className="muted small">Drag the text on the card, or use the arrow keys while the card is focused.</p>
              <label className="studio-slider">Up–down <input type="range" min={0} max={1} step={0.005} value={t.y} onChange={(e) => patchText({ y: Number(e.target.value) })} /></label>
              <label className="studio-slider">Left–right <input type="range" min={0} max={1} step={0.005} value={t.x} onChange={(e) => patchText({ x: Number(e.target.value) })} /></label>
              <label className="studio-slider">Text width <input type="range" min={0.4} max={1} step={0.01} value={t.width} onChange={(e) => patchText({ width: Number(e.target.value) })} /></label>
              <label className="studio-slider">Margins <input type="range" min={0.04} max={0.14} step={0.005} value={t.padding} onChange={(e) => patchText({ padding: Number(e.target.value) })} /></label>
              <div className="studio-row">
                <button className="btn btn-ghost btn-sm" onClick={() => patchText({ x: 0.5, y: 0.5 })}>Centre the text</button>
                <label className="studio-check"><input type="checkbox" checked={Boolean(spec.footer)} onChange={(e) => setSpec((s) => ({ ...s, footer: e.target.checked ? 'hariharibol.com' : '' }))} /> Show hariharibol.com</label>
              </div>
              <p className="muted small">The HariHariBol logo is always placed top left.</p>
            </div>
          )}

          {tab === 'ai' && (
            <div className="studio-section">
              {status !== 'in' ? (
                <div className="studio-note">
                  <p>Pictures are made from your Ask Sakha credit, so you need to be signed in.</p>
                  <button className="btn btn-primary btn-sm" onClick={() => requireSignIn('Sign in to make a picture with your Ask Sakha credit')}>Sign in</button>
                </div>
              ) : (
                <>
                  <label className="field-label" htmlFor="ai-prompt">Describe the background</label>
                  <textarea id="ai-prompt" className="input" rows={3} maxLength={500} value={prompt} placeholder="A peaceful golden sunrise behind an ancient temple…" onChange={(e) => setPrompt(e.target.value)} />
                  <div className="chip-row">
                    {(quote?.suggestions ?? []).map((s) => <button key={s} className="chip" onClick={() => setPrompt(s)}>{s.split(',')[0]}</button>)}
                  </div>
                  <p className="muted small">
                    A picture uses {quote?.costPercent ? `about ${quote.costPercent}% of` : 'some of'} your Ask Sakha credit. If it cannot be made, nothing is taken. No words are drawn in the picture — your verse is added on top.
                  </p>
                  {quote && !quote.affordable && !aiProblem && (
                    <div className="studio-note">
                      <p>{quote.enabled ? 'There is not enough credit left for a picture right now.' : 'Your plan does not include pictures yet.'}</p>
                      {quote.canUpgrade && <Link className="btn btn-primary btn-sm" href="/plans">See plans</Link>}
                    </div>
                  )}
                  {aiProblem && (
                    <div className="studio-note" role="alert">
                      <p>{aiProblem.kind === 'credit' ? 'You do not have enough Ask Sakha credit for a picture. Nothing was taken.' : aiProblem.text}</p>
                      {aiProblem.kind === 'credit' && <Link className="btn btn-primary btn-sm" href="/plans">See plans</Link>}
                    </div>
                  )}
                  <button className="btn btn-primary" disabled={busy === 'ai' || prompt.trim().length < 8 || (quote ? !quote.affordable : false)} onClick={generate}>
                    {busy === 'ai' ? 'Making your picture… this can take a minute' : job ? 'Make another' : 'Make the picture'}
                  </button>
                  {job?.image && (
                    <div className="studio-result">
                      <p className="field-label">Your picture</p>
                      <PreviewBitmap bitmap={job.image} />
                      <button className="btn btn-primary btn-sm" onClick={() => { applyImage(job.image!, job.image!.width, job.image!.height); setTab('look'); }}>Use as background</button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {tab === 'reel' && (
            <div className="studio-section">
              {status !== 'in' ? (
                <div className="studio-note">
                  <p>Sign in to turn your card into a reel.</p>
                  <button className="btn btn-primary btn-sm" onClick={() => requireSignIn('Sign in to make a reel')}>Sign in</button>
                </div>
              ) : reelDone ? (
                <div className="studio-note">
                  <p>Your reel is live for everyone.</p>
                  <Link className="btn btn-primary btn-sm" href="/reels" onClick={onClose}>Open Reels</Link>
                </div>
              ) : (
                <>
                  <p className="muted small">Your card becomes a reel that everyone in Reels can watch — in the app and on the website.</p>
                  <input ref={musicInput} type="file" accept=".mp3,.m4a,.mp4,.aac,.wav,audio/*" hidden onChange={(e) => { pickMusic(e.target.files?.[0]); e.target.value = ''; }} />
                  <div className="studio-row">
                    <button className="btn btn-ghost" disabled={busy !== null} onClick={() => musicInput.current?.click()}>{music ? 'Choose other music' : 'Add music from your device'}</button>
                    {music && <button className="btn btn-quiet btn-sm" disabled={busy !== null} onClick={() => setMusic(null)}>Remove music</button>}
                  </div>
                  {music && <p className="muted small">Music: {music.name}</p>}
                  <button className="btn btn-primary" disabled={!ready || busy !== null} onClick={postReel}>
                    <Icon name="feather" size={16} /> {busy === 'reel' ? 'Posting your reel…' : 'Post reel'}
                  </button>
                </>
              )}
            </div>
          )}

          {tab === 'share' && (
            <div className="studio-section">
              <div className="studio-actions">
                <button className="btn btn-primary" disabled={!ready || busy !== null} onClick={shareImage}><Icon name="share" size={16} /> Share picture</button>
                <button className="btn btn-ghost" disabled={!ready || busy !== null} onClick={save}>Save picture</button>
                <button className="btn btn-ghost" onClick={() => copy(plainText(target), 'Verse copied')}><Icon name="copy" size={16} /> Copy text</button>
                <button className="btn btn-ghost" disabled={busy !== null} onClick={shareText}>Share as text</button>
                <button className="btn btn-ghost" disabled={!url || busy !== null} onClick={shareLinkOnly}>Share link only</button>
                <button className="btn btn-ghost" disabled={!url} onClick={() => copy(url, 'Link copied')}>Copy link</button>
              </div>
              {url ? (
                <p className="muted small studio-url">{url}</p>
              ) : <p className="muted small">Making your link…</p>}
              <div className="studio-actions">
                {url && <a className="btn btn-quiet btn-sm" href={url} target="_blank" rel="noopener">Open the public page</a>}
                <Link className="btn btn-quiet btn-sm" href={target.path} onClick={onClose}>Continue reading</Link>
              </div>
              {showSignInNote && <p className="muted small">Sign in and your link is personal to you, and counts when friends open it.</p>}
              <p className="muted small">Sharing hands your picture and link to the app you choose. We cannot tell whether it was posted.</p>
            </div>
          )}
        </div>
      </div>
    </Sheet>
  );
}

function PreviewBitmap({ bitmap }: { bitmap: ImageBitmap }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const scale = 240 / bitmap.width;
    c.width = 240; c.height = Math.round(bitmap.height * scale);
    c.getContext('2d')?.drawImage(bitmap, 0, 0, c.width, c.height);
  }, [bitmap]);
  return <canvas ref={ref} className={clsx('studio-thumb')} aria-label="The picture that was made" role="img" />;
}
