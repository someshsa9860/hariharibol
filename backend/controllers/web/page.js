// Server-rendered pages.
//
// These return HTML, not JSON — the only endpoints in the API that do. They
// exist because the app stores require a privacy policy and terms at a stable,
// always-reachable URL, and hosting them here means they cannot go missing
// because the website was mid-deploy on review day.
//
// The templates are in views/pages.

import path from 'node:path';
import { notFound } from '../../utils/errors.js';
import env from '../../config/env.js';

// An allowlist, not a lookup by whatever arrived in the URL — rendering an
// arbitrary path from a request parameter is how a template engine turns into
// a file read.
const PAGES = {
  privacy: { template: 'privacy', title: 'Privacy Policy' },
  terms: { template: 'terms', title: 'Terms of Use' },
  'account-deletion': { template: 'account-deletion', title: 'Deleting Your Account' },
};

export const render = async (req, res) => {
  const page = PAGES[req.valid.params.slug];
  if (!page) throw notFound('Page');

  return res.render(path.join('pages', page.template), {
    title: page.title,
    appName: 'HariHariBol',
    webBaseUrl: env.WEB_BASE_URL,
    updatedAt: 'September 2026',
    year: new Date().getFullYear(),
  });
};

/** GET /api/web/pages — what is available, for the website to link to. */
export const list = async (req, res) => {
  return res.json({
    success: true,
    data: Object.entries(PAGES).map(([slug, page]) => ({
      slug,
      title: page.title,
      url: `${env.API_BASE_URL}/api/web/pages/${slug}`,
    })),
  });
};
