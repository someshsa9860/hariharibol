import { Schema } from 'mongoose';

export const DeviceSchema = new Schema({
  device_id: { type: String, required: true, unique: true },
  device_type: { type: String, enum: ['ios', 'android'], required: true },
  device_model: String,
  os_version: String,
  app_version: String,
  user_ids: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  push_tokens: {
    fcm: String,
    apns: String,
  },
  is_banned: { type: Boolean, default: false },
  banned_reason: String,
  banned_at: Date,
  first_seen_at: { type: Date, default: Date.now },
  last_seen_at: { type: Date, default: Date.now },
});

DeviceSchema.index({ device_id: 1 });
