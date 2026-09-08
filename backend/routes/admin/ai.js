import { createRouter, z, schemas } from '../../utils/router.js';
import * as controller from '../../controllers/admin/ai.js';

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
    query: schemas.page.extend({
      operation: z.string().max(50).optional(),
      provider: z.enum(['GEMINI', 'OPENAI']).optional(),
      succeeded: z.coerce.boolean().optional(),
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
