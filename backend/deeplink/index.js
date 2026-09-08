// The deeplink container.
//
// Its whole job is to be the thing on the end of a shared link. Someone sends a
// verse to a friend; the friend taps it. If they have the app, it should open
// on that verse. If they do not, they should land on a page showing the verse
// and offering the app — not on a broken screen or an app-store search.
//
// It runs separately from the API for two reasons. It is the most-linked-to and
// least-authenticated surface we have, so a crawler storm on it must not take
// request handling with it. And it serves the Apple and Android association
// files, which have to be available at the domain root with exact headers —
// easier to guarantee in a container that serves almost nothing else.

const express = require('express');
const path = require('node:path');

const env = require('../config/env');
const logger = require('../config/logger');
const { prisma, connectDatabase, disconnectDatabase } = require('../config/database');
const s3 = require('../services/s3');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.disable('x-powered-by');

app.get('/health', (req, res) => res.json({ ok: true }));

// ── Association files ──────────────────────────────────────────────────────
// Served from the app's own configuration rather than as static files, so the
// bundle ids live in one place. Both must be application/json and must not
// redirect — iOS and Android both refuse them otherwise.

app.get('/.well-known/apple-app-site-association', (req, res) => {
  res.type('application/json').json({
    applinks: {
      apps: [],
      details: env.appleBundleIds.map((bundleId) => ({
        appID: bundleId,
        paths: ['/verse/*', '/sloka/*', '/mantra/*', '/book/*'],
      })),
    },
  });
});

app.get('/.well-known/assetlinks.json', (req, res) => {
  res.type('application/json').json([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: env.GOOGLE_PLAY_PACKAGE_NAME,
        // Filled from the signing certificate. Left empty rather than wrong:
        // a mismatched fingerprint silently disables Android app links, and a
        // placeholder that looks real is harder to notice than an empty list.
        sha256_cert_fingerprints: [],
      },
    },
  ]);
});

// ── Landing pages ──────────────────────────────────────────────────────────

// What every landing page needs: the app scheme to try, and the store links to
// fall back to.
function appLinks(target) {
  return {
    appUrl: `${env.APP_SCHEME}://${target}`,
    androidUrl: `https://play.google.com/store/apps/details?id=${env.GOOGLE_PLAY_PACKAGE_NAME}`,
    iosUrl: 'https://apps.apple.com/app/hariharibol/id0000000000',
    webUrl: env.WEB_BASE_URL,
  };
}

app.get('/verse/:verseId', async (req, res, next) => {
  try {
    const verse = await prisma.verse.findUnique({
      where: { verseId: req.params.verseId },
      include: {
        book: { select: { title: true, slug: true, isPublished: true } },
        translations: {
          where: { isPublished: true, languageCode: 'en' },
          select: { meaning: true },
          take: 1,
        },
      },
    });

    if (!verse || !verse.book.isPublished) {
      return res.status(404).render('deeplink/not-found', { ...appLinks('') });
    }

    return res.render('deeplink/open', {
      title: `${verse.book.title} ${verse.verseId}`,
      // Open Graph tags are the point of rendering this server-side: a link
      // pasted into WhatsApp should preview the verse, not the app name.
      description: verse.translations[0]?.meaning?.slice(0, 200) || verse.sanskrit,
      sanskrit: verse.sanskrit,
      meaning: verse.translations[0]?.meaning || null,
      imageUrl: null,
      canonicalUrl: `${env.WEB_BASE_URL}/verse/${verse.verseId}`,
      ...appLinks(`verse/${verse.verseId}`),
    });
  } catch (err) {
    return next(err);
  }
});

app.get('/sloka/:date', async (req, res, next) => {
  try {
    const sloka = await prisma.dailySloka.findFirst({
      where: { date: new Date(`${req.params.date}T00:00:00.000Z`), isPublished: true },
      include: {
        verse: {
          include: {
            book: { select: { title: true } },
            translations: {
              where: { isPublished: true, languageCode: 'en' },
              select: { meaning: true },
              take: 1,
            },
          },
        },
      },
    });

    if (!sloka) {
      return res.status(404).render('deeplink/not-found', { ...appLinks('') });
    }

    return res.render('deeplink/open', {
      title: `Sloka for ${req.params.date}`,
      description: sloka.verse.translations[0]?.meaning?.slice(0, 200) || sloka.verse.sanskrit,
      sanskrit: sloka.verse.sanskrit,
      meaning: sloka.verse.translations[0]?.meaning || null,
      imageUrl: sloka.imagePath ? await s3.presignGet(sloka.imagePath) : null,
      canonicalUrl: `${env.WEB_BASE_URL}/sloka/${req.params.date}`,
      ...appLinks(`sloka/${req.params.date}`),
    });
  } catch (err) {
    return next(err);
  }
});

app.get('/mantra/:slug', async (req, res, next) => {
  try {
    const mantra = await prisma.mantra.findFirst({
      where: { slug: req.params.slug, isPublished: true },
      select: { name: true, description: true, sanskrit: true, slug: true },
    });

    if (!mantra) {
      return res.status(404).render('deeplink/not-found', { ...appLinks('') });
    }

    return res.render('deeplink/open', {
      title: mantra.name,
      description: mantra.description?.slice(0, 200) || mantra.name,
      sanskrit: mantra.sanskrit,
      meaning: mantra.description,
      imageUrl: null,
      canonicalUrl: `${env.WEB_BASE_URL}/mantra/${mantra.slug}`,
      ...appLinks(`mantra/${mantra.slug}`),
    });
  } catch (err) {
    return next(err);
  }
});

// Anything else gets the app, not a 404 page — an unknown path is more likely a
// link we changed than a link that never worked.
app.use((req, res) => {
  res.status(404).render('deeplink/not-found', { ...appLinks('') });
});

// eslint-disable-next-line no-unused-vars -- express identifies this by arity
app.use((err, req, res, next) => {
  logger.error({ err, path: req.originalUrl }, 'deeplink error');
  res.status(500).render('deeplink/not-found', { ...appLinks('') });
});

connectDatabase()
  .then(() => {
    const server = app.listen(env.DEEPLINK_PORT, () => {
      logger.info({ port: env.DEEPLINK_PORT }, 'deeplink server listening');
    });

    const shutdown = async () => {
      server.close();
      await disconnectDatabase();
      process.exit(0);
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  })
  .catch((err) => {
    logger.error({ err }, 'deeplink server failed to start');
    process.exit(1);
  });
