// Builds the OpenAPI document from the route registry.
//
// There is no hand-maintained spec file. Every route was declared through
// utils/router.js with its summary, description, schemas and responses
// attached, and this reads that back — so the docs cannot drift from the code,
// and an undocumented endpoint cannot exist in the first place (the router
// throws if a route is registered without a summary).

const { zodToJsonSchema } = require('zod-to-json-schema');
const { registry } = require('../utils/router');
const env = require('../config/env');
const pkg = require('../package.json');

// Express writes `:id`; OpenAPI wants `{id}`.
const toOpenApiPath = (path) => path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');

function schemaFor(zodSchema) {
  if (!zodSchema) return null;
  try {
    return zodToJsonSchema(zodSchema, { target: 'openApi3', $refStrategy: 'none' });
  } catch {
    return null;
  }
}

// Path and query parameters, flattened out of the zod object schemas.
function parametersFor(entry) {
  const parameters = [];

  for (const [source, location] of [
    ['params', 'path'],
    ['query', 'query'],
  ]) {
    const schema = schemaFor(entry.meta[source]);
    if (!schema?.properties) continue;

    for (const [name, property] of Object.entries(schema.properties)) {
      parameters.push({
        name,
        in: location,
        required: location === 'path' || (schema.required || []).includes(name),
        description: property.description,
        schema: property,
      });
    }
  }

  // Headers every client sends. Documented once here rather than repeated on
  // every route.
  parameters.push({
    name: 'X-Device-Id',
    in: 'header',
    required: false,
    description: 'Stable per-installation id. Used for device records and rate-limit keys.',
    schema: { type: 'string' },
  });

  return parameters;
}

function responsesFor(entry) {
  const responses = {};

  for (const [status, description] of Object.entries(entry.meta.responds || { 200: 'Success' })) {
    responses[status] = {
      description,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {},
              meta: { type: 'object' },
            },
          },
        },
      },
    };
  }

  // The failures every route can produce, so each one does not have to list them.
  if (!entry.meta.public) {
    responses[401] = { $ref: '#/components/responses/Unauthorized' };
    if (entry.meta.permission) {
      responses[403] = { $ref: '#/components/responses/Forbidden' };
    }
  }
  if (entry.meta.limit) {
    responses[429] = { $ref: '#/components/responses/RateLimited' };
  }
  responses[500] = { $ref: '#/components/responses/ServerError' };

  return responses;
}

// A line at the top of each description saying what it costs to call this:
// whether it needs a token, what permission, whether it is Premium-only.
function accessNote(meta) {
  const notes = [];
  if (meta.public) notes.push('**Public** — no token required.');
  else notes.push('**Requires a signed-in user.**');
  if (meta.permission) {
    notes.push(`Requires permission \`${[].concat(meta.permission).join('`, `')}\`.`);
  }
  if (meta.premium) notes.push('**Premium only.**');
  if (meta.limit) notes.push(`Rate limit group: \`${meta.limit}\`.`);
  return notes.join(' ');
}

function build() {
  const paths = {};
  const tags = new Map();

  for (const entry of registry) {
    // Never mounted — the route exists but no group picked it up.
    if (!entry.fullPath) continue;

    const path = toOpenApiPath(entry.fullPath);
    paths[path] = paths[path] || {};

    if (entry.tag && !tags.has(entry.tag)) {
      tags.set(entry.tag, { name: entry.tag, description: '' });
    }

    const bodySchema = schemaFor(entry.meta.body);

    paths[path][entry.method] = {
      tags: entry.tag ? [entry.tag] : undefined,
      summary: entry.meta.summary,
      description: [accessNote(entry.meta), entry.meta.description].filter(Boolean).join('\n\n'),
      security: entry.meta.public ? [] : [{ bearerAuth: [] }],
      parameters: parametersFor(entry),
      requestBody: bodySchema
        ? { required: true, content: { 'application/json': { schema: bodySchema } } }
        : undefined,
      responses: responsesFor(entry),
    };
  }

  return {
    openapi: '3.0.3',
    info: {
      title: 'HariHariBol API',
      version: pkg.version,
      description: [
        'Vedic verses, mantras, narrations and chanting.',
        '',
        '### Responses',
        'Every response has the same shape:',
        '```json',
        '{ "success": true, "data": {}, "meta": {} }',
        '{ "success": false, "error": { "code": "NOT_FOUND", "message": "…" } }',
        '```',
        '',
        '### Authentication',
        'Sign in with Google or Apple at `POST /api/app/auth/social` and send the access token',
        'as `Authorization: Bearer <token>`. Refresh tokens last a year and are re-issued on',
        'every use, so a client in regular use never asks anyone to sign in again. Presenting',
        'a refresh token that was already spent is treated as theft and revokes every session',
        'on the account.',
        '',
        '### Three languages',
        'Each user picks an app language, a mantra language and a reading language,',
        'independently. Mantra text resolves mantra → reading → app → en; meanings and',
        'translations resolve reading → app → en. A single mantra response may therefore',
        'combine two different language rows, which is intended.',
        '',
        '### Groups',
        '- `/api/app` — the mobile app',
        '- `/api/web` — the public website',
        '- `/api/admin` — the admin panel, permission-gated per endpoint',
        '- `/api/webhooks` — provider callbacks, authenticated by signature',
      ].join('\n'),
    },
    servers: [
      { url: env.API_BASE_URL, description: env.NODE_ENV },
      { url: 'https://api.hariharibol.com', description: 'production' },
    ],
    tags: [...tags.values()],
    paths,
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      responses: {
        Unauthorized: {
          description: 'Missing, expired or invalid access token. Refresh and retry.',
        },
        Forbidden: { description: 'Signed in, but this account lacks the required permission.' },
        RateLimited: { description: 'Too many requests. Back off and retry.' },
        ServerError: { description: 'Something went wrong on our side.' },
      },
    },
  };
}

module.exports = { build };
