import { createRouter, z } from '../../utils/router.js';
import * as controller from '../../controllers/app/issue.js';

const router = createRouter({
  tag: 'Issues',
  prefix: '/issues',
  description:
    'What a user is struggling with — the six vikaras and the practice difficulties. A fixed, ' +
    'seeded list rather than free text, because these are what slokas are mapped to.',
});

router.get(
  '/',
  {
    summary: 'List issues',
    description:
      'The vocabulary the app offers. `VIKARA` covers kama, krodha, lobha, moha, mada and ' +
      'matsarya; `PRACTICE` covers missed chanting time and unmet round targets.',
    public: true,
    limit: 'read',
    query: z.object({ category: z.enum(['VIKARA', 'PRACTICE', 'OTHER']).optional() }),
    responds: { 200: 'Published issues in display order' },
  },
  controller.list
);

router.post(
  '/report',
  {
    summary: 'Report a struggle',
    description:
      'Records what someone is going through, without returning a sloka — that is ' +
      'POST /sloka/mood. Free on purpose: this is what the weekly learning is built from, ' +
      'and charging for it would make the data worse for everyone. Appended rather than ' +
      'overwritten, so the report can show whether something is easing.',
    limit: 'write',
    body: z.object({
      issueSlug: z.string().min(1).max(100),
      intensity: z.coerce.number().int().min(1).max(5).optional(),
      note: z.string().max(2000).optional(),
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    }),
    responds: { 201: 'The report', 404: 'No such issue' },
  },
  controller.report
);

router.get(
  '/mine',
  {
    summary: 'List my reports',
    description: 'The last 50, newest first.',
    limit: 'read',
    responds: { 200: 'Reports' },
  },
  controller.mine
);

router.get(
  '/trends',
  {
    summary: 'See which struggles are easing',
    description:
      'Counts per issue over the window, each compared against the previous window of the ' +
      'same length. The direction is the point — a raw count on its own says nothing about ' +
      'whether things are getting better.',
    limit: 'read',
    query: z.object({ days: z.coerce.number().int().min(7).max(365).optional() }),
    responds: { 200: 'Trends, most frequent first' },
  },
  controller.trends
);

export default router;
