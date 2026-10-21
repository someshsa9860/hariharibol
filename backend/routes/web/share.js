import { createRouter, z } from '../../utils/router.js';
import * as controller from '../../controllers/web/share.js';
import { CONTENT_ROUTES } from '../../utils/share.js';

const router = createRouter({
  tag: 'Website share',
  prefix: '',
  description:
    'What a shared link shows to someone who may not have the app. Anonymous. Content links are ' +
    'resolved from the canonical records on every visit; an invitation shows only the inviter’s first name.',
});

router.get(
  '/share/:route/:code',
  {
    summary: 'Resolve a shared content link',
    description: 'Route is `shloka`, `naam` or `darshan`. 404 for a code that never existed (or on the wrong route); 410 for one that was revoked or whose content is gone.',
    public: true,
    limit: 'read',
    params: z.object({ route: z.enum(Object.values(CONTENT_ROUTES)), code: z.string().min(8).max(16) }),
    query: z.object({ lang: z.string().max(10).optional() }),
    responds: { 200: 'Public content', 404: 'No such link', 410: 'Revoked or unavailable' },
  },
  controller.resolve
);

router.get(
  '/referral/:code',
  {
    summary: 'Check an invitation code',
    public: true,
    limit: 'read',
    params: z.object({ code: z.string().min(4).max(24) }),
    responds: { 200: '{ valid, code, referrerName }', 404: 'No such invitation' },
  },
  controller.inspect
);

router.get(
  '/app-links',
  {
    summary: 'Where to get the app',
    description: 'Store listings from configuration. A store that is not configured is null — the page then shows no badge for it.',
    public: true,
    limit: 'read',
    responds: { 200: '{ playStoreUrl, appStoreUrl, androidPackage, appScheme }' },
  },
  controller.appLinks
);

export default router;
