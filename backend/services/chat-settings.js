// The chat persona, its description and its limits: what an admin edits without
// a deploy. Stored in AppSetting; the defaults live in config/chat.js and are
// used when a setting is absent, empty, or (for limits) unreadable.

import * as settings from './setting.js';
import { SETTING_KEYS } from '../config/constants.js';
import { DEFAULT_DESCRIPTION, DEFAULT_LIMITS, DEFAULT_SYSTEM_PROMPT } from '../config/chat.js';

export async function systemPrompt() {
  const stored = await settings.get(SETTING_KEYS.CHAT_SYSTEM_PROMPT, null);
  return stored && stored.trim() ? stored : DEFAULT_SYSTEM_PROMPT;
}

export async function description() {
  const stored = await settings.get(SETTING_KEYS.CHAT_DESCRIPTION, null);
  return stored && stored.trim() ? stored : DEFAULT_DESCRIPTION;
}

/** Limits, with any stored value that is not a sensible whole number replaced by its default. */
export async function limits() {
  let stored = {};
  try {
    stored = JSON.parse((await settings.get(SETTING_KEYS.CHAT_LIMITS, null)) || '{}') || {};
  } catch {
    stored = {};
  }
  const result = { ...DEFAULT_LIMITS };
  for (const key of Object.keys(DEFAULT_LIMITS)) {
    const value = stored[key];
    if (Number.isInteger(value) && value >= 0) result[key] = value;
  }
  // The window can never be smaller than what compaction leaves behind.
  result.recentMessages = Math.max(result.recentMessages, result.keepRecentOnCompact + 1, 2);
  result.maxOutputTokens = Math.max(result.maxOutputTokens, 64);
  result.maxInputChars = Math.max(result.maxInputChars, 1);
  return result;
}

export async function saveSystemPrompt(value, updatedById) {
  return settings.set(SETTING_KEYS.CHAT_SYSTEM_PROMPT, value ?? '', { description: 'AI chat persona and rules', updatedById });
}

export async function saveDescription(value, updatedById) {
  return settings.set(SETTING_KEYS.CHAT_DESCRIPTION, value ?? '', { description: 'AI chat description shown in the app', updatedById });
}

export async function saveLimits(value, updatedById) {
  return settings.set(SETTING_KEYS.CHAT_LIMITS, JSON.stringify(value), { description: 'AI chat limits (JSON)', updatedById });
}
