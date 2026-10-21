// Draws a Design on a canvas. The preview and the export call this same function with the same canvas size, so they
// cannot differ. Pure of React and of the DOM except for the canvas it is given and the images it is handed.

import { FONTS, FORMATS, type Design } from './design';

export interface Assets {
  logo: HTMLImageElement | null;
  mandala: HTMLImageElement | null;
  photo: HTMLImageElement | null;
}

export interface Layout {
  /** The text block's rectangle, for dragging. */
  block: { x: number; y: number; w: number; h: number };
  /** The font scale actually used after fitting (1 = as chosen). Below 1 means the verse was long and was shrunk to fit. */
  fit: number;
}

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

function gradientBox(ctx: CanvasRenderingContext2D, w: number, h: number, angle: number, colors: string[]) {
  const rad = ((angle - 90) * Math.PI) / 180;
  const cx = w / 2;
  const cy = h / 2;
  const len = Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad));
  const g = ctx.createLinearGradient(cx - (Math.cos(rad) * len) / 2, cy - (Math.sin(rad) * len) / 2, cx + (Math.cos(rad) * len) / 2, cy + (Math.sin(rad) * len) / 2);
  colors.forEach((c, i) => g.addColorStop(colors.length === 1 ? 0 : i / (colors.length - 1), c));
  return g;
}

function drawScene(ctx: CanvasRenderingContext2D, w: number, h: number, scene: Design['bg']['scene'], colors: string[]) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, colors[0]);
  sky.addColorStop(0.62, colors[1]);
  sky.addColorStop(1, colors[2]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  const glow = ctx.createRadialGradient(w / 2, h * 0.74, 0, w / 2, h * 0.74, w * 0.55);
  glow.addColorStop(0, 'rgba(255,236,170,.9)');
  glow.addColorStop(0.35, 'rgba(255,200,110,.35)');
  glow.addColorStop(1, 'rgba(255,200,110,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(14,10,24,.92)';
  if (scene === 'temple') {
    // A shikhara silhouette on the horizon.
    const base = h * 0.86;
    const cx = w / 2;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.2, base);
    for (let i = 0; i <= 8; i += 1) {
      const t = i / 8;
      ctx.lineTo(cx - w * 0.16 * (1 - t) - (i % 2 ? w * 0.012 : 0), base - h * 0.2 * t);
    }
    ctx.lineTo(cx, base - h * 0.27);
    for (let i = 8; i >= 0; i -= 1) {
      const t = i / 8;
      ctx.lineTo(cx + w * 0.16 * (1 - t) + (i % 2 ? w * 0.012 : 0), base - h * 0.2 * t);
    }
    ctx.lineTo(cx + w * 0.2, base);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(0, base, w, h - base);
  } else if (scene === 'lotus') {
    ctx.fillStyle = 'rgba(14,47,77,.55)';
    ctx.fillRect(0, h * 0.8, w, h * 0.2);
  } else {
    ctx.fillRect(0, h * 0.9, w, h * 0.1);
  }
}

/** Blur that works in every browser (Safari has no ctx.filter): draw small, draw back large. */
function drawBlurred(ctx: CanvasRenderingContext2D, img: CanvasImageSource, sx: number, sy: number, sw: number, sh: number, w: number, h: number, blur: number) {
  if (blur <= 0) { ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h); return; }
  const k = 1 + blur / 3;
  const small = document.createElement('canvas');
  small.width = Math.max(8, Math.round(w / k));
  small.height = Math.max(8, Math.round(h / k));
  const sctx = small.getContext('2d')!;
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(img, sx, sy, sw, sh, 0, 0, small.width, small.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(small, 0, 0, small.width, small.height, 0, 0, w, h);
}

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, d: Design['bg'], a: Assets) {
  if (d.kind === 'image' && a.photo) {
    const img = a.photo;
    const cover = Math.max(w / img.width, h / img.height) * d.image.zoom;
    const vw = w / cover;
    const vh = h / cover;
    const sx = (img.width - vw) / 2 + (d.image.x * (img.width - vw)) / 2;
    const sy = (img.height - vh) / 2 + (d.image.y * (img.height - vh)) / 2;
    drawBlurred(ctx, img, Math.max(0, Math.min(img.width - vw, sx)), Math.max(0, Math.min(img.height - vh, sy)), vw, vh, w, h, d.blur * (w / 1080));
  } else if (d.kind === 'solid') {
    ctx.fillStyle = d.colors[0] ?? '#fbf6ee';
    ctx.fillRect(0, 0, w, h);
  } else if (d.scene !== 'none') {
    drawScene(ctx, w, h, d.scene, d.colors);
  } else {
    ctx.fillStyle = gradientBox(ctx, w, h, d.angle, d.colors.length ? d.colors : ['#fbf6ee']);
    ctx.fillRect(0, 0, w, h);
  }

  if (d.pattern === 'dots') {
    ctx.fillStyle = 'rgba(255,255,255,.08)';
    const step = w / 30;
    for (let y = step / 2; y < h; y += step) for (let x = step / 2; x < w; x += step) { ctx.beginPath(); ctx.arc(x, y, step * 0.09, 0, 7); ctx.fill(); }
  } else if (d.pattern === 'mandala' && a.mandala) {
    ctx.globalAlpha = 0.12;
    const s = Math.max(w, h) * 1.1;
    ctx.drawImage(a.mandala, (w - s) / 2, (h - s) / 2, s, s);
    ctx.globalAlpha = 1;
  }
  if (d.overlay > 0) {
    ctx.fillStyle = `rgba(0,0,0,${d.overlay})`;
    ctx.fillRect(0, 0, w, h);
  }
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    if (!para.trim()) { lines.push(''); continue; }
    let line = '';
    for (const word of para.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width <= maxW || !line) line = next;
      else { lines.push(line); line = word; }
    }
    lines.push(line);
  }
  return lines;
}

interface Part { lines: string[]; font: string; lh: number; color: string; gapBefore: number }

function buildParts(ctx: CanvasRenderingContext2D, t: Design['text'], scale: number, maxW: number): { parts: Part[]; height: number } {
  const family = FONTS[t.font].css;
  const style = t.italic ? 'italic ' : '';
  const mk = (text: string, size: number, weight: number, italic: boolean, fam: string, gap: number, alpha = 1): Part => {
    const font = `${italic ? 'italic ' : style}${weight} ${Math.round(size * scale)}px ${fam}`;
    ctx.font = font;
    return { lines: wrap(ctx, text, maxW), font, lh: size * scale * t.lineHeight, color: rgba(t.color, t.opacity * alpha), gapBefore: gap * scale };
  };
  const parts: Part[] = [];
  if (t.main.trim()) parts.push(mk(t.main, t.size, t.weight, false, family, 0));
  if (t.showTranslit && t.translit.trim()) parts.push(mk(t.translit, t.size * 0.5, 400, true, FONTS.serif.css, t.size * 0.45, 0.85));
  if (t.showMeaning && t.meaning.trim()) parts.push(mk(t.meaning, t.size * 0.5, 400, false, FONTS.sans.css, t.size * 0.55, 0.95));
  if (t.showRef && t.ref.trim()) parts.push(mk(`— ${t.ref}`, t.size * 0.4, 600, false, FONTS.sans.css, t.size * 0.5, 0.8));
  const height = parts.reduce((sum, p, i) => sum + (i ? p.gapBefore : 0) + p.lines.length * p.lh, 0);
  return { parts, height };
}

/** Draws the whole card. Returns where the text block landed (for dragging) and how much it was shrunk to fit. */
export function renderCard(canvas: HTMLCanvasElement, design: Design, assets: Assets): Layout {
  const { w, h } = FORMATS[design.format];
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const u = w / 1080; // sizes in the design are "at 1080 wide"
  ctx.clearRect(0, 0, w, h);
  drawBackground(ctx, w, h, design.bg, assets);

  // Logo: always top-left, aspect kept, never covered by text (the text area starts below it).
  const pad = design.text.padding * u;
  let logoBottom = pad * 0.6;
  if (assets.logo) {
    const lh = Math.min(w, h) * 0.12;
    const lw = lh * (assets.logo.width / assets.logo.height);
    ctx.drawImage(assets.logo, pad * 0.6, pad * 0.6, lw, lh);
    logoBottom = pad * 0.6 + lh;
  }

  const t = { ...design.text, size: design.text.size * u };
  const maxW = w - pad * 2;
  const top = logoBottom + pad * 0.3;
  const free = h - top - pad;
  ctx.textBaseline = 'top';

  // Fit: shrink the whole block until it sits inside the free area. A verse is never cut — it gets smaller.
  let scale = 1;
  let built = buildParts(ctx, t, scale, maxW - 2 * 0);
  for (let i = 0; i < 24 && built.height > free && scale > 0.25; i += 1) {
    scale *= 0.92;
    built = buildParts(ctx, t, scale, maxW);
  }
  const blockH = built.height;
  const y0 = top + Math.max(0, free - blockH) * design.text.y;
  const dx = design.text.x * w;

  if (design.text.shade > 0) {
    const p = 28 * u;
    ctx.fillStyle = `rgba(0,0,0,${design.text.shade})`;
    ctx.beginPath();
    ctx.roundRect(pad - p + dx, y0 - p, maxW + 2 * p, blockH + 2 * p, 28 * u);
    ctx.fill();
  }

  let y = y0;
  built.parts.forEach((p, i) => {
    if (i) y += p.gapBefore;
    ctx.font = p.font;
    ctx.fillStyle = p.color;
    ctx.textAlign = design.text.align;
    const x = (design.text.align === 'left' ? pad : design.text.align === 'right' ? w - pad : w / 2) + dx;
    for (const line of p.lines) { ctx.fillText(line, x, y); y += p.lh; }
  });

  return { block: { x: pad + dx, y: y0, w: maxW, h: blockH }, fit: scale };
}

export async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image failed to load'));
    img.src = src;
  });
}

/** Makes sure the fonts the card uses are loaded (and the glyphs for this text exist) before drawing or exporting. */
export async function ready(design: Design): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  const sample = `${design.text.main}${design.text.meaning}`.slice(0, 200) || 'Aa';
  const f = FONTS[design.text.font].css;
  await Promise.all([
    document.fonts.load(`${design.text.weight} 40px ${f}`, sample),
    document.fonts.load('400 24px "Inter"', sample),
    document.fonts.load('italic 400 24px "Fraunces"', sample),
  ]).catch(() => undefined);
}
