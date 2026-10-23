import { createRouter, z, schemas } from '../../utils/router.js';
import * as controller from '../../controllers/admin/ai.js';
import { USABLE_MODELS } from '../../utils/ai-free-tier.js';
import { BONUS_LIMITS } from '../../utils/ai-bonus.js';

const router = createRouter({
  tag: 'Admin · AI',
  prefix: '/ai',
  description:
    'Spend, coverage and the batch passes. The rule these screens keep honest: AI never runs ' +
    'on a user request. Every model call happens in a job, ahead of time, and writes into ' +
    'tables the app then reads with an ordinary query — so spend tracks the size of the ' +
    'corpus, not the number of users.',
});

router.get(
  '/usage',
  {
    summary: 'List AI calls',
    description: 'Every call with its tokens, cost and outcome. Filter by operation to attribute spend.',
    permission: 'ai.read',
    limit: 'read',
    query: schemas.sorted(controller.SORT_COLUMNS).extend({
      operation: z.string().max(50).optional(),
      provider: z.enum(['GEMINI', 'OPENAI']).optional(),
      succeeded: schemas.flag.optional(),
    }),
    responds: { 200: 'A page of usage records' },
  },
  controller.usage
);

router.get(
  '/spend',
  {
    summary: 'Get AI spend',
    description:
      'Cost per operation over the window, and the month to date. Everything is in millionths ' +
      'of a dollar as an integer — summing floats over hundreds of thousands of calls drifts.',
    permission: 'ai.read',
    limit: 'read',
    query: z.object({ days: z.coerce.number().int().min(1).max(365).optional() }),
    responds: { 200: 'Spend by operation' },
  },
  controller.spend
);

router.get(
  '/coverage',
  {
    summary: 'See what the batch passes have reached',
    description: 'Eligible verses against those mapped to struggles and those with an explanation.',
    permission: 'ai.read',
    limit: 'read',
    responds: { 200: 'Coverage counts and what remains' },
  },
  controller.coverage
);

router.get(
  '/free-tier',
  {
    summary: 'Get the OpenAI free-tier switch',
    description:
      'Whether the free daily tokens are used, which model stands in for chat, how much of each pool this app ' +
      'has used today (UTC), and which provider and model chat would use right now.',
    permission: 'ai.read',
    limit: 'read',
    responds: { 200: 'The switch, the pools and what is in use' },
  },
  controller.getFreeTier
);

router.put(
  '/free-tier',
  {
    summary: 'Switch the OpenAI free tier on or off',
    description:
      'While on, chat uses OpenAI’s free daily tokens first (book translation never does) — which sends what ' +
      'readers write to OpenAI under its data-sharing programme — and fall back to the paid model when the ' +
      'day’s tokens are spent. While it is on, every reader also gets a daily bonus of chat tokens: `bonusPoolTokens` ' +
      'shared among the readers who used the chat this week, at most `bonusMaxPerUser` each. Turn it off before turning ' +
      'data sharing off at OpenAI. Send only what changed.',
    permission: 'setting.write',
    limit: 'write',
    body: z.object({
      enabled: z.boolean().optional(),
      textModel: z.enum(USABLE_MODELS).optional(),
      bonusPoolTokens: z.number().int().min(0).max(BONUS_LIMITS.poolTokens.max).optional(),
      bonusMaxPerUser: z.number().int().min(0).max(BONUS_LIMITS.maxPerUser.max).optional(),
    }),
    responds: { 200: 'The new state, as GET returns it' },
  },
  controller.saveFreeTier
);

router.post(
  '/jobs/issue-map',
  {
    summary: 'Queue the verse-to-struggle mapping pass',
    description:
      'Proposes which struggles each verse speaks to, and how directly. It writes suggestions, ' +
      'not truth — the pool it fills is what someone in the middle of krodha is handed, so an ' +
      'editor should confirm what it proposes. Use `dryRun` to see the suggestions without ' +
      'writing them.',
    permission: 'ai.run',
    limit: 'ai',
    body: z.object({
      bookNumber: z.coerce.number().int().min(1).max(2).optional(),
      limit: z.coerce.number().int().min(1).max(500).optional(),
      dryRun: z.boolean().optional(),
    }),
    responds: { 200: 'The queued job id' },
  },
  controller.runIssueMap
);

router.post(
  '/jobs/explanations',
  {
    summary: 'Queue the explanation-writing pass',
    description:
      'Writes a short plain-language note per verse per language, unpublished, for an editor ' +
      'to read first. Stored in VerseExplanation and never in VerseTranslation — generated ' +
      'text must not be able to appear as an acharya’s purport.',
    permission: 'ai.run',
    limit: 'ai',
    body: z.object({
      languageCode: z.string().max(10).optional(),
      bookNumber: z.coerce.number().int().min(1).max(2).optional(),
      limit: z.coerce.number().int().min(1).max(500).optional(),
    }),
    responds: { 200: 'The queued job id' },
  },
  controller.runExplanations
);

export default router;
