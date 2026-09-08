// The express app.
//
// Reading this file alone should tell you every route family the API exposes,
// and the order every request passes through. Nothing is mounted anywhere else.
//
// Request order:
//   1. security headers, compression, CORS
//   2. body parsing (keeping the raw bytes — webhook signatures need them)
//   3. request context: id, device, platform, language
//   4. auth — establishes *who* is asking, never whether they may
//   5. the route groups, where each route declares its own access rules
//   6. 404, then the error handler
//
// The split at step 4 is the one worth knowing about: middleware/auth.js only
// identifies the caller. utils/router.js is what refuses the request, and it
// requires a signed-in user for every route unless that route says
// `public: true` — so forgetting to guard something is not possible.

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const pinoHttp = require('pino-http');
const path = require('node:path');

const env = require('./config/env');
const logger = require('./config/logger');
const corsOptions = require('./config/cors');

const context = require('./middleware/context');
const auth = require('./middleware/auth');
const { errorHandler, notFound } = require('./middleware/error');

const app = express();

// Behind a load balancer in production; without this, req.ip is the balancer
// and every rate limit is shared by the entire internet.
app.set('trust proxy', 1);
app.disable('x-powered-by');

// Server-rendered HTML: emails, legal pages, deeplink landings (rule 10).
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ── 1. Security and transport ──────────────────────────────────────────────

app.use(
  helmet({
    // The docs page loads its own styles and scripts inline.
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(cors(corsOptions));
app.use(compression());

// ── 2. Body parsing ────────────────────────────────────────────────────────

app.use(
  express.json({
    limit: '1mb',
    // Razorpay signs the raw bytes. Re-serialising the parsed object changes
    // whitespace and key order, and the signature then never matches.
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── 3. Context and logging ─────────────────────────────────────────────────

app.use(context);
app.use(
  pinoHttp({
    logger,
    genReqId: (req) => req.id,
    autoLogging: {
      // Health checks would otherwise be most of the log volume.
      ignore: (req) => req.url === '/health' || req.url === '/',
    },
  })
);

// ── 4. Identify the caller ─────────────────────────────────────────────────

app.use(auth);

// ── Health ─────────────────────────────────────────────────────────────────
// Before the route groups, and deliberately trivial: a health check that
// touches the database reports the database's health, not the container's, and
// takes the container out of rotation for a problem it cannot fix.

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'api', env: env.NODE_ENV, at: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.json({
    name: 'HariHariBol API',
    docs: env.DOCS_ENABLED ? `${env.API_BASE_URL}/docs` : null,
  });
});

// ── 5. Route groups ────────────────────────────────────────────────────────
// Four groups, four audiences. This is the whole API surface.

app.use('/api/app', require('./routes/app')); //      the mobile app
app.use('/api/web', require('./routes/web')); //      the public website
app.use('/api/admin', require('./routes/admin')); //  the admin panel
app.use('/api/webhooks', require('./routes/webhook')); // provider callbacks

// ── API reference ──────────────────────────────────────────────────────────
// Mounted after the routes, because it reads the registry those routes filled.

const { docsRouter, isEnabled } = require('./docs');
if (isEnabled()) {
  app.use('/docs', docsRouter);
  logger.info(`API reference at ${env.API_BASE_URL}/docs`);
}

// ── 6. Failure ─────────────────────────────────────────────────────────────

app.use(notFound);
app.use(errorHandler);

module.exports = app;
