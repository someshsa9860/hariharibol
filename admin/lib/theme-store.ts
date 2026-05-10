import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeKey =
  | 'system'
  | 'cosmic'      // deep purple/space (default dark)
  | 'saffron'     // warm orange-dark (original)
  | 'midnight'    // pure black minimal
  | 'forest'      // dark green nature
  | 'ocean'       // deep blue aqua
  | 'rose'        // dark rose/pink
  | 'light'       // clean white
  | 'parchment';  // warm ivory (vedic scroll)

export interface ThemeConfig {
  key: ThemeKey;
  label: string;
  desc: string;
  preview: string[];        // 3 preview swatches
  isDark: boolean;
  vars: Record<string, string>;
}

export const THEMES: ThemeConfig[] = [
  {
    key: 'system',
    label: 'System',
    desc: 'Follows your OS preference',
    preview: ['#1e1e2e', '#cba6f7', '#f38ba8'],
    isDark: true,
    vars: {},  // resolved at runtime
  },
  {
    key: 'cosmic',
    label: 'Cosmic',
    desc: 'Deep space — purple & saffron',
    preview: ['#0D0A0E', '#a78bfa', '#FF6B2B'],
    isDark: true,
    vars: {
      '--bg':          '#0D0A0E',
      '--bg-2':        '#131117',
      '--bg-3':        '#1A1520',
      '--surface':     'rgba(255,255,255,0.03)',
      '--surface-2':   'rgba(255,255,255,0.06)',
      '--border':      'rgba(255,255,255,0.07)',
      '--border-2':    'rgba(255,255,255,0.12)',
      '--text':        '#F0EBF8',
      '--text-2':      '#C4BAD4',
      '--muted':       '#9B8FA8',
      '--accent':      '#FF6B2B',
      '--accent-2':    '#F5C842',
      '--accent-glow': 'rgba(255,107,43,0.25)',
      '--sidebar-bg':  'rgba(13,10,14,0.97)',
      '--header-bg':   'rgba(13,10,14,0.85)',
    },
  },
  {
    key: 'saffron',
    label: 'Saffron',
    desc: 'Warm vedic — orange & gold',
    preview: ['#1A0E08', '#FF6B2B', '#F5C842'],
    isDark: true,
    vars: {
      '--bg':          '#100A05',
      '--bg-2':        '#1A0E08',
      '--bg-3':        '#241406',
      '--surface':     'rgba(255,150,50,0.04)',
      '--surface-2':   'rgba(255,150,50,0.08)',
      '--border':      'rgba(255,150,50,0.1)',
      '--border-2':    'rgba(255,150,50,0.18)',
      '--text':        '#FFF3E8',
      '--text-2':      '#E8C9A8',
      '--muted':       '#A87850',
      '--accent':      '#FF6B2B',
      '--accent-2':    '#F5C842',
      '--accent-glow': 'rgba(255,107,43,0.3)',
      '--sidebar-bg':  'rgba(16,10,5,0.97)',
      '--header-bg':   'rgba(16,10,5,0.88)',
    },
  },
  {
    key: 'midnight',
    label: 'Midnight',
    desc: 'Pure black — minimal & sharp',
    preview: ['#000000', '#ffffff', '#FF6B2B'],
    isDark: true,
    vars: {
      '--bg':          '#000000',
      '--bg-2':        '#0A0A0A',
      '--bg-3':        '#111111',
      '--surface':     'rgba(255,255,255,0.03)',
      '--surface-2':   'rgba(255,255,255,0.06)',
      '--border':      'rgba(255,255,255,0.08)',
      '--border-2':    'rgba(255,255,255,0.14)',
      '--text':        '#FFFFFF',
      '--text-2':      '#CCCCCC',
      '--muted':       '#888888',
      '--accent':      '#FF6B2B',
      '--accent-2':    '#F5C842',
      '--accent-glow': 'rgba(255,107,43,0.2)',
      '--sidebar-bg':  'rgba(0,0,0,0.99)',
      '--header-bg':   'rgba(0,0,0,0.88)',
    },
  },
  {
    key: 'forest',
    label: 'Forest',
    desc: 'Deep green — calm & grounded',
    preview: ['#0A130A', '#4ade80', '#86efac'],
    isDark: true,
    vars: {
      '--bg':          '#060D06',
      '--bg-2':        '#0A130A',
      '--bg-3':        '#0F1C0F',
      '--surface':     'rgba(74,222,128,0.04)',
      '--surface-2':   'rgba(74,222,128,0.08)',
      '--border':      'rgba(74,222,128,0.1)',
      '--border-2':    'rgba(74,222,128,0.18)',
      '--text':        '#E8FFE8',
      '--text-2':      '#B8DDB8',
      '--muted':       '#6B9B6B',
      '--accent':      '#4ade80',
      '--accent-2':    '#86efac',
      '--accent-glow': 'rgba(74,222,128,0.25)',
      '--sidebar-bg':  'rgba(6,13,6,0.97)',
      '--header-bg':   'rgba(6,13,6,0.88)',
    },
  },
  {
    key: 'ocean',
    label: 'Ocean',
    desc: 'Deep blue — vast & serene',
    preview: ['#050D1A', '#38bdf8', '#818cf8'],
    isDark: true,
    vars: {
      '--bg':          '#030A14',
      '--bg-2':        '#050D1A',
      '--bg-3':        '#081524',
      '--surface':     'rgba(56,189,248,0.04)',
      '--surface-2':   'rgba(56,189,248,0.08)',
      '--border':      'rgba(56,189,248,0.1)',
      '--border-2':    'rgba(56,189,248,0.18)',
      '--text':        '#E8F4FF',
      '--text-2':      '#B8D4E8',
      '--muted':       '#5B8AAA',
      '--accent':      '#38bdf8',
      '--accent-2':    '#818cf8',
      '--accent-glow': 'rgba(56,189,248,0.25)',
      '--sidebar-bg':  'rgba(3,10,20,0.97)',
      '--header-bg':   'rgba(3,10,20,0.88)',
    },
  },
  {
    key: 'rose',
    label: 'Rose',
    desc: 'Dark rose — bold & expressive',
    preview: ['#130608', '#f43f5e', '#fb923c'],
    isDark: true,
    vars: {
      '--bg':          '#0D0406',
      '--bg-2':        '#130608',
      '--bg-3':        '#1C080C',
      '--surface':     'rgba(244,63,94,0.04)',
      '--surface-2':   'rgba(244,63,94,0.08)',
      '--border':      'rgba(244,63,94,0.1)',
      '--border-2':    'rgba(244,63,94,0.18)',
      '--text':        '#FFE8EC',
      '--text-2':      '#E8B8C4',
      '--muted':       '#A85070',
      '--accent':      '#f43f5e',
      '--accent-2':    '#fb923c',
      '--accent-glow': 'rgba(244,63,94,0.25)',
      '--sidebar-bg':  'rgba(13,4,6,0.97)',
      '--header-bg':   'rgba(13,4,6,0.88)',
    },
  },
  {
    key: 'light',
    label: 'Light',
    desc: 'Clean white — bright & airy',
    preview: ['#FFFFFF', '#FF6B2B', '#6366f1'],
    isDark: false,
    vars: {
      '--bg':          '#F8F8FC',
      '--bg-2':        '#FFFFFF',
      '--bg-3':        '#F0F0F8',
      '--surface':     'rgba(0,0,0,0.03)',
      '--surface-2':   'rgba(0,0,0,0.06)',
      '--border':      'rgba(0,0,0,0.08)',
      '--border-2':    'rgba(0,0,0,0.14)',
      '--text':        '#0D0A1A',
      '--text-2':      '#2D2840',
      '--muted':       '#6B6585',
      '--accent':      '#FF6B2B',
      '--accent-2':    '#6366f1',
      '--accent-glow': 'rgba(255,107,43,0.2)',
      '--sidebar-bg':  'rgba(255,255,255,0.97)',
      '--header-bg':   'rgba(248,248,252,0.92)',
    },
  },
  {
    key: 'parchment',
    label: 'Parchment',
    desc: 'Vedic scroll — warm ivory',
    preview: ['#FBF5E6', '#C75A1A', '#8B4513'],
    isDark: false,
    vars: {
      '--bg':          '#FBF5E6',
      '--bg-2':        '#FFF8EE',
      '--bg-3':        '#F5EDDA',
      '--surface':     'rgba(139,69,19,0.04)',
      '--surface-2':   'rgba(139,69,19,0.08)',
      '--border':      'rgba(139,69,19,0.12)',
      '--border-2':    'rgba(139,69,19,0.2)',
      '--text':        '#2A1506',
      '--text-2':      '#4A2510',
      '--muted':       '#8B6040',
      '--accent':      '#C75A1A',
      '--accent-2':    '#DAA520',
      '--accent-glow': 'rgba(199,90,26,0.2)',
      '--sidebar-bg':  'rgba(251,245,230,0.97)',
      '--header-bg':   'rgba(255,248,238,0.92)',
    },
  },
];

// System theme resolves to cosmic (dark) or light based on OS
export function resolveSystemTheme(): ThemeConfig {
  if (typeof window === 'undefined') return THEMES[1]; // cosmic fallback SSR
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? THEMES[1] : THEMES[7]; // cosmic or light
}

export function applyTheme(config: ThemeConfig) {
  const resolved = config.key === 'system' ? resolveSystemTheme() : config;
  const root = document.documentElement;
  Object.entries(resolved.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  root.setAttribute('data-theme', resolved.key);
  root.setAttribute('data-dark', String(resolved.isDark));
}

interface ThemeStore {
  themeKey: ThemeKey;
  setTheme: (key: ThemeKey) => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      themeKey: 'system',
      setTheme: (key) => set({ themeKey: key }),
    }),
    { name: 'hhb-theme' }
  )
);
