// Runtime settings — the handful of values that can change without a deploy.
//
// Secrets are stored encrypted and never returned. The panel can see that a key
// is set and can replace it; it cannot read it back. An admin panel that
// displays API keys is an admin panel that leaks them the first time someone
// screenshots a bug.

const settings = require('../../services/setting');
const audit = require('../../services/audit');
const { ok } = require('../../utils/respond');
const { badRequest } = require('../../utils/errors');
const { SETTING_KEYS } = require('../../config/constants');

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
    help: 'Model name as the provider spells it, e.g. gemini-2.0-flash.',
  },
  [SETTING_KEYS.AI_MONTHLY_BUDGET_MICROS]: {
    label: 'Monthly AI budget',
    help: 'In millionths of a dollar. AI calls stop once the month exceeds it. 0 means no cap.',
  },
  [SETTING_KEYS.SLOKA_DELIVERY_HOUR]: {
    label: 'Default sloka delivery hour',
    help: '0–23 in each user’s own timezone, used until the weekly learning finds a better one.',
  },
  [SETTING_KEYS.FREE_MOOD_SLOKA_QUOTA]: {
    label: 'Free mood slokas per month',
    help: 'How many a non-Premium user gets before the paywall. Set 0 to gate it completely.',
  },
  [SETTING_KEYS.SIGNUP_ENABLED]: {
    label: 'Signups open',
    help: 'true or false. Existing accounts keep working when off.',
  },
};

/** GET /api/admin/settings */
exports.list = async (req, res) => {
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
exports.set = async (req, res) => {
  const { key } = req.valid.params;
  const { value, isSecret } = req.valid.body;

  const meta = KNOWN[key];
  if (meta?.options && !meta.options.includes(value)) {
    throw badRequest(`${key} must be one of: ${meta.options.join(', ')}`);
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
