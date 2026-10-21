// Draws a share card on a canvas. The studio's live preview and the exported file are produced by this one
// function — the preview is the same drawing at a smaller width — so what a person sees is what they send.
//
// Everything is laid out in a fixed 'design' size per ratio (1080 wide) and scaled to the requested width, which is
// why text wraps identically in the preview and at full resolution. Text is never cut off: if it does not fit, the
// whole block shrinks until it does.

export type RatioKey = 'square' | 'portrait' | 'story' | 'landscape';

export const RATIOS: Record<RatioKey, { w: number; h: number; label: string; hint: string }> = {
  square: { w: 1080, h: 1080, label: 'Square', hint: 'Posts' },
  portrait: { w: 1080, h: 1350, label: 'Portrait', hint: '4:5' },
  story: { w: 1080, h: 1920, label: 'Story', hint: '9:16' },
  landscape: { w: 1200, h: 630, label: 'Wide', hint: 'Cards' },
};

export type FontKey = 'serif' | 'sans' | 'devanagari' | 'classic';
export const FONTS: Record<FontKey, { label: string; stack: string }> = {
  serif: { label: 'Fraunces', stack: "'Fraunces','Noto Serif Devanagari',Georgia,serif" },
  sans: { label: 'Inter', stack: "'Inter','Noto Serif Devanagari',system-ui,sans-serif" },
  devanagari: { label: 'Devanagari', stack: "'Noto Serif Devanagari','Fraunces',Georgia,serif" },
  classic: { label: 'Classic', stack: "Georgia,'Noto Serif Devanagari','Times New Roman',serif" },
};

export type PatternKey = 'none' | 'dots' | 'rays' | 'rings';
export type Align = 'left' | 'center' | 'right';

export interface Background {
  kind: 'solid' | 'gradient' | 'image';
  /** One colour for solid; two or more for a gradient. */
  colors: string[];
  /** Degrees, 0 = top to bottom. */
  angle: number;
  image: CanvasImageSource | null;
  imageSize: { w: number; h: number } | null;
  /** 1 fills the card exactly; larger zooms in. */
  zoom: number;
  /** −1..1, where in the picture the card looks. */
  panX: number;
  panY: number;
  /** 0..40 */
  blur: number;
  /** A wash of `overlayColor` over the whole background, 0..1. */
  overlay: number;
  overlayColor: string;
  pattern: PatternKey;
}

export interface TextStyle {
  sanskrit: string;
  transliteration: string;
  translation: string;
  reference: string;
  show: { sanskrit: boolean; transliteration: boolean; translation: boolean; reference: boolean };
  font: FontKey;
  /** Multiplier on the automatic size. */
  size: number;
  weight: number;
  italic: boolean;
  align: Align;
  lineHeight: number;
  color: string;
  opacity: number;
  /** Centre of the text block, 0..1 of the card. */
  x: number;
  y: number;
  /** Width of the text block, 0.4..1 of the card inside its margins. */
  width: number;
  /** Margin, 0.04..0.14 of the card width. */
  padding: number;
  /** Strength of a soft plate behind the text, 0..1. */
  plate: number;
  plateColor: string;
}

export interface CardSpec {
  ratio: RatioKey;
  background: Background;
  text: TextStyle;
  /** Small line at the bottom, e.g. the site address. Empty for none. */
  footer: string;
}

export interface Theme {
  id: string;
  name: string;
  group: 'Devotional' | 'Light' | 'Dark' | 'Festive';
  colors: string[];
  angle: number;
  text: string;
  overlay?: string;
  pattern?: PatternKey;
}

export const THEMES: Theme[] = [
  { id: 'sunrise', name: 'Sunrise', group: 'Devotional', colors: ['#ffd9a0', '#f59e4b', '#c2410c'], angle: 160, text: '#2b1407', pattern: 'rays' },
  { id: 'saffron', name: 'Saffron', group: 'Devotional', colors: ['#f6a23c', '#e0782d'], angle: 135, text: '#2a1608' },
  { id: 'lotus', name: 'Lotus', group: 'Devotional', colors: ['#fde7ef', '#f4b6c8', '#c96a8f'], angle: 170, text: '#3b1626', pattern: 'rings' },
  { id: 'temple', name: 'Temple dusk', group: 'Devotional', colors: ['#3a1d12', '#8a3b17', '#e6a54a'], angle: 200, text: '#fff4de', pattern: 'rays' },
  { id: 'ivory', name: 'Ivory', group: 'Light', colors: ['#fffdf9'], angle: 0, text: '#2a2420' },
  { id: 'cream', name: 'Cream', group: 'Light', colors: ['#fbf6ee', '#f1e4cf'], angle: 180, text: '#2a2420', pattern: 'dots' },
  { id: 'mist', name: 'Morning mist', group: 'Light', colors: ['#eef4f3', '#cfe2df'], angle: 160, text: '#1d2f2d' },
  { id: 'midnight', name: 'Midnight', group: 'Dark', colors: ['#12121c', '#262648'], angle: 180, text: '#f5efe3', pattern: 'dots' },
  { id: 'charcoal', name: 'Charcoal', group: 'Dark', colors: ['#1c1a18'], angle: 0, text: '#f4efe8' },
  { id: 'forest', name: 'Sacred grove', group: 'Dark', colors: ['#0f2a22', '#1f5c47', '#7bb38f'], angle: 165, text: '#f0f8f1' },
  { id: 'marigold', name: 'Marigold', group: 'Festive', colors: ['#ffcf4a', '#ff8a2b', '#d6336c'], angle: 145, text: '#2a0f14' },
  { id: 'diwali', name: 'Diwali', group: 'Festive', colors: ['#2b0a3d', '#a3236b', '#ffb347'], angle: 190, text: '#fff6e0', pattern: 'dots' },
];

/** Pictures that ship with the site. Anything else here needs a licence — see website/CLAUDE.md. */
export const PHOTO_PRESETS: { id: string; name: string; src: string }[] = [{ id: 'krishna', name: 'Krishna', src: '/img/krishna.jpg' }];

export function themeToBackground(theme: Theme, previous?: Background): Background {
  return {
    kind: theme.colors.length > 1 ? 'gradient' : 'solid',
    colors: theme.colors,
    angle: theme.angle,
    image: previous?.image ?? null,
    imageSize: previous?.imageSize ?? null,
    zoom: 1, panX: 0, panY: 0, blur: 0,
    overlay: 0,
    overlayColor: theme.overlay ?? '#000000',
    pattern: theme.pattern ?? 'none',
  };
}

export function defaultSpec(parts: { sanskrit?: string | null; transliteration?: string | null; translation?: string | null; reference?: string | null }): CardSpec {
  const theme = THEMES[0];
  return {
    ratio: 'portrait',
    background: themeToBackground(theme),
    text: {
      sanskrit: parts.sanskrit ?? '',
      transliteration: parts.transliteration ?? '',
      translation: parts.translation ?? '',
      reference: parts.reference ?? '',
      show: { sanskrit: Boolean(parts.sanskrit), transliteration: false, translation: Boolean(parts.translation), reference: Boolean(parts.reference) },
      font: 'serif', size: 1, weight: 500, italic: false, align: 'center', lineHeight: 1.35,
      color: theme.text, opacity: 1, x: 0.5, y: 0.5, width: 1, padding: 0.09, plate: 0, plateColor: '#000000',
    },
    footer: 'hariharibol.com',
  };
}

const LOGO_BOX = 0.1; // logo height as a share of the card width

interface Line { text: string; size: number; weight: number; italic: boolean; gapBefore: number; opacity: number }

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.replace(/\r/g, '').split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) { out.push(''); continue; }
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > maxWidth) { out.push(line); line = word; } else line = next;
    }
    // A single word wider than the line is broken by letter rather than run off the card.
    if (ctx.measureText(line).width > maxWidth) {
      let piece = '';
      for (const ch of Array.from(line)) {
        if (piece && ctx.measureText(piece + ch).width > maxWidth) { out.push(piece); piece = ch; } else piece += ch;
      }
      line = piece;
    }
    out.push(line);
  }
  return out;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function withAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, alpha))})`;
}

function drawBackground(ctx: CanvasRenderingContext2D, bg: Background, W: number, H: number) {
  if (bg.kind === 'image' && bg.image && bg.imageSize) {
    const { w: iw, h: ih } = bg.imageSize;
    const cover = Math.max(W / iw, H / ih) * Math.max(1, bg.zoom);
    const dw = iw * cover;
    const dh = ih * cover;
    const dx = (W - dw) / 2 + (bg.panX * (dw - W)) / 2;
    const dy = (H - dh) / 2 + (bg.panY * (dh - H)) / 2;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    if (bg.blur > 0) {
      // Blur by shrinking and enlarging: the same result in every browser, unlike ctx.filter (missing in Safari).
      const factor = 1 / (1 + bg.blur / 3);
      const small = document.createElement('canvas');
      small.width = Math.max(2, Math.round(W * factor));
      small.height = Math.max(2, Math.round(H * factor));
      const sctx = small.getContext('2d')!;
      sctx.imageSmoothingQuality = 'high';
      sctx.drawImage(bg.image, dx * factor, dy * factor, dw * factor, dh * factor);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(small, 0, 0, W, H);
    } else {
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bg.image, dx, dy, dw, dh);
    }
  } else if (bg.colors.length > 1) {
    const a = ((bg.angle - 90) * Math.PI) / 180;
    const cx = W / 2;
    const cy = H / 2;
    const half = (Math.abs(Math.cos(a)) * W + Math.abs(Math.sin(a)) * H) / 2;
    const g = ctx.createLinearGradient(cx - Math.cos(a) * half, cy - Math.sin(a) * half, cx + Math.cos(a) * half, cy + Math.sin(a) * half);
    bg.colors.forEach((c, i) => g.addColorStop(i / (bg.colors.length - 1), c));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else {
    ctx.fillStyle = bg.colors[0] ?? '#fffdf9';
    ctx.fillRect(0, 0, W, H);
  }

  if (bg.pattern !== 'none') {
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.strokeStyle = '#ffffff';
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, W / 540);
    if (bg.pattern === 'dots') {
      const step = W / 18;
      for (let y = step / 2; y < H; y += step) for (let x = step / 2; x < W; x += step) { ctx.beginPath(); ctx.arc(x, y, step / 14, 0, Math.PI * 2); ctx.fill(); }
    } else if (bg.pattern === 'rings') {
      for (let r = W * 0.12; r < Math.hypot(W, H); r += W * 0.09) { ctx.beginPath(); ctx.arc(W / 2, H * 0.55, r, 0, Math.PI * 2); ctx.stroke(); }
    } else {
      const cx = W / 2;
      const cy = H * 0.9;
      for (let i = 0; i < 28; i += 1) {
        const ang = Math.PI + (i / 27) * Math.PI;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ang) * Math.hypot(W, H), cy + Math.sin(ang) * Math.hypot(W, H)); ctx.stroke();
      }
    }
    ctx.restore();
  }

  if (bg.overlay > 0) {
    ctx.fillStyle = withAlpha(bg.overlayColor, bg.overlay);
    ctx.fillRect(0, 0, W, H);
  }
}

export interface Layout {
  /** The text block, in design units, for hit-testing a drag. */
  box: { x: number; y: number; w: number; h: number };
  scale: number;
}

/**
 * Draws `spec` into a canvas `outWidth` pixels wide (the height follows the ratio). `logo` is the HariHariBol mark
 * and is always drawn, top left.
 */
export function renderCard(spec: CardSpec, logo: CanvasImageSource & { width?: number; height?: number }, outWidth: number, canvas?: HTMLCanvasElement): { canvas: HTMLCanvasElement; layout: Layout } {
  const { w: W, h: H } = RATIOS[spec.ratio];
  const scale = outWidth / W;
  const c = canvas ?? document.createElement('canvas');
  c.width = Math.round(W * scale);
  c.height = Math.round(H * scale);
  const ctx = c.getContext('2d')!;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, W, H);

  // Rounded card with the background clipped to it.
  ctx.save();
  roundRect(ctx, 0, 0, W, H, W * 0.035);
  ctx.clip();
  drawBackground(ctx, spec.background, W, H);

  const t = spec.text;
  const pad = W * t.padding;
  const family = FONTS[t.font].stack;

  // The logo: top left, own aspect ratio, on a soft chip so it reads on any background.
  const lh = W * LOGO_BOX;
  const lw = logo.width && logo.height ? (lh * logo.width) / logo.height : lh;
  const chip = lh * 0.14;
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  roundRect(ctx, pad - chip, pad - chip, lw + chip * 2, lh + chip * 2, lh * 0.3);
  ctx.fill();
  ctx.drawImage(logo, pad, pad, lw, lh);
  const logoBottom = pad + lh + chip;

  const footerSize = W * 0.026;
  const footerH = spec.footer ? footerSize * 2.2 : 0;
  const zoneTop = logoBottom + W * 0.03;
  const zoneBottom = H - pad * 0.7 - footerH;
  const zoneH = Math.max(40, zoneBottom - zoneTop);
  const boxW = (W - pad * 2) * t.width;

  const blocks: { key: keyof TextStyle['show']; text: string; rel: number; weightDelta: number; italic: boolean; opacity: number; gap: number }[] = [
    { key: 'sanskrit', text: t.sanskrit, rel: 1, weightDelta: 0, italic: false, opacity: 1, gap: 0 },
    { key: 'transliteration', text: t.transliteration, rel: 0.6, weightDelta: -100, italic: true, opacity: 0.82, gap: 0.7 },
    { key: 'translation', text: t.translation, rel: 0.7, weightDelta: -100, italic: t.italic, opacity: 0.95, gap: 0.9 },
    { key: 'reference', text: t.reference, rel: 0.5, weightDelta: 100, italic: false, opacity: 0.8, gap: 1.1 },
  ];
  const active = blocks.filter((b) => t.show[b.key] && b.text.trim());

  // Find the largest size at which everything fits; never below a readable floor, and never cut — below the floor it
  // keeps shrinking, because dropping words is worse than small type.
  const base = W * 0.056 * t.size;
  let factor = 1;
  let lines: Line[] = [];
  let total = 0;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    lines = [];
    total = 0;
    for (const b of active) {
      const size = base * b.rel * factor;
      const weight = Math.max(300, Math.min(800, t.weight + b.weightDelta));
      ctx.font = `${b.italic || (b.key === 'sanskrit' && t.italic) ? 'italic ' : ''}${weight} ${size}px ${family}`;
      const wrapped = wrap(ctx, b.text, boxW);
      wrapped.forEach((line, i) => {
        const gapBefore = i === 0 ? (lines.length ? size * b.gap : 0) : 0;
        lines.push({ text: line, size, weight, italic: b.italic || (b.key === 'sanskrit' && t.italic), gapBefore, opacity: b.opacity });
        total += gapBefore + size * t.lineHeight;
      });
    }
    if (total <= zoneH) break;
    factor *= 0.95;
  }

  // Place the block: centred on (x, y), kept inside the safe zone and the margins.
  const boxH = total;
  const cx = Math.min(W - pad - boxW / 2, Math.max(pad + boxW / 2, t.x * W));
  const top = Math.min(zoneBottom - boxH, Math.max(zoneTop, t.y * H - boxH / 2));
  const left = cx - boxW / 2;

  if (t.plate > 0 && active.length) {
    const inset = W * 0.025;
    ctx.fillStyle = withAlpha(t.plateColor, t.plate);
    roundRect(ctx, left - inset, top - inset, boxW + inset * 2, boxH + inset * 2, W * 0.03);
    ctx.fill();
  }

  ctx.textBaseline = 'middle';
  ctx.textAlign = t.align;
  const anchor = t.align === 'left' ? left : t.align === 'right' ? left + boxW : cx;
  let y = top;
  for (const line of lines) {
    y += line.gapBefore;
    ctx.font = `${line.italic ? 'italic ' : ''}${line.weight} ${line.size}px ${family}`;
    ctx.globalAlpha = t.opacity * line.opacity;
    ctx.fillStyle = t.color;
    ctx.fillText(line.text, anchor, y + (line.size * t.lineHeight) / 2);
    y += line.size * t.lineHeight;
  }
  ctx.globalAlpha = 1;

  if (spec.footer) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `500 ${footerSize}px ${FONTS.sans.stack}`;
    ctx.fillStyle = t.color;
    ctx.globalAlpha = 0.7;
    ctx.fillText(spec.footer, W / 2, H - pad * 0.7);
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  return { canvas: c, layout: { box: { x: left, y: top, w: boxW, h: boxH }, scale } };
}

/** Waits for the fonts a card uses, so the first draw is not in a fallback face. Never rejects. */
export async function loadCardFonts(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load("500 40px 'Fraunces'"),
      document.fonts.load("500 40px 'Noto Serif Devanagari'", 'ॐ'),
      document.fonts.load("500 40px 'Inter'"),
    ]);
  } catch { /* fall back to the stacks' next face */ }
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png'): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, 0.92));
}

/** Checks a picked file before it is used: type, size and dimensions. Returns a message when it is not acceptable. */
export async function checkImageFile(file: File): Promise<{ ok: true; bitmap: ImageBitmap } | { ok: false; message: string }> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return { ok: false, message: 'Please choose a JPG, PNG or WebP picture.' };
  if (file.size > 8 * 1024 * 1024) return { ok: false, message: 'That picture is larger than 8 MB. Please choose a smaller one.' };
  try {
    const bitmap = await createImageBitmap(file);
    if (bitmap.width < 320 || bitmap.height < 320) return { ok: false, message: 'That picture is too small to make a card from.' };
    if (bitmap.width > 9000 || bitmap.height > 9000) return { ok: false, message: 'That picture is too large. Please choose one under 9000 pixels.' };
    return { ok: true, bitmap };
  } catch {
    return { ok: false, message: 'That file could not be read as a picture.' };
  }
}
