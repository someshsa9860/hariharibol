import { Schema } from 'mongoose';

export const UserSchema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  email_verified: { type: Boolean, default: true },
  name: String,
  avatar_url: String,
  auth_provider: {
    type: String,
    enum: ['google', 'apple'],
    required: true,
  },
  provider_user_id: { type: String, required: true, unique: true },
  language_preference: { type: String, default: 'en' },
  followed_sampradayas: [{ type: Schema.Types.ObjectId, ref: 'Sampraday' }],
  preferred_guru_signal: {
    sampraday_affinity: { type: Map, of: Number, default: new Map() },
    deity_affinity: { type: Map, of: String, default: new Map() },
    last_calculated: Date,
  },
  is_banned: { type: Boolean, default: false },
  banned_reason: String,
  banned_at: Date,
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  last_active_at: { type: Date, default: Date.now },
});

UserSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});
