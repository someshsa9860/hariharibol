import { createRouter } from '../../utils/router.js';
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
      'featured mantras, and — when signed in — today’s practice, the personal sloka, where ' +
      'reading left off, the current streak and the unread count. Six calls on launch would ' +
      'mean six round trips while the user watches a spinner. Public: a signed-out visitor ' +
      'gets the shared sections and empty personal ones rather than an error.',
    public: true,
    limit: 'read',
    responds: { 200: 'The dashboard' },
  },
  controller.home
);

export default router;
