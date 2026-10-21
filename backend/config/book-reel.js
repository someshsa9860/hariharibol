// How a book reel (a verse drawn by the app as pages: Sanskrit, meaning, purport) looks and which
// buttons it shows. Edited in the admin panel (Reels → Book reels) and stored in AppSetting; these
// are the values used until someone saves, and for any field that is missing or unreadable.

export const BOOK_REEL_LAYOUT = 'VERSE_PAGES';

export const DEFAULT_BOOK_REEL_STYLE = {
  // 'gradient' blends the two colours top to bottom; 'solid' uses the first; 'image' lays the
  // uploaded picture (`imageKey`) under a dark wash of `imageDim` percent.
  background: 'gradient',
  colorTop: '#2B1408',
  colorBottom: '#7A3410',
  imageKey: null,
  imageDim: 55,

  sanskritColor: '#FFE9B8',
  transliterationColor: '#F3D9A4',
  meaningColor: '#FFFFFF',
  purportColor: '#F4EBDD',
  accentColor: '#F2A93B',

  // Multiplies every size in the reel; 1 is the app's own.
  textScale: 1,

  // A page stays on screen for its reading time, never less than `minPageSeconds`.
  minPageSeconds: 5,
  wordsPerSecond: 3,

  // Which buttons the right-hand rail shows. Hiding all of them leaves the whole width to the text.
  showLike: 1,
  showComments: 1,
  showSave: 1,
  showShare: 1,
  showMore: 1,
  showReference: 1,
};

export const BOOK_REEL_COLOR_KEYS = ['colorTop', 'colorBottom', 'sanskritColor', 'transliterationColor', 'meaningColor', 'purportColor', 'accentColor'];
export const BOOK_REEL_FLAG_KEYS = ['showLike', 'showComments', 'showSave', 'showShare', 'showMore', 'showReference'];
