// The shapes the API sends (backend/utils/present.js). Only the fields this site reads.

export type I18nMap = Record<string, string> | null;

export interface Deity {
  id: string;
  slug: string;
  name: string;
  imageUrl?: string | null;
  fullImageUrl?: string | null;
}

export interface Book {
  id: string;
  bookNumber: number;
  slug: string;
  type: 'SCRIPTURE' | 'STOTRA' | 'AARTI' | 'PRAYER' | 'POEM' | 'TEXT';
  title: string;
  titleI18n: I18nMap;
  description: string | null;
  descriptionI18n: I18nMap;
  sourceLanguage: string | null;
  coverImageUrl: string | null;
  audioUrl: string | null;
  totalCantos: number;
  totalChapters: number;
  totalVerses: number;
  tags: string[];
  deity: { slug: string; name: string } | null;
}

export interface Section {
  id: string;
  number: number;
  cantoNumber: number | null;
  title: string | null;
  titleI18n: I18nMap;
  summary: string | null;
  summaryI18n: I18nMap;
  totalChapters?: number;
  totalVerses: number;
}

export interface Translator {
  slug: string;
  name: string;
}

export interface VerseTranslation {
  id?: string;
  languageCode: string;
  type: string;
  meaning: string | null;
  purport: string | null;
  sourceRef: string | null;
  translator: Translator | null;
}

export interface WordMeaning {
  word: string | null;
  meaning: string;
}

export interface Verse {
  id: string;
  verseId: string;
  bookNumber: number;
  cantoNumber: number | null;
  chapterNumber: number | null;
  verseNumber: number;
  verseNumberEnd: number | null;
  type: string;
  sanskrit: string | null;
  transliteration: string | null;
  wordMeanings: WordMeaning[] | null;
  audioUrl: string | null;
  tags: string[];
  isFavorite: boolean;
  favoriteId: string | null;
  book: { slug: string; title: string; bookNumber: number } | null;
  chapter: { number: number; title: string | null } | null;
  translation: VerseTranslation | null;
  availableTranslations: { id: string; languageCode: string; type: string; translator: Translator | null }[];
  explanation: { text: string; source: string | null } | null;
}

export interface WebVerse extends Verse {
  translations: VerseTranslation[];
  previousVerseId: string | null;
  nextVerseId: string | null;
  canonicalUrl: string;
}

export interface Mantra {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string | null;
  sampradaya: string | null;
  tags: string[];
  text: string;
  textLanguage: string;
  transliteration: string | null;
  meaning: string | null;
  purport: string | null;
  audioUrl: string | null;
  durationMs: number | null;
  malaAudioUrl: string | null;
  malaAudioStartMs: number | null;
  malaAudioEndMs: number | null;
  standardRounds: number | null;
  standardCount: number | null;
  prayer: Mantra | null;
  deity: Deity | null;
  guru: { id: string; slug: string; name: string; imageUrl?: string | null } | null;
}

export interface Overlay {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  size: number;
  style: 'body' | 'heading' | 'verse';
  color: 'light' | 'dark' | 'accent';
  align: 'left' | 'center' | 'right';
}

export interface Reel {
  id: string;
  mediaType: 'VIDEO' | 'IMAGE' | 'AUDIO';
  videoUrl: string | null;
  audioUrl: string | null;
  thumbnailUrl: string | null;
  media: { id: string; imageUrl: string; displayOrder: number }[];
  durationMs: number | null;
  width: number | null;
  height: number | null;
  caption: string | null;
  tags: string[];
  overlays: Overlay[];
  viewCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  isLiked: boolean;
  isSaved: boolean;
  isFollowingCreator: boolean;
  creator: { id: string; displayName: string; avatarUrl: string | null; isVerified: boolean; followerCount: number } | null;
  verse: { id: string; verseId: string; label: string | null } | null;
  mantra: { id: string; slug: string; name: string } | null;
}

export interface ReelComment {
  id: string;
  reelId: string;
  parentId: string | null;
  text: string | null;
  isHidden: boolean;
  likeCount: number;
  replyCount: number;
  isLiked: boolean;
  isMine: boolean;
  createdAt: string;
  author: { id: string; name: string | null; avatarUrl: string | null } | null;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  authProvider: string;
  appLanguage: string | null;
  mantraLanguage: string | null;
  readingLanguage: string | null;
  timezone: string | null;
  isPremium: boolean;
  role: string;
}

export interface Language {
  code: string;
  nativeName: string;
  englishName: string;
  isRtl: boolean;
  isAppLanguage: boolean;
  isMantraLanguage: boolean;
  isReadingLanguage: boolean;
}

export interface HomeData {
  date: string;
  slokaOfTheDay: { imageUrl: string | null; verse: Verse } | null;
  books: Book[];
  mantras: Mantra[];
  sadhana?: {
    today: { roundTarget: number; roundsCompleted: number; tasksTotal: number; tasksDone: number } | null;
    streak: number;
  };
  continueReading?: {
    book: Book;
    verseId: string | null;
    cantoNumber: number | null;
    chapterNumber: number | null;
    verseNumber: number | null;
  } | null;
}

export interface Credits {
  percent: number;
  limitedBy: 'daily' | 'wallet' | null;
  exhausted: boolean;
  canUpgrade: boolean;
  levelName?: string | null;
  resetsAt?: string | null;
  renewsAt?: string | null;
  enabled?: boolean;
}

export interface ChatMessage {
  id: string;
  seq: number;
  role: 'user' | 'assistant';
  content: string;
  imageUrl: string | null;
  status: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  title: string;
  messageCount: number;
  limitReached: 'MESSAGES' | 'TOKENS' | null;
  messages?: ChatMessage[];
}

export interface Plan {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  tier: number;
  isFree: boolean;
  prices: { id?: string; provider: string; priceMinor: number; currency: string; periodDays?: number; period?: string; trialDays?: number | null }[];
  sakha: { repliesPerMonth: number | null } | null;
  features: Record<string, { enabled: boolean; limit: number | null }>;
}
