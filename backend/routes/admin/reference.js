// Reference data. Six resources with identical handlers, so they share one
// route file and one builder — but each keeps its own path, so the URL is what
// you would guess.

import { createRouter, z, schemas } from '../../utils/router.js';
import * as controller from '../../controllers/admin/reference.js';

const router = createRouter({
  tag: 'Admin · Reference data',
  prefix: '/reference',
  description:
    'Deities, gurus, translators, languages, issues and push topics. Seeded and then managed ' +
    'here, so adding one is a data change rather than a release.',
});

const listQuery = schemas.page;

// Registers list/get/create/update/delete for one resource. Every route still
// gets its own summary — the docs are per-endpoint, not per-resource.
function resource(path, name, handlers, { create, update, permission = 'reference.manage' }) {
  router.get(
    `/${path}`,
    {
      summary: `List ${name}`,
      permission,
      limit: 'read',
      query: listQuery,
      responds: { 200: `A page of ${name}` },
    },
    handlers.list
  );

  router.get(
    `/${path}/:id`,
    {
      summary: `Get one ${name.replace(/s$/, '')}`,
      permission,
      limit: 'read',
      params: schemas.id,
      responds: { 200: 'The record', 404: 'Not found' },
    },
    handlers.get
  );

  router.post(
    `/${path}`,
    {
      summary: `Create a ${name.replace(/s$/, '')}`,
      permission,
      limit: 'write',
      body: create,
      responds: { 201: 'The record', 409: 'Slug or code already used' },
    },
    handlers.create
  );

  router.patch(
    `/${path}/:id`,
    {
      summary: `Update a ${name.replace(/s$/, '')}`,
      permission,
      limit: 'write',
      params: schemas.id,
      body: update,
      responds: { 200: 'The record', 404: 'Not found' },
    },
    handlers.update
  );

  router.delete(
    `/${path}/:id`,
    {
      summary: `Delete a ${name.replace(/s$/, '')}`,
      permission,
      limit: 'write',
      params: schemas.id,
      responds: { 204: 'Deleted', 404: 'Not found' },
    },
    handlers.remove
  );
}

// ── Deities and gurus ──────────────────────────────────────────────────────

const namedBody = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/).max(100),
  name: z.string().min(1).max(200),
  nameI18n: z.record(z.string()).optional(),
  description: z.string().max(5000).optional(),
  imagePath: z.string().max(500).nullable().optional(),
  sampradaya: z.string().max(50).optional(),
  displayOrder: z.coerce.number().int().optional(),
  isPublished: z.boolean().optional(),
});

resource('deities', 'deities', controller.deity, {
  create: namedBody,
  update: namedBody.partial(),
});

resource('gurus', 'gurus', controller.guru, {
  create: namedBody,
  update: namedBody.partial(),
});

// ── Translators ────────────────────────────────────────────────────────────

const translatorBody = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/).max(100),
  name: z.string().min(1).max(200),
  nameI18n: z.record(z.string()).optional(),
  bio: z.string().max(5000).optional(),
  imagePath: z.string().max(500).nullable().optional(),
  sampradaya: z.string().max(50).optional(),
  displayOrder: z.coerce.number().int().optional(),
  isPublished: z.boolean().optional(),
});

resource('translators', 'translators', controller.translator, {
  create: translatorBody,
  update: translatorBody.partial(),
  permission: 'translator.manage',
});

// ── Languages ──────────────────────────────────────────────────────────────

const languageBody = z.object({
  code: z.string().min(2).max(10),
  nativeName: z.string().min(1).max(100),
  englishName: z.string().min(1).max(100),
  isRtl: z.boolean().optional(),
  // Which of the three slots this language may be chosen for. Sanskrit is a
  // mantra language and not an app language, and the settings screen reads
  // these flags to grey out what does not apply.
  isAppLanguage: z.boolean().optional(),
  isMantraLanguage: z.boolean().optional(),
  isReadingLanguage: z.boolean().optional(),
  isActive: z.boolean().optional(),
  displayOrder: z.coerce.number().int().optional(),
});

resource('languages', 'languages', controller.language, {
  create: languageBody,
  update: languageBody.partial(),
});

router.delete(
  '/languages/:id/force',
  {
    summary: 'Delete a language, if nobody uses it',
    description:
      'Refused while any account has it selected — their profile would point at a code that ' +
      'no longer exists. Deactivate it instead: that hides it from the picker while leaving ' +
      'existing choices intact.',
    permission: 'reference.manage',
    limit: 'write',
    params: schemas.id,
    responds: { 200: 'Deleted', 400: 'Still selected by some accounts' },
  },
  controller.deleteLanguage
);

// ── Issues ─────────────────────────────────────────────────────────────────

const issueBody = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/).max(100),
  name: z.string().min(1).max(200),
  nameI18n: z.record(z.string()).optional(),
  description: z.string().max(5000).optional(),
  category: z.enum(['VIKARA', 'PRACTICE', 'OTHER']),
  imagePath: z.string().max(500).nullable().optional(),
  displayOrder: z.coerce.number().int().optional(),
  isPublished: z.boolean().optional(),
});

// Registered before the /issues/:id route below: express matches in order, and
// '/issues/coverage' would otherwise be read as an id of "coverage".
router.get(
  '/issues/coverage',
  {
    summary: 'Check how many verses each struggle has',
    description:
      'An issue with nothing mapped to it fails silently: a user reports it, the picker finds ' +
      'nothing, and they get a fallback verse unrelated to what they said. `isThin` flags ' +
      'anything under five. Nothing else in the panel would show this.',
    permission: 'sloka.manage',
    limit: 'read',
    responds: { 200: 'Issues with mapped-verse counts' },
  },
  controller.issueCoverage
);

resource('issues', 'issues', controller.issue, {
  create: issueBody,
  update: issueBody.partial(),
});

// ── Push topics ────────────────────────────────────────────────────────────

const topicBody = z.object({
  key: z.string().regex(/^[a-zA-Z0-9-_.~%]+$/).max(100),
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
});

resource('topics', 'topics', controller.topic, {
  create: topicBody,
  update: topicBody.partial(),
  permission: 'notification.send',
});

export default router;
