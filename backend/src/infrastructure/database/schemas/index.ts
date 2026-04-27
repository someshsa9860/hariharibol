import { Schema } from 'mongoose';

export const BanSchema = new Schema({
  type: { type: String, enum: ['email', 'device'], required: true },
  value: { type: String, required: true },
  reason: { type: String, required: true },
  cascaded_from: { type: Schema.Types.ObjectId, ref: 'Ban' },
  cascade_chain: [{ type: Schema.Types.ObjectId, ref: 'Ban' }],
  triggered_by: { type: String, enum: ['ai', 'admin'], required: true },
  admin_id: { type: Schema.Types.ObjectId, ref: 'User' },
  evidence_message_ids: [{ type: Schema.Types.ObjectId, ref: 'Message' }],
  created_at: { type: Date, default: Date.now },
  is_active: { type: Boolean, default: true },
  unbanned_at: Date,
  unbanned_by: { type: Schema.Types.ObjectId, ref: 'User' },
  unban_reason: String,
});

export const SampradayaSchema = new Schema({
  slug: { type: String, unique: true, required: true },
  name_key: { type: String, required: true },
  description_key: String,
  short_description_key: String,
  founder_key: String,
  founder_image_url: String,
  primary_deity_key: String,
  primary_deity_image_url: String,
  philosophy_key: String,
  key_disciples: [
    {
      name_key: String,
      description_key: String,
      image_url: String,
    },
  ],
  hero_image_url: String,
  thumbnail_url: String,
  category_keys: [String],
  founding_year: Number,
  region_key: String,
  is_published: { type: Boolean, default: false },
  display_order: { type: Number, default: 0 },
  follower_count: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

export const BookSchema = new Schema({
  slug: { type: String, unique: true, required: true },
  title_key: { type: String, required: true },
  description_key: String,
  cover_image_url: String,
  author_key: String,
  total_chapters: Number,
  total_verses: Number,
  display_order: Number,
  is_published: { type: Boolean, default: false },
});

export const ChapterSchema = new Schema({
  book_id: { type: Schema.Types.ObjectId, ref: 'Book', required: true },
  number: { type: Number, required: true },
  title_key: { type: String, required: true },
  summary_key: String,
  total_verses: Number,
});

export const VerseSchema = new Schema({
  book_id: { type: Schema.Types.ObjectId, ref: 'Book', required: true },
  chapter_id: { type: Schema.Types.ObjectId, ref: 'Chapter', required: true },
  chapter_number: { type: Number, required: true },
  verse_number: { type: Number, required: true },
  sanskrit: String,
  transliteration: String,
  word_meanings: [
    {
      word: String,
      meaning_key: String,
    },
  ],
  translation_key: String,
  category_keys: [String],
  related_sampraday_ids: [{ type: Schema.Types.ObjectId, ref: 'Sampraday' }],
  related_deity_keys: [String],
  audio_url: String,
  is_verse_of_day_eligible: { type: Boolean, default: false },
});

export const NarrationSchema = new Schema({
  verse_id: { type: Schema.Types.ObjectId, ref: 'Verse', required: true },
  saint_name_key: { type: String, required: true },
  saint_image_url: String,
  source_key: String,
  source_year: Number,
  narration_key: { type: String, required: true },
  sampraday_id: { type: Schema.Types.ObjectId, ref: 'Sampraday' },
  display_order: { type: Number, default: 0 },
  is_published: { type: Boolean, default: false },
});

export const MantraSchema = new Schema({
  sampraday_id: { type: Schema.Types.ObjectId, ref: 'Sampraday', required: true },
  name_key: { type: String, required: true },
  sanskrit: String,
  transliteration: String,
  meaning_key: String,
  significance_key: String,
  audio_url: String,
  is_public: { type: Boolean, default: true },
  recommended_count: { type: Number, default: 108 },
  category: {
    type: String,
    enum: ['mahamantra', 'beej', 'stotra', 'name', 'other'],
    default: 'mahamantra',
  },
  related_deity_key: String,
  display_order: Number,
});

export const TranslationSchema = new Schema({
  key: { type: String, required: true, unique: true },
  namespace: { type: String, enum: ['ui', 'content'], required: true },
  translations: {
    type: Map,
    of: {
      text: String,
      status: { type: String, enum: ['draft', 'review', 'approved'], default: 'draft' },
      translated_by: { type: Schema.Types.ObjectId, ref: 'User' },
      reviewed_by: { type: Schema.Types.ObjectId, ref: 'User' },
      updated_at: Date,
    },
    default: new Map(),
  },
});

export const LanguageSchema = new Schema({
  code: { type: String, required: true, unique: true },
  name_native: String,
  name_english: String,
  is_rtl: { type: Boolean, default: false },
  is_active: { type: Boolean, default: true },
  display_order: Number,
  fallback_code: { type: String, default: 'en' },
});

export const ChantLogSchema = new Schema({
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  mantra_id: { type: Schema.Types.ObjectId, ref: 'Mantra', required: true },
  count: { type: Number, required: true },
  duration_seconds: Number,
  date: { type: Date, required: true },
  created_at: { type: Date, default: Date.now },
});

export const FavoriteSchema = new Schema({
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['verse', 'mantra', 'narration'], required: true },
  target_id: { type: Schema.Types.ObjectId, required: true },
  created_at: { type: Date, default: Date.now },
});

FavoriteSchema.index({ user_id: 1, type: 1, target_id: 1 }, { unique: true });

export const FollowSchema = new Schema({
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  sampraday_id: { type: Schema.Types.ObjectId, ref: 'Sampraday', required: true },
  created_at: { type: Date, default: Date.now },
});

FollowSchema.index({ user_id: 1, sampraday_id: 1 }, { unique: true });

export const GroupSchema = new Schema({
  sampraday_id: { type: Schema.Types.ObjectId, ref: 'Sampraday', required: true },
  name_key: { type: String, required: true },
  description_key: String,
  member_count: { type: Number, default: 0 },
  is_active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
});

export const GroupMemberSchema = new Schema({
  group_id: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['member', 'moderator', 'admin'], default: 'member' },
  joined_at: { type: Date, default: Date.now },
  last_read_at: Date,
});

export const MessageSchema = new Schema({
  group_id: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'hidden'], default: 'pending' },
  moderation: {
    ai_verdict: { type: String, enum: ['safe', 'disrespectful', 'spam', 'off_topic'] },
    ai_confidence: Number,
    ai_reason: String,
    reviewed_by_admin: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewed_at: Date,
  },
  hidden_reason: String,
  created_at: { type: Date, default: Date.now },
});

export const ChatbotSessionSchema = new Schema({
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: String,
  guru_persona_used: String,
  message_count: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

export const ChatbotMessageSchema = new Schema({
  session_id: { type: Schema.Types.ObjectId, ref: 'ChatbotSession', required: true },
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  citations: [
    {
      verse_id: { type: Schema.Types.ObjectId, ref: 'Verse' },
      excerpt: String,
    },
  ],
  tokens_used: Number,
  created_at: { type: Date, default: Date.now },
});
