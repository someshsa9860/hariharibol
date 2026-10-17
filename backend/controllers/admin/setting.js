// Runtime settings — the handful of values that can change without a deploy.
//
// Secrets are stored encrypted and never returned. The panel can see that a key
// is set and can replace it; it cannot read it back. An admin panel that
// displays API keys is an admin panel that leaks them the first time someone
// screenshots a bug.

import * as settings from '../../services/setting.js';
import * as audit from '../../services/audit.js';
import { USABLE_MODELS } from '../../utils/ai-free-tier.js';
import { ok } from '../../utils/respond.js';
import { badRequest } from '../../utils/errors.js';
import { parseTimeOfDay } from '../../utils/sloka-delivery.js';
import { SETTING_KEYS } from '../../config/constants.js';

// The keys the code actually reads, with what each is for. Listed so the panel
// can render a form of known settings rather than a free-text key/value editor
// where a typo silently does nothing.
const KNOWN = {
  [SETTING_KEYS.AI_PROVIDER]: {
    label: 'AI provider',
    help: 'GEMINI or OPENAI. Takes effect on the next AI call.',
    options: ['GEMINI', 'OPENAI'],
  },
  [SETTING_KEYS.AI_MODEL_TEXT]: {
    label: 'AI text model',
    help: 'Model name as the provider spells it, e.g. gemini-3.5-flash-lite (Google retires models; the 2.0 ones answer 404).',
  },
  // The next three are written by the switch on the AI usage page, which says what it does; listed here so they are
  // not shown as leftovers.
  [SETTING_KEYS.AI_FREE_TIER_ENABLED]: {
    label: 'Use OpenAI free tier',
    help: 'true or false. Normally set with the switch on the AI usage page.',
    options: ['true', 'false'],
  },
  [SETTING_KEYS.AI_FREE_TIER_TEXT_MODEL]: {
    label: 'Free-tier model for chat',
    help: `One of ${USABLE_MODELS.join(', ')}. Normally set on the AI usage page.`,
    options: USABLE_MODELS,
  },
  [SETTING_KEYS.AI_FREE_TIER_TRANSLATION_MODEL]: {
    label: 'Free-tier model for translations',
    help: `One of ${USABLE_MODELS.join(', ')}. Normally set on the AI usage page.`,
    options: USABLE_MODELS,
  },
  [SETTING_KEYS.AI_MONTHLY_BUDGET_MICROS]: {
    label: 'Monthly AI budget',
    help: 'In millionths of a dollar. AI calls stop once the month exceeds it. 0 means no cap.',
  },
  [SETTING_KEYS.SLOKA_DELIVERY_TIME]: {
    label: 'Sloka delivery time',
    help:
      'When the daily sloka is pushed, as HH:MM on a 24-hour clock in each reader’s own timezone ' +
      '(04:30 is the default). It is sent at the first half hour at or after this time.',
    timeOfDay: true,
  },
  [SETTING_KEYS.SIGNUP_ENABLED]: {
    label: 'Signups open',
    help: 'true or false. Existing accounts keep working when off.',
  },
  [SETTING_KEYS.BOOK_CACHE_VERSION]: {
    label: 'Offline book cache version',
    help:
      'A whole number, 1 or more. Raise it and every phone deletes the offline books it holds and ' +
      'downloads them again, the next time each book is opened. Leave it alone otherwise — an ' +
      'edited verse already reaches phones by itself.',
    integerMin: 1,
  },
};

/** GET /api/admin/settings */
export const list = async (req, res) => {
  const stored = await settings.listForAdmin();
  const byKey = new Map(stored.map((row) => [row.key, row]));

  const known = Object.entries(KNOWN).map(([key, meta]) => ({
    key,
    ...meta,
    ...(byKey.get(key) || { value: null, isSecret: false, isSet: false }),
  }));

  // Anything set but not in the catalogue — left over from an older version, or
  // written by hand. Shown so it can be cleaned up rather than lingering.
  const unknown = stored.filter((row) => !KNOWN[row.key]);

  return ok(res, { settings: known, unknown });
};

/** PUT /api/admin/settings/:key */
export const set = async (req, res) => {
  const { key } = req.valid.params;
  const { value, isSecret } = req.valid.body;

  const meta = KNOWN[key];
  if (meta?.options && !meta.options.includes(value)) {
    throw badRequest(`${key} must be one of: ${meta.options.join(', ')}`);
  }
  // Refused rather than stored: a value the reader of this setting cannot use
  // would be ignored without a word, and the admin would believe it had worked.
  if (meta?.integerMin !== undefined) {
    const n = Number(value);
    if (value.trim() === '' || !Number.isInteger(n) || n < meta.integerMin) {
      throw badRequest(`${key} must be a whole number, ${meta.integerMin} or more`);
    }
  }

  if (meta?.timeOfDay && parseTimeOfDay(value) === null) {
    throw badRequest(`${key} must be a time like 04:30 (24-hour, HH:MM)`);
  }

  const row = await settings.set(key, value, {
    isSecret: Boolean(isSecret),
    description: meta?.help,
    updatedById: req.auth.user.id,
  });

  await audit.record(req, {
    action: 'setting.update',
    entityType: 'AppSetting',
    entityId: key,
    // The value itself is never written to the audit log — services/audit.js
    // redacts it, because a secret in an audit row is still a secret on disk.
    after: { key, isSecret: Boolean(isSecret) },
  });

  return ok(res, { key: row.key, isSecret: row.isSecret, updatedAt: row.updatedAt });
};
