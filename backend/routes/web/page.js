const { createRouter, z } = require('../../utils/router');
const controller = require('../../controllers/web/page');

const router = createRouter({
  tag: 'Pages',
  prefix: '/pages',
  description:
    'The only endpoints that return HTML rather than JSON. Privacy, terms and account ' +
    'deletion live here because both app stores require them at a stable URL that is ' +
    'reachable even while the website is mid-deploy.',
});

router.get(
  '/',
  {
    summary: 'List available pages',
    public: true,
    limit: 'read',
    responds: { 200: 'Page slugs, titles and URLs' },
  },
  controller.list
);

router.get(
  '/:slug',
  {
    summary: 'Render a page',
    description:
      'Returns HTML. The slug is matched against a fixed allowlist rather than used to look ' +
      'up a template path — rendering whatever arrived in the URL is how a template engine ' +
      'becomes a file read.',
    public: true,
    limit: 'read',
    params: z.object({ slug: z.enum(['privacy', 'terms', 'account-deletion']) }),
    responds: { 200: 'text/html', 404: 'No such page' },
  },
  controller.render
);

module.exports = router;
