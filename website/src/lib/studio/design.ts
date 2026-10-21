// What a share card is made of. One plain object: the preview and the exported PNG are both drawn from it by the
// same function (render.ts), so what is seen is what is saved.

export type FormatKey = 'square' | 'portrait' | 'story' | 'landscape';
export const FORMATS: Record<FormatKey, { label: string; w: number; h: number; hint: string }> = {
  square: { label: 'Square', w: 1080, h: 1080, hint: 'Feed posts' },
  portrait: { label: 'Portrait', w: 1080, h: 1350, hint: 'Feed, 4:5' },
  story: { label: 'Story', w: 1080, h: 1920, hint: 'Stories & reels' },
  landscape: { label: 'Landscape', w: 1200, h: 630, hint: 'Link cards' },
};

export type FontKey = 'serif' | 'deva' | 'sans';
export const FONTS: Record<FontKey, { label: string; css: string }> = {
  serif: { label: 'Fraunces', css: '"Fraunces", Georgia, serif' },
  deva: { label: 'Noto Serif', css: '"Noto Serif Devanagari", "Fraunces", Georgia, serif' },
  sans: { label: 'Inter', css: '"Inter", system-ui, sans-serif' },
};

export type Scene = 'none' | 'sunrise' | 'temple' | 'lotus';
export type Pattern = 'none' | 'dots' | 'mandala';

export interface Design {
  format: FormatKey;
  bg: {
    kind: 'solid' | 'gradient' | 'image';
    colors: string[]; // solid uses [0]
    angle: number; // degrees, gradient only
    scene: Scene;
    pattern: Pattern;
    // Image backgrounds: `src` is an object URL or same-origin URL; zoom ≥ 1; x/y in -1..1 move it within the overflow.
    image: { src: string | null; zoom: number; x: number; y: number };
    blur: number; // 0–40 (px at 1080 wide)
    overlay: number; // 0–0.85 black
  };
  text: {
    main: string;
    translit: string;
    meaning: string;
    ref: string;
    showTranslit: boolean;
    showMeaning: boolean;
    showRef: boolean;
    font: FontKey;
    size: number; // px at 1080 wide, for the main text
    weight: 400 | 500 | 600 | 700;
    italic: boolean;
    align: 'left' | 'center' | 'right';
    lineHeight: number;
    color: string;
    opacity: number;
    shade: number; // 0–0.8 dark panel behind the text
    x: number; // -0.3..0.3 of the width
    y: number; // 0..1 position within the free vertical space
    padding: number; // px at 1080 wide
  };
}

export interface StudioContent {
  kind: 'SHLOKA' | 'MANTRA' | 'REEL';
  targetId: string;
  title: string;
  sanskrit: string | null;
  transliteration: string | null;
  meaning: string | null;
}

export const GRADIENTS: { name: string; colors: string[]; angle: number; light?: boolean }[] = [
  { name: 'Saffron dawn', colors: ['#f6a04d', '#e0782d', '#8f3a12'], angle: 160 },
  { name: 'Temple gold', colors: ['#f3d27a', '#c98f2b', '#5e3a0c'], angle: 150 },
  { name: 'Lotus', colors: ['#f7c6d9', '#d86a95', '#5a1f45'], angle: 165 },
  { name: 'Night sky', colors: ['#1b2142', '#2d2a63', '#0b0d1f'], angle: 170 },
  { name: 'Yamuna', colors: ['#7fd1d9', '#2a7f9e', '#0e2f4d'], angle: 160 },
  { name: 'Tulasi', colors: ['#cfe8b0', '#5f9a4d', '#1d3d22'], angle: 155 },
  { name: 'Ivory', colors: ['#fffaf0', '#f4e6cc'], angle: 180, light: true },
  { name: 'Charcoal', colors: ['#2b2723', '#171411'], angle: 180 },
];

export const SOLIDS = ['#fbf6ee', '#f4e6cc', '#e0782d', '#8f3a12', '#2d2a63', '#1d3d22', '#171411', '#ffffff'];

export const SCENES: { key: Scene; label: string; colors: string[] }[] = [
  { key: 'sunrise', label: 'Sunrise', colors: ['#2d2a63', '#e0782d', '#f6d27a'] },
  { key: 'temple', label: 'Temple', colors: ['#1b1330', '#5c2a63', '#f0a24a'] },
  { key: 'lotus', label: 'Lotus pond', colors: ['#0e2f4d', '#2a7f9e', '#f7c6d9'] },
];

export const AI_PROMPTS = [
  'A peaceful golden sunrise behind an ancient Indian temple, warm saffron and gold tones',
  'Soft lotus flowers on a still pond at dawn, gentle pink and teal light',
  'A quiet forest path in morning mist with rays of light, calm and sacred',
  'Abstract devotional texture in deep indigo and gold, delicate mandala patterns',
];

export function defaultDesign(content: StudioContent): Design {
  const g = GRADIENTS[0];
  const main = content.sanskrit?.trim() || content.title;
  return {
    format: 'square',
    bg: { kind: 'gradient', colors: g.colors, angle: g.angle, scene: 'none', pattern: 'none', image: { src: null, zoom: 1, x: 0, y: 0 }, blur: 0, overlay: 0.12 },
    text: {
      main,
      translit: content.transliteration?.trim() ?? '',
      meaning: content.meaning?.trim() ?? '',
      ref: content.title,
      showTranslit: false,
      showMeaning: Boolean(content.meaning),
      showRef: true,
      font: content.sanskrit ? 'deva' : 'serif',
      size: 64,
      weight: 500,
      italic: false,
      align: 'center',
      lineHeight: 1.45,
      color: '#ffffff',
      opacity: 1,
      shade: 0,
      x: 0,
      y: 0.5,
      padding: 80,
    },
  };
}

/** Looks light enough that dark text is the readable choice. */
export function isLight(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.68;
}
