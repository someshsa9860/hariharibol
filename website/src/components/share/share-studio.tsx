'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { Icon } from '@/components/ui/icon';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth/auth-provider';
import { api, describeError, rawRequest } from '@/lib/api/client';
import { ApiError } from '@/lib/api/core';
import { copyText } from '@/lib/share';
import {
  AI_PROMPTS, FONTS, FORMATS, GRADIENTS, SCENES, SOLIDS, defaultDesign,
  type Design, type FontKey, type FormatKey, type StudioContent,
} from '@/lib/studio/design';
import { loadImage, ready, renderCard, type Assets, type Layout } from '@/lib/studio/render';

interface LinkInfo { code: string; url: string; appUri: string }
interface Quote { available: boolean; canAfford: boolean; backgroundsLeft?: number }
interface Background { id: string; status: string }

const MAX_UPLOAD = 8 * 1024 * 1024;
const MAX_EDGE = 6000;
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

/** Checks the file's real bytes (not its name or declared type) before it is used as a background. */
async function sniffImage(file: File): Promise<string | null> {
  if (file.size > MAX_UPLOAD) return 'That picture is larger than 8 MB.';
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const jpeg = head[0] === 0xff && head[1] === 0xd8;
  const png = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
  const webp = head[0] === 0x52 && head[1] === 0x49 && head[8] === 0x57 && head[9] === 0x45;
  return jpeg || png || webp ? null : 'Please choose a JPEG, PNG or WebP picture.';
}

export function ShareStudio({ content, onClose, onShared }: { content: StudioContent; onClose: () => void; onShared?: (how: 'IMAGE' | 'LINK' | 'TEXT') => void }) {
  const toast = useToast();
  const { status, openSignIn } = useAuth();
  const initial = useMemo(() => defaultDesign(content), [content]);
  const [design, setDesign] = useState<Design>(initial);
  const history = useRef<Design[]>([]);
  const lastPush = useRef(0);
  const canvas = useRef<HTMLCanvasElement>(null);
  const assets = useRef<Assets>({ logo: null, mandala: null, photo: null });
  const layout = useRef<Layout | null>(null);
  const [assetsReady, setAssetsReady] = useState(0);
  const [fit, setFit] = useState(1);
  const [tab, setTab] = useState<'colors' | 'gradients' | 'scenes' | 'image' | 'ai'>('gradients');
  const [link, setLink] = useState<LinkInfo | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  // Every change goes through here so Undo works; rapid changes (a slider drag) collapse into one step.
  const update = useCallback((next: (d: Design) => Design) => {
    setDesign((current) => {
      const now = Date.now();
      if (now - lastPush.current > 600) { history.current.push(current); if (history.current.length > 60) history.current.shift(); }
      lastPush.current = now;
      return next(current);
    });
  }, []);
  const undo = () => { const prev = history.current.pop(); if (prev) setDesign(prev); };
  const reset = () => { history.current.push(design); setDesign(initial); };

  useEffect(() => {
    Promise.all([loadImage('/img/logo-transparent.png'), loadImage('/img/mandala.svg').catch(() => null)])
      .then(([logo, mandala]) => { assets.current.logo = logo; assets.current.mandala = mandala; setAssetsReady((n) => n + 1); })
      .catch(() => toast('The logo could not be loaded — cards cannot be saved until it is'));
  }, [toast]);

  useEffect(() => {
    let cancelled = false;
    ready(design).then(() => {
      if (cancelled || !canvas.current) return;
      layout.current = renderCard(canvas.current, design, assets.current);
      setFit(layout.current.fit);
    });
    return () => { cancelled = true; };
  }, [design, assetsReady]);

  // ── Dragging the text on the card ──
  const drag = useRef<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, dx: design.text.x, dy: design.text.y };
    history.current.push(design);
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drag.current || !canvas.current) return;
    const rect = canvas.current.getBoundingClientRect();
    const f = FORMATS[design.format];
    const dxFrac = (e.clientX - drag.current.x) / rect.width;
    const free = 1 - 0.3; // roughly the free vertical share; exact enough for a drag
    const dyFrac = (e.clientY - drag.current.y) / (rect.height * free);
    setDesign((d) => ({ ...d, text: { ...d.text, x: Math.max(-0.3, Math.min(0.3, drag.current!.dx + dxFrac)), y: Math.max(0, Math.min(1, drag.current!.dy + dyFrac)) } }));
    void f;
  };
  const onUp = () => { drag.current = null; };

  // ── Image ──
  const setPhoto = async (src: string) => {
    const img = await loadImage(src);
    if (img.width > MAX_EDGE || img.height > MAX_EDGE) throw new Error('That picture is too large — please choose one under 6000 pixels a side.');
    if (img.width < 400 || img.height < 400) throw new Error('That picture is too small to use as a background.');
    assets.current.photo = img;
    update((d) => ({ ...d, bg: { ...d.bg, kind: 'image', image: { src, zoom: 1, x: 0, y: 0 }, overlay: Math.max(d.bg.overlay, 0.25) } }));
    setAssetsReady((n) => n + 1);
  };
  const onFile = async (file: File | undefined) => {
    setFileError(null);
    if (!file) return;
    const bad = await sniffImage(file);
    if (bad) { setFileError(bad); return; }
    const url = URL.createObjectURL(file);
    try { await setPhoto(url); } catch (error) { URL.revokeObjectURL(url); setFileError(error instanceof Error ? error.message : 'That picture could not be used.'); }
  };

  // ── AI background ──
  const [quote, setQuote] = useState<Quote | null>(null);
  const [prompt, setPrompt] = useState(AI_PROMPTS[0]);
  const [aiState, setAiState] = useState<'idle' | 'working' | 'error' | 'nocredit'>('idle');
  const [aiMessage, setAiMessage] = useState('');
  const requestId = useRef(uid());
  useEffect(() => {
    if (tab !== 'ai' || status !== 'in') return;
    api<Quote>('/share/background/quote', { auth: 'required' }).then(setQuote).catch(() => setQuote({ available: false, canAfford: false }));
  }, [tab, status]);
  const generate = async () => {
    if (status !== 'in') { openSignIn('Sign in to make a background'); return; }
    setAiState('working'); setAiMessage('');
    try {
      const made = await api<Background>('/share/background', { method: 'POST', auth: 'required', body: { requestId: requestId.current, prompt } });
      const response = await rawRequest(`/share/background/${made.id}/image`, { auth: 'required' });
      if (!response.ok) throw new Error('The picture could not be loaded');
      await setPhoto(URL.createObjectURL(await response.blob()));
      requestId.current = uid(); // a new picture is a new request; a retry of a failure reuses the id so it is never charged twice
      setAiState('idle');
      toast('Background added');
      api<Quote>('/share/background/quote', { auth: 'required' }).then(setQuote).catch(() => undefined);
    } catch (error) {
      if (error instanceof ApiError && error.status === 402) { setAiState('nocredit'); return; }
      setAiState('error');
      setAiMessage(describeError(error, 'The background could not be made. You have not been charged — try again.'));
    }
  };

  // ── Sharing ──
  const ensureLink = async (): Promise<LinkInfo | null> => {
    if (link) return link;
    if (status !== 'in') { openSignIn('Sign in to get a link to share'); return null; }
    try {
      const made = await api<LinkInfo>('/share/links', { method: 'POST', auth: 'required', body: { kind: content.kind, targetId: content.targetId } });
      setLink(made);
      return made;
    } catch (error) {
      toast(describeError(error, 'Could not make a link for this'));
      return null;
    }
  };
  const textOf = (url?: string) => [design.text.main, design.text.showMeaning ? design.text.meaning : '', design.text.showRef ? `— ${design.text.ref}` : '', url].filter(Boolean).join('\n\n');
  const toBlob = (): Promise<Blob> => new Promise(async (resolve, reject) => {
    await ready(design);
    const off = document.createElement('canvas');
    if (!assets.current.logo) { reject(new Error('logo')); return; }
    renderCard(off, design, assets.current);
    off.toBlob((b) => (b ? resolve(b) : reject(new Error('export'))), 'image/png');
  });
  const run = async (name: string, fn: () => Promise<void>) => {
    setBusy(name);
    try { await fn(); } catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) toast('That did not work — please try again'); } finally { setBusy(null); }
  };
  const download = () => run('download', async () => {
    const blob = await toBlob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hariharibol-${content.targetId.replace(/[^\w.-]+/g, '-')}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('Saved');
  });
  const shareImage = () => run('image', async () => {
    const info = await ensureLink();
    const blob = await toBlob();
    const file = new File([blob], 'hariharibol.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text: info ? `${design.text.ref}\n${info.url}` : design.text.ref });
      onShared?.('IMAGE');
    } else {
      // No file sharing here (most desktop browsers): save it and copy the link, and say so.
      await download();
      if (info) { await copyText(info.url); toast('Saved the picture and copied the link'); }
    }
  });
  const shareLinkOnly = () => run('link', async () => {
    const info = await ensureLink();
    if (!info) return;
    if (navigator.share) { await navigator.share({ title: design.text.ref, url: info.url }); onShared?.('LINK'); }
    else toast((await copyText(info.url)) ? 'Link copied' : 'Could not copy the link');
  });
  const shareText = () => run('text', async () => {
    const info = await ensureLink();
    const text = textOf(info?.url);
    if (navigator.share) { await navigator.share({ text }); onShared?.('TEXT'); }
    else toast((await copyText(text)) ? 'Copied' : 'Could not copy');
  });
  const copyVerse = () => run('copy', async () => { toast((await copyText(textOf())) ? 'Text copied' : 'Could not copy'); });
  const copyLink = () => run('copylink', async () => { const info = await ensureLink(); if (info) toast((await copyText(info.url)) ? 'Link copied' : 'Could not copy the link'); });

  const t = design.text;
  const setText = <K extends keyof Design['text']>(key: K, value: Design['text'][K]) => update((d) => ({ ...d, text: { ...d.text, [key]: value } }));
  const setBg = (patch: Partial<Design['bg']>) => update((d) => ({ ...d, bg: { ...d.bg, ...patch } }));

  return (
    <Sheet title="Share studio" onClose={onClose} wide>
      <div className="studio">
        <div className="studio-stage">
          <div className="studio-canvas-wrap">
            <canvas ref={canvas} className="studio-canvas" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
              role="img" aria-label="Preview of your card. Drag to move the text." />
          </div>
          <p className="studio-note">Drag the text to move it.{fit < 0.999 && ' Long text is made smaller so all of it fits.'}</p>
          <div className="studio-row">
            <button className="btn btn-ghost btn-sm" onClick={undo} disabled={!history.current.length}>Undo</button>
            <button className="btn btn-ghost btn-sm" onClick={reset}>Restore defaults</button>
          </div>
        </div>

        <div className="studio-panel">
          <fieldset>
            <legend>Size</legend>
            <div className="chip-row" role="group" aria-label="Card size">
              {(Object.keys(FORMATS) as FormatKey[]).map((k) => (
                <button key={k} className="chip" aria-pressed={design.format === k} onClick={() => update((d) => ({ ...d, format: k }))} title={FORMATS[k].hint}>{FORMATS[k].label}</button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Background</legend>
            <div className="chip-row" role="group" aria-label="Background type">
              {([['colors', 'Colours'], ['gradients', 'Gradients'], ['scenes', 'Scenes'], ['image', 'Picture'], ['ai', 'Make with AI']] as const).map(([k, label]) => (
                <button key={k} className="chip" aria-pressed={tab === k} onClick={() => setTab(k)}>{label}</button>
              ))}
            </div>
            {tab === 'colors' && (
              <div className="studio-swatches">
                {SOLIDS.map((c) => <button key={c} className="swatch" aria-label={`Colour ${c}`} aria-pressed={design.bg.kind === 'solid' && design.bg.colors[0] === c} style={{ background: c }} onClick={() => setBg({ kind: 'solid', colors: [c], scene: 'none' })} />)}
                <input type="color" aria-label="Custom colour" value={design.bg.colors[0]?.length === 7 ? design.bg.colors[0] : '#fbf6ee'} onChange={(e) => setBg({ kind: 'solid', colors: [e.target.value], scene: 'none' })} />
              </div>
            )}
            {tab === 'gradients' && (
              <>
                <div className="studio-swatches">
                  {GRADIENTS.map((g) => (
                    <button key={g.name} className="swatch" aria-label={g.name} title={g.name} aria-pressed={design.bg.kind === 'gradient' && design.bg.colors.join() === g.colors.join()}
                      style={{ background: `linear-gradient(${g.angle}deg, ${g.colors.join(',')})` }}
                      onClick={() => update((d) => ({ ...d, bg: { ...d.bg, kind: 'gradient', colors: g.colors, angle: g.angle, scene: 'none' }, text: { ...d.text, color: g.light ? '#2a2420' : '#ffffff' } }))} />
                  ))}
                </div>
                <div className="studio-row">
                  {design.bg.colors.map((c, i) => <input key={i} type="color" aria-label={`Gradient colour ${i + 1}`} value={c.length === 7 ? c : '#ffffff'} onChange={(e) => setBg({ kind: 'gradient', scene: 'none', colors: design.bg.colors.map((x, j) => (j === i ? e.target.value : x)) })} />)}
                  {design.bg.colors.length < 4 && <button className="btn btn-quiet btn-sm" onClick={() => setBg({ colors: [...design.bg.colors, '#ffffff'] })}>Add colour</button>}
                  {design.bg.colors.length > 2 && <button className="btn btn-quiet btn-sm" onClick={() => setBg({ colors: design.bg.colors.slice(0, -1) })}>Remove</button>}
                </div>
                <label className="studio-note">Direction {design.bg.angle}°<input type="range" min={0} max={360} value={design.bg.angle} onChange={(e) => setBg({ angle: +e.target.value })} /></label>
              </>
            )}
            {tab === 'scenes' && (
              <div className="studio-swatches">
                {SCENES.map((s) => <button key={s.key} className="swatch" aria-label={s.label} title={s.label} aria-pressed={design.bg.scene === s.key} style={{ background: `linear-gradient(180deg, ${s.colors.join(',')})` }} onClick={() => setBg({ kind: 'gradient', scene: s.key, colors: s.colors })} />)}
              </div>
            )}
            {tab === 'image' && (
              <>
                <input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose a picture" onChange={(e) => onFile(e.target.files?.[0])} />
                {fileError && <p className="studio-error" role="alert">{fileError}</p>}
                <p className="studio-note">Your picture stays on this device; it is only used to draw the card.</p>
              </>
            )}
            {tab === 'ai' && (
              <>
                {status !== 'in' ? (
                  <button className="btn btn-primary btn-sm" onClick={() => openSignIn('Sign in to make a background')}>Sign in to make one</button>
                ) : quote && !quote.available ? (
                  <p className="studio-note">Backgrounds are not available right now.</p>
                ) : (
                  <>
                    <div className="chip-row">{AI_PROMPTS.map((p) => <button key={p} className="chip" onClick={() => setPrompt(p)}>{p.split(',')[0].replace(/^A /, '')}</button>)}</div>
                    <textarea className="textarea" rows={3} maxLength={400} value={prompt} onChange={(e) => setPrompt(e.target.value)} aria-label="Describe the background" />
                    <p className="studio-note">
                      {quote?.canAfford ? `Uses part of your Ask Sakha credits — about ${quote.backgroundsLeft} left.` : quote ? 'Needs more credits than you have right now.' : ''}
                    </p>
                    {aiState === 'nocredit' && (
                      <p className="studio-error" role="alert">You do not have enough credits for a background. <Link href="/plans">See plans</Link> to add more.</p>
                    )}
                    {aiState === 'error' && <p className="studio-error" role="alert">{aiMessage}</p>}
                    <button className="btn btn-primary btn-sm" onClick={generate} disabled={aiState === 'working' || prompt.trim().length < 3 || (quote ? !quote.canAfford : false)}>
                      {aiState === 'working' ? 'Making your background…' : aiState === 'error' ? 'Try again' : 'Make background'}
                    </button>
                    {quote && !quote.canAfford && <Link className="btn btn-ghost btn-sm" href="/plans">Get more credits</Link>}
                  </>
                )}
              </>
            )}
            {design.bg.kind === 'image' && (
              <>
                <label className="studio-note">Zoom<input type="range" min={1} max={3} step={0.05} value={design.bg.image.zoom} onChange={(e) => update((d) => ({ ...d, bg: { ...d.bg, image: { ...d.bg.image, zoom: +e.target.value } } }))} /></label>
                <label className="studio-note">Left–right<input type="range" min={-1} max={1} step={0.05} value={design.bg.image.x} onChange={(e) => update((d) => ({ ...d, bg: { ...d.bg, image: { ...d.bg.image, x: +e.target.value } } }))} /></label>
                <label className="studio-note">Up–down<input type="range" min={-1} max={1} step={0.05} value={design.bg.image.y} onChange={(e) => update((d) => ({ ...d, bg: { ...d.bg, image: { ...d.bg.image, y: +e.target.value } } }))} /></label>
                <label className="studio-note">Blur<input type="range" min={0} max={40} value={design.bg.blur} onChange={(e) => setBg({ blur: +e.target.value })} /></label>
                <button className="btn btn-quiet btn-sm" onClick={() => { assets.current.photo = null; setBg({ kind: 'gradient' }); }}>Remove picture</button>
              </>
            )}
            <div className="studio-row">
              <label>Darken for readability<input type="range" min={0} max={0.85} step={0.01} value={design.bg.overlay} onChange={(e) => setBg({ overlay: +e.target.value })} /></label>
              <label>Pattern
                <select className="select" value={design.bg.pattern} onChange={(e) => setBg({ pattern: e.target.value as Design['bg']['pattern'] })}>
                  <option value="none">None</option><option value="dots">Dots</option><option value="mandala">Mandala</option>
                </select>
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Text</legend>
            <label className="studio-note">Verse<textarea className="textarea" rows={4} value={t.main} onChange={(e) => setText('main', e.target.value)} /></label>
            <div className="studio-row">
              <label><input type="checkbox" checked={t.showTranslit} disabled={!t.translit} onChange={(e) => setText('showTranslit', e.target.checked)} /> Transliteration</label>
              <label><input type="checkbox" checked={t.showMeaning} disabled={!t.meaning} onChange={(e) => setText('showMeaning', e.target.checked)} /> Meaning</label>
              <label><input type="checkbox" checked={t.showRef} onChange={(e) => setText('showRef', e.target.checked)} /> Reference</label>
            </div>
            {t.showMeaning && <label className="studio-note">Meaning<textarea className="textarea" rows={3} value={t.meaning} onChange={(e) => setText('meaning', e.target.value)} /></label>}
            <div className="studio-row">
              <label>Font<select className="select" value={t.font} onChange={(e) => setText('font', e.target.value as FontKey)}>{Object.entries(FONTS).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}</select></label>
              <label>Weight<select className="select" value={t.weight} onChange={(e) => setText('weight', +e.target.value as Design['text']['weight'])}><option value={400}>Regular</option><option value={500}>Medium</option><option value={600}>Semibold</option><option value={700}>Bold</option></select></label>
            </div>
            <div className="studio-row">
              <label>Size {t.size}<input type="range" min={28} max={120} value={t.size} onChange={(e) => setText('size', +e.target.value)} /></label>
              <label>Line height<input type="range" min={1} max={2} step={0.05} value={t.lineHeight} onChange={(e) => setText('lineHeight', +e.target.value)} /></label>
            </div>
            <div className="studio-row">
              <div className="chip-row" role="group" aria-label="Alignment">
                {(['left', 'center', 'right'] as const).map((a) => <button key={a} className="chip" aria-pressed={t.align === a} onClick={() => setText('align', a)}>{a[0].toUpperCase() + a.slice(1)}</button>)}
                <button className="chip" aria-pressed={t.italic} onClick={() => setText('italic', !t.italic)}><em>Italic</em></button>
              </div>
            </div>
            <div className="studio-row">
              <label>Colour<input type="color" value={t.color} onChange={(e) => setText('color', e.target.value)} /></label>
              <label>Opacity<input type="range" min={0.3} max={1} step={0.01} value={t.opacity} onChange={(e) => setText('opacity', +e.target.value)} /></label>
              <label>Text panel<input type="range" min={0} max={0.8} step={0.01} value={t.shade} onChange={(e) => setText('shade', +e.target.value)} /></label>
            </div>
            <div className="studio-row">
              <label>Margins<input type="range" min={40} max={160} value={t.padding} onChange={(e) => setText('padding', +e.target.value)} /></label>
              <button className="btn btn-quiet btn-sm" onClick={() => update((d) => ({ ...d, text: { ...d.text, x: 0, y: 0.5 } }))}>Centre text</button>
            </div>
          </fieldset>

          <fieldset>
            <legend>Share</legend>
            <div className="share-actions">
              <button className="btn btn-primary" onClick={shareImage} disabled={!!busy}><Icon name="share" size={18} /> Share picture</button>
              <button className="btn btn-ghost" onClick={download} disabled={!!busy}>Save image</button>
            </div>
            <div className="share-actions">
              <button className="btn btn-ghost btn-sm" onClick={shareLinkOnly} disabled={!!busy}>Share link</button>
              <button className="btn btn-ghost btn-sm" onClick={shareText} disabled={!!busy}>Share as text</button>
              <button className="btn btn-ghost btn-sm" onClick={copyVerse} disabled={!!busy}>Copy text</button>
              <button className="btn btn-ghost btn-sm" onClick={copyLink} disabled={!!busy}>Copy link</button>
              {link && <a className="btn btn-quiet btn-sm" href={link.url} target="_blank" rel="noopener">Open page</a>}
            </div>
            <p className={clsx('studio-note')}>The link opens this {content.kind === 'MANTRA' ? 'mantra' : content.kind === 'REEL' ? 'reel' : 'verse'} in the app, or on the web for anyone without it. We cannot tell whether a friend has received it.</p>
          </fieldset>
        </div>
      </div>
    </Sheet>
  );
}
