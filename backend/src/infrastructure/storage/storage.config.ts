export interface StorageConfig {
  provider: 'local' | 's3';
  local?: {
    basePath: string; // e.g., './uploads'
  };
  s3?: {
    bucket: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
  };
  imageVariants: {
    sm: { width: number; height: number };
    md: { width: number; height: number };
    lg: { width: number; height: number };
  };
}

export const defaultImageVariants = {
  sm: { width: 240, height: 240 },
  md: { width: 480, height: 480 },
  lg: { width: 1024, height: 1024 },
};

export const folderStructure = {
  // Public files (accessible without authentication)
  publicSampraday: (sampradayId: string) => `public/sampradayas/${sampradayId}`,
  publicBook: (bookId: string) => `public/books/${bookId}`,
  publicVerse: (verseId: string) => `public/verses/${verseId}`,
  publicMantra: (mantraId: string) => `public/mantras/${mantraId}`,
  publicVerseOfDay: () => `public/verses-of-day`,
  publicNarration: (narrationId: string) => `public/narrations/${narrationId}`,

  // Private files (require authentication)
  sampraday: (sampradayId: string) => `private/sampradayas/${sampradayId}`,
  book: (bookId: string) => `private/books/${bookId}`,
  verse: (verseId: string) => `private/verses/${verseId}`,
  mantra: (mantraId: string) => `private/mantras/${mantraId}`,
  narration: (narrationId: string) => `private/narrations/${narrationId}`,
  user: (userId: string) => `private/users/${userId}`,
  translation: (languageCode: string) => `private/translations/${languageCode}`,
};

export const fileTypes = {
  IMAGE: ['image/jpeg', 'image/png', 'image/webp'],
  AUDIO: ['audio/mpeg', 'audio/wav', 'audio/ogg'],
  VIDEO: ['video/mp4', 'video/webm'],
};

export const maxFileSizes = {
  IMAGE: 5 * 1024 * 1024, // 5MB
  AUDIO: 50 * 1024 * 1024, // 50MB
  VIDEO: 500 * 1024 * 1024, // 500MB
};
