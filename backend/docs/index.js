// Serves the API reference.
//
// Scalar rather than Swagger UI: it reads the same OpenAPI document, looks
// considerably better, and renders a working request panel — which matters,
// because a reference nobody enjoys opening is a reference nobody reads.
//
// Three routes:
//   GET /docs              the reference
//   GET /docs/openapi.json the raw document, for Postman and code generators
//   GET /docs/routes       a flat list, for checking coverage at a glance

const express = require('express');
const { apiReference } = require('@scalar/express-api-reference');
const { build } = require('./openapi');
const { registry } = require('../utils/router');
const env = require('../config/env');

const router = express.Router();

// Built once per process. The registry is fixed after routes load, so
// rebuilding it per request would be work with no possible change in output.
let cached = null;
const spec = () => {
  if (!cached) cached = build();
  return cached;
};

router.get('/openapi.json', (req, res) => res.json(spec()));

router.get('/routes', (req, res) => {
  res.json({
    total: registry.length,
    routes: registry
      .filter((entry) => entry.fullPath)
      .map((entry) => ({
        method: entry.method.toUpperCase(),
        path: entry.fullPath,
        tag: entry.tag,
        summary: entry.meta.summary,
        auth: entry.meta.public ? 'public' : 'required',
        permission: entry.meta.permission || null,
        premium: Boolean(entry.meta.premium),
      }))
      .sort((a, b) => a.path.localeCompare(b.path)),
  });
});

router.use(
  '/',
  apiReference({
    spec: { content: () => spec() },
    theme: 'purple',
    metaData: { title: 'HariHariBol API' },
    hideDownloadButton: false,
  })
);

module.exports = { docsRouter: router, isEnabled: () => env.DOCS_ENABLED };
