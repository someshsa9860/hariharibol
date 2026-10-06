// The reel editor's document: everything the editor changes, in one plain object,
// plus the undo history around it and the two conversions to and from the API.
//
// The overlay shape is the contract with backend/routes/admin/reel.js and with
// the app's reel_overlays.dart — positions and sizes are percentages of the
// frame, style and colour are names the app maps to its own fonts and palette.

import { useCallback, useReducer } from 'react';

export type MediaType = 'VIDEO' | 'IMAGE' | 'AUDIO';
export type ReelStatus = 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'REJECTED' | 'TAKEN_DOWN';

export type OverlayStyle = 'body' | 'heading' | 'verse';
export type OverlayColor = 'light' | 'dark' | 'accent';
export type OverlayAlign = 'left' | 'center' | 'right';
/** Which field of the reel's verse a box is filled from. Only reels made from a template have these. */
export type OverlayBind = 'sanskrit' | 'transliteration' | 'translation' | 'reference';

export type Overlay = {
  id: string;
  text: string;
  /** Top-left of the box, as a % of the frame's width / height. */
  x: number;
  y: number;
  /** Box width, as a % of the frame's width. */
  width: number;
  /** Font size, as a % of the frame's width. */
  size: number;
  style: OverlayStyle;
  color: OverlayColor;
  align: OverlayAlign;
  source?: { verseId: string; label: string };
  /** Filled from the verse — by the API when the reel is made, and by the app each time it is fetched. */
  bind?: OverlayBind;
};

export const STYLE_LABELS: Record<OverlayStyle, string> = { body: 'Body', heading: 'Heading', verse: 'Verse' };
export const COLOR_LABELS: Record<OverlayColor, string> = { light: 'Light', dark: 'Dark', accent: 'Accent' };

// What the editor draws for each colour name. The app resolves the same names
// against its own theme, so these only need to look about right.
export const COLOR_PREVIEW: Record<OverlayColor, string> = {
  light: '#ffffff',
  dark: '#1b1b1f',
  accent: '#f5a524',
};

export const BIND_LABELS: Record<OverlayBind, string> = {
  sanskrit: 'Sanskrit',
  transliteration: 'Transliteration',
  translation: 'Translation',
  reference: 'Reference',
};

/** How a new box for each verse field starts out: Sanskrit large, the rest quieter. */
export const BIND_DEFAULTS: Record<OverlayBind, Partial<Overlay>> = {
  // 6% in and 72% wide ends at 78%, clear of the app's button column (from 82%).
  sanskrit: { style: 'verse', size: 5.5, x: 6, width: 72 },
  transliteration: { style: 'body', size: 3.6, x: 6, width: 72 },
  translation: { style: 'body', size: 4, x: 6, width: 72 },
  reference: { style: 'body', size: 3.2, x: 6, width: 72, color: 'accent' },
};

export const MAX_OVERLAYS = 20;

export const MEDIA_LABEL: Record<MediaType, string> = { VIDEO: 'Video', IMAGE: 'Slideshow', AUDIO: 'Audio' };

export const STATUS_LABEL: Record<ReelStatus, string> = {
  DRAFT: 'Draft',
  PENDING_REVIEW: 'Pending review',
  PUBLISHED: 'Published',
  REJECTED: 'Rejected',
  TAKEN_DOWN: 'Taken down',
};

export const STATUS_VARIANT: Record<ReelStatus, 'secondary' | 'warning' | 'success' | 'destructive'> = {
  DRAFT: 'secondary',
  PENDING_REVIEW: 'warning',
  PUBLISHED: 'success',
  REJECTED: 'destructive',
  TAKEN_DOWN: 'destructive',
};

export type ReelImage = { path: string; url: string };

export type ReelDoc = {
  mediaType: MediaType;
  creatorId: string;

  videoPath: string | null;
  videoUrl: string | null;
  images: ReelImage[];
  /** Background music on a video or slideshow; the recitation itself on an audio reel. */
  audioPath: string | null;
  audioUrl: string | null;
  thumbnailPath: string | null;
  thumbnailUrl: string | null;
  durationMs: number | null;
  width: number | null;
  height: number | null;

  caption: string;
  tags: string[];
  languageCode: string;
  sampradaya: string;

  /** The verse this reel is about. `id` is the row id the API stores; `verseId` the dotted key. */
  verse: { id: string; verseId: string; label: string } | null;
  mantraId: string;
  deityId: string;

  overlays: Overlay[];
};

/** A reel as `GET /api/admin/reels/:id` returns it. */
export type ReelDetail = {
  id: string;
  status: ReelStatus;
  mediaType: MediaType;
  creatorId: string;
  videoPath: string | null;
  videoUrl: string | null;
  images: ReelImage[];
  audioPath: string | null;
  audioUrl: string | null;
  thumbnailPath: string | null;
  thumbnailUrl: string | null;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  caption: string | null;
  tags: string[];
  languageCode: string | null;
  sampradaya: string;
  verseId: string | null;
  mantraId: string | null;
  deityId: string | null;
  overlays: Overlay[];
  /** Set when the reel was made automatically from a template. */
  templateId?: string | null;
  publishedAt: string | null;
  rejectionReason: string | null;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  createdAt: string;
  creator: { id: string; displayName: string; status: string };
  verse: {
    id: string;
    verseId: string;
    book: { title: string };
    chapterNumber: number | null;
    verseNumber: number;
  } | null;
};

/** A reel template as `GET /api/admin/reel-recipes/templates/:id` returns it. */
export type TemplateDetail = {
  id: string;
  name: string;
  reelCount: number;
  mediaType: 'VIDEO' | 'IMAGE';
  videoPath: string | null;
  videoUrl: string | null;
  images: ReelImage[];
  audioPath: string | null;
  audioUrl: string | null;
  thumbnailPath: string | null;
  thumbnailUrl: string | null;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  overlays: Overlay[];
};

/** A template opened in the editor: the same document, minus what belongs to each reel. */
export function docFromTemplate(template: TemplateDetail): ReelDoc {
  return {
    ...emptyDoc(template.mediaType),
    videoPath: template.videoPath,
    videoUrl: template.videoUrl,
    images: template.images,
    audioPath: template.audioPath,
    audioUrl: template.audioUrl,
    thumbnailPath: template.thumbnailPath,
    thumbnailUrl: template.thumbnailUrl,
    durationMs: template.durationMs,
    width: template.width,
    height: template.height,
    overlays: template.overlays ?? [],
  };
}

/** The `config` a template is saved with. */
export function configFromDoc(doc: ReelDoc) {
  return {
    mediaType: doc.mediaType === 'VIDEO' ? ('VIDEO' as const) : ('IMAGE' as const),
    videoPath: doc.mediaType === 'VIDEO' ? doc.videoPath : null,
    images: doc.mediaType === 'IMAGE' ? doc.images.map((image) => image.path) : [],
    audioPath: doc.audioPath,
    thumbnailPath: doc.thumbnailPath,
    durationMs: doc.durationMs,
    width: doc.width,
    height: doc.height,
    // A bound box keeps whatever text it last showed; the API replaces it per verse.
    overlays: doc.overlays
      .filter((overlay) => overlay.bind || overlay.text.trim())
      .map((overlay) => (overlay.text.trim() ? overlay : { ...overlay, text: BIND_LABELS[overlay.bind!] })),
  };
}

export function emptyDoc(mediaType: MediaType, creatorId = ''): ReelDoc {
  return {
    mediaType,
    creatorId,
    videoPath: null,
    videoUrl: null,
    images: [],
    audioPath: null,
    audioUrl: null,
    thumbnailPath: null,
    thumbnailUrl: null,
    durationMs: null,
    width: null,
    height: null,
    caption: '',
    tags: [],
    languageCode: '',
    sampradaya: 'vaishnav',
    verse: null,
    mantraId: '',
    deityId: '',
    overlays: [],
  };
}

export function docFromReel(reel: ReelDetail): ReelDoc {
  return {
    mediaType: reel.mediaType,
    creatorId: reel.creatorId,
    videoPath: reel.videoPath,
    videoUrl: reel.videoUrl,
    images: reel.images,
    audioPath: reel.audioPath,
    audioUrl: reel.audioUrl,
    thumbnailPath: reel.thumbnailPath,
    thumbnailUrl: reel.thumbnailUrl,
    durationMs: reel.durationMs,
    width: reel.width,
    height: reel.height,
    caption: reel.caption ?? '',
    tags: reel.tags,
    languageCode: reel.languageCode ?? '',
    sampradaya: reel.sampradaya,
    verse: reel.verse
      ? {
          id: reel.verse.id,
          verseId: reel.verse.verseId,
          label: `${reel.verse.book.title} ${reel.verse.verseId}`,
        }
      : null,
    mantraId: reel.mantraId ?? '',
    deityId: reel.deityId ?? '',
    overlays: reel.overlays ?? [],
  };
}

/** The body for POST / PATCH /api/admin/reels. Always the whole document — it is small. */
export function bodyFromDoc(doc: ReelDoc) {
  return {
    mediaType: doc.mediaType,
    creatorId: doc.creatorId,
    videoPath: doc.videoPath,
    images: doc.images.map((image) => image.path),
    audioPath: doc.audioPath,
    thumbnailPath: doc.thumbnailPath,
    durationMs: doc.durationMs,
    width: doc.width,
    height: doc.height,
    caption: doc.caption.trim() || null,
    tags: doc.tags,
    languageCode: doc.languageCode || null,
    sampradaya: doc.sampradaya,
    verseId: doc.verse?.id ?? null,
    mantraId: doc.mantraId || null,
    deityId: doc.deityId || null,
    // An empty box is invisible in the app and would only fail the API's 1-character rule.
    overlays: doc.overlays.filter((overlay) => overlay.text.trim()),
  };
}

const newId = () => Math.random().toString(36).slice(2, 10);

/** A new text box, dropped below the lowest one so a stack of them does not pile up. */
export function newOverlay(existing: Overlay[], partial: Partial<Overlay> = {}): Overlay {
  const lowest = existing.reduce((y, overlay) => Math.max(y, overlay.y), 10);
  return {
    id: newId(),
    text: 'New text',
    x: 10,
    y: existing.length ? Math.min(lowest + 12, 80) : 22,
    width: 80,
    size: 6,
    style: 'body',
    color: 'light',
    align: 'center',
    ...partial,
  };
}

export const duplicateOverlay = (overlay: Overlay): Overlay => ({
  ...overlay,
  id: newId(),
  x: Math.min(overlay.x + 3, 95),
  y: Math.min(overlay.y + 3, 95),
});

/** Starting points for a new box. Only fields the overlay contract already has. */
export const OVERLAY_PRESETS: { label: string; hint: string; overlay: Partial<Overlay> }[] = [
  { label: 'Title', hint: 'Large heading near the top', overlay: { text: 'Title', style: 'heading', size: 9, x: 8, y: 12, width: 84 } },
  { label: 'Subtitle', hint: 'Under a title', overlay: { text: 'Subtitle', style: 'body', size: 5, x: 10, y: 24, width: 80 } },
  { label: 'Verse', hint: 'Verse face, centred', overlay: { text: 'Verse', style: 'verse', size: 4.5, x: 8, y: 36, width: 84 } },
  { label: 'Translation', hint: 'Smaller body text', overlay: { text: 'Translation', style: 'body', size: 4, x: 8, y: 52, width: 84 } },
  { label: 'Highlight', hint: 'Accent colour, one line', overlay: { text: 'Highlight', style: 'heading', color: 'accent', size: 6.5, x: 10, y: 64, width: 72 } },
];

// ── Clipboard ──────────────────────────────────────────────────────────────
// A copied text box goes to localStorage rather than the system clipboard, so
// it can be pasted into another reel in another tab without asking for
// clipboard permission — and so copying text out of a field still works as usual.

const CLIPBOARD_KEY = 'hhb_admin_reel_clipboard';

export function writeClipboard(overlay: Overlay) {
  try {
    localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(overlay));
  } catch {
    // Storage blocked: copy simply does nothing.
  }
}

export function readClipboard(): Overlay | null {
  try {
    const value = JSON.parse(localStorage.getItem(CLIPBOARD_KEY) ?? 'null') as Overlay | null;
    const valid =
      value &&
      typeof value.text === 'string' &&
      ['x', 'y', 'width', 'size'].every((k) => typeof value[k as keyof Overlay] === 'number') &&
      value.style in STYLE_LABELS &&
      value.color in COLOR_LABELS &&
      ['left', 'center', 'right'].includes(value.align);
    return valid ? value : null;
  } catch {
    return null;
  }
}

// ── History ────────────────────────────────────────────────────────────────
// Undo/redo over the whole document. Two things keep it usable: a drag is one
// step, not one per pixel (begin/end), and typing into the same field within a
// second and a bit is one step (a coalesce key).

const LIMIT = 100;
const COALESCE_MS = 1200;

type History<T> = {
  past: T[];
  present: T;
  future: T[];
  gesture: T | null;
  lastKey: string;
  lastAt: number;
};

type Action<T> =
  | { type: 'set'; fn: (doc: T) => T; key: string; at: number }
  | { type: 'replace'; doc: T }
  | { type: 'begin' }
  | { type: 'end' }
  | { type: 'undo' }
  | { type: 'redo' };

function reducer<T>(state: History<T>, action: Action<T>): History<T> {
  switch (action.type) {
    case 'set': {
      const next = action.fn(state.present);
      if (next === state.present) return state;

      // Inside a drag: just move; `end` files the whole gesture as one step.
      if (state.gesture) return { ...state, present: next };

      if (action.key && action.key === state.lastKey && action.at - state.lastAt < COALESCE_MS) {
        return { ...state, present: next, lastAt: action.at };
      }
      return {
        ...state,
        past: [...state.past, state.present].slice(-LIMIT),
        present: next,
        future: [],
        lastKey: action.key,
        lastAt: action.at,
      };
    }
    case 'replace':
      return { ...state, present: action.doc };
    case 'begin':
      return { ...state, gesture: state.present };
    case 'end': {
      if (!state.gesture) return state;
      if (state.gesture === state.present) return { ...state, gesture: null };
      return { ...state, past: [...state.past, state.gesture].slice(-LIMIT), future: [], gesture: null, lastKey: '' };
    }
    case 'undo': {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return { ...state, past: state.past.slice(0, -1), present: previous, future: [state.present, ...state.future], lastKey: '' };
    }
    case 'redo': {
      if (state.future.length === 0) return state;
      const [next, ...rest] = state.future;
      return { ...state, past: [...state.past, state.present], present: next, future: rest, lastKey: '' };
    }
  }
}

export function useReelHistory(initial: ReelDoc) {
  const [state, dispatch] = useReducer(reducer<ReelDoc>, {
    past: [],
    present: initial,
    future: [],
    gesture: null,
    lastKey: '',
    lastAt: 0,
  });

  return {
    doc: state.present,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    /** Change the document. Pass a `key` to merge rapid edits of one field into one undo step. */
    set: useCallback((fn: (doc: ReelDoc) => ReelDoc, key = '') => dispatch({ type: 'set', fn, key, at: Date.now() }), []),
    /** Swap the document without making an undo step — after a save, for the fresh URLs. */
    replace: useCallback((doc: ReelDoc) => dispatch({ type: 'replace', doc }), []),
    beginGesture: useCallback(() => dispatch({ type: 'begin' }), []),
    endGesture: useCallback(() => dispatch({ type: 'end' }), []),
    undo: useCallback(() => dispatch({ type: 'undo' }), []),
    redo: useCallback(() => dispatch({ type: 'redo' }), []),
  };
}

export type ReelHistory = ReturnType<typeof useReelHistory>;

// ── Links ──────────────────────────────────────────────────────────────────

/**
 * After a save the API hands back signed links for every file. Where the file
 * is the one already on screen from this browser (a blob: URL from the upload),
 * keep that: swapping it would reload the player and stop playback for nothing.
 */
export function keepLocalUrls(next: ReelDoc, current: ReelDoc): ReelDoc {
  const local = (url: string | null) => Boolean(url?.startsWith('blob:'));
  const localImages = new Map(current.images.filter((i) => local(i.url)).map((i) => [i.path, i.url]));
  return {
    ...next,
    videoUrl: next.videoPath === current.videoPath && local(current.videoUrl) ? current.videoUrl : next.videoUrl,
    audioUrl: next.audioPath === current.audioPath && local(current.audioUrl) ? current.audioUrl : next.audioUrl,
    thumbnailUrl: next.thumbnailPath === current.thumbnailPath && local(current.thumbnailUrl) ? current.thumbnailUrl : next.thumbnailUrl,
    images: next.images.map((image) => ({ ...image, url: localImages.get(image.path) ?? image.url })),
  };
}

/** `doc` as it is, with fresher links from `server` for every file both still point at. */
export function withUrlsFrom(doc: ReelDoc, server: ReelDoc): ReelDoc {
  const urls = new Map(server.images.map((i) => [i.path, i.url]));
  return {
    ...doc,
    videoUrl: doc.videoPath && doc.videoPath === server.videoPath ? server.videoUrl : doc.videoUrl,
    audioUrl: doc.audioPath && doc.audioPath === server.audioPath ? server.audioUrl : doc.audioUrl,
    thumbnailUrl: doc.thumbnailPath && doc.thumbnailPath === server.thumbnailPath ? server.thumbnailUrl : doc.thumbnailUrl,
    images: doc.images.map((image) => ({ ...image, url: urls.get(image.path) ?? image.url })),
  };
}

/** The document with its media dropped and its type changed. */
export function withMediaType(doc: ReelDoc, mediaType: MediaType): ReelDoc {
  return {
    ...doc,
    mediaType,
    videoPath: null,
    videoUrl: null,
    images: [],
    audioPath: null,
    audioUrl: null,
    thumbnailPath: null,
    thumbnailUrl: null,
    durationMs: null,
    width: null,
    height: null,
  };
}
