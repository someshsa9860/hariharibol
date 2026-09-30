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
