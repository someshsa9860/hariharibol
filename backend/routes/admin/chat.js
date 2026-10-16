import { createRouter, z, schemas } from '../../utils/router.js';
import * as controller from '../../controllers/admin/chat.js';

const router = createRouter({
  tag: 'Admin · AI chat',
  prefix: '/chat',
  description:
    'The devotional assistant’s persona and limits, the allowance each plan gets, and individual ' +
    'token wallets. Raw token numbers appear only here — readers see a percentage.',
});

const count = z.coerce.number().int().min(0).max(2_000_000_000);

router.get(
  '/settings',
  {
    summary: 'Get the persona and limits',
    description: 'Current values beside the built-in defaults, so the panel can offer "reset".',
    permission: 'chat.manage',
    limit: 'read',
    responds: { 200: 'Settings' },
  },
  controller.getSettings
);

router.put(
  '/settings',
  {
    summary: 'Save the persona and limits',
    description:
      'Send only what changed. An empty `systemPrompt` or `description` restores the default. `limits` ' +
      'replaces the whole object. Applies to the next message.',
    permission: 'chat.manage',
    limit: 'write',
    body: z.object({
      systemPrompt: z.string().max(20000).optional(),
      description: z.string().max(1000).optional(),
      limits: z
        .object({
          recentMessages: z.number().int().min(2).max(100),
          compactAtTokens: z.number().int().min(200).max(100000),
          keepRecentOnCompact: z.number().int().min(0).max(50),
          summaryMaxTokens: z.number().int().min(100).max(4000),
          maxMessages: z.number().int().min(0).max(10000),
          maxOutputTokens: z.number().int().min(64).max(8000),
          maxInputChars: z.number().int().min(100).max(20000),
        })
        .optional(),
    }),
    responds: { 200: 'Saved settings' },
  },
  controller.saveSettings
);

router.get(
  '/plans',
  {
    summary: 'Plans with their chat allowance',
    description: '`config: null` means the plan uses the free plan’s allowance.',
    permission: 'chat.manage',
    limit: 'read',
    responds: { 200: 'Plans' },
  },
  controller.listPlans
);

router.put(
  '/plans/:planId',
  {
    summary: 'Set a plan’s chat allowance',
    description:
      'Daily cap (0 = none), wallet size (what 100% means) and whether it renews monthly, the per-' +
      'conversation limit (0 = none) and the model tier. Raising a wallet size credits existing wallets ' +
      'the difference the next time each is used.',
    permission: 'chat.manage',
    limit: 'write',
    params: z.object({ planId: z.string().min(1) }),
    body: z.object({
      levelName: z.string().trim().min(1).max(50),
      isEnabled: z.boolean(),
      dailyTokens: count,
      walletTokens: count,
      renewal: z.enum(['MONTHLY', 'NEVER']),
      conversationTokens: count,
      modelTier: z.enum(['BASIC', 'ADVANCED']),
    }),
    responds: { 200: 'Saved', 404: 'No such plan' },
  },
  controller.savePlan
);

router.get(
  '/wallets',
  {
    summary: 'Find wallets',
    description: 'Users with their wallet balance, searchable by email or name.',
    permission: 'chat.manage',
    limit: 'read',
    query: schemas.page,
    responds: { 200: 'A page of users and wallets' },
  },
  controller.listWallets
);

router.get(
  '/users/:userId',
  {
    summary: 'A user’s wallet and ledger',
    permission: 'chat.manage',
    limit: 'read',
    params: z.object({ userId: z.string().min(1) }),
    responds: { 200: 'Wallet, last 50 transactions', 404: 'No such user' },
  },
  controller.getUser
);

router.post(
  '/users/:userId/grant',
  {
    summary: 'Grant tokens',
    description: 'Adds tokens to the wallet (ledger source ADMIN_GRANT). Recorded in the audit log.',
    permission: 'chat.manage',
    limit: 'write',
    params: z.object({ userId: z.string().min(1) }),
    body: z.object({ tokens: count.refine((n) => n > 0, 'must be more than 0'), note: z.string().trim().min(1).max(300) }),
    responds: { 200: 'New balance' },
  },
  controller.grant
);

router.post(
  '/users/:userId/adjust',
  {
    summary: 'Adjust tokens',
    description: 'A signed correction: positive adds, negative removes (ledger source ADMIN_ADJUST).',
    permission: 'chat.manage',
    limit: 'write',
    params: z.object({ userId: z.string().min(1) }),
    body: z.object({
      tokens: z.number().int().min(-2_000_000_000).max(2_000_000_000).refine((n) => n !== 0, 'must not be 0'),
      note: z.string().trim().min(1).max(300),
    }),
    responds: { 200: 'New balance' },
  },
  controller.adjust
);

router.get(
  '/stats',
  {
    summary: 'Chat usage, last 30 days',
    permission: 'chat.manage',
    limit: 'read',
    responds: { 200: 'Tokens by source, conversations, messages, active users' },
  },
  controller.stats
);

export default router;
