import { createRouter, z, schemas } from '../../utils/router.js';
import * as controller from '../../controllers/app/home.js';

const router = createRouter({
  tag: 'Home',
  prefix: '/home',
  description: 'The dashboard, assembled server-side so launch costs one round trip.',
});

router.get(
  '/',
  {
    summary: 'Get the dashboard',
    description:
      'Everything the first screen shows in a single call: the sloka of the day, the books, ' +
      'featured mantras, and — when signed in — today’s practice, the personal sloka, which ' +
      'vikaras have already been reported today, where reading left off, the current streak ' +
      'and the unread count. Six calls on launch would mean six round trips while the user ' +
      'watches a spinner. Public: a signed-out visitor gets the shared sections and empty ' +
      'personal ones rather than an error. `languages` (`hi,en`) names the reading ' +
      'languages for this call, which then win over the account’s saved ones — a phone ' +
      'changes its own language before the account hears of it.',
    public: true,
    limit: 'read',
    query: z.object({ languages: schemas.languages }),
    responds: { 200: 'The dashboard' },
  },
  controller.home
);

router.get(
  '/issue-verses',
  {
    summary: 'Verses for the vikaras I have reported lately',
    description:
      'For the Home row "For what you are working on". The vikaras this reader reported in the last two weeks ' +
      '(most reported first, at most three), each with up to two verses from the sloka mapping, skipping verses ' +
      'already given recently. The pick is fixed for the day, so a refresh does not reshuffle it. Empty when nothing ' +
      'was reported. Signed in only; no AI runs here. `languages` (`hi,en`) names the reading languages for this call, as ' +
      'on `GET /home`.',
    limit: 'read',
    query: z.object({ languages: schemas.languages }),
    responds: { 200: 'The verses, grouped by the issue they answer (possibly empty)' },
  },
  controller.issueVerses
);

export default router;
