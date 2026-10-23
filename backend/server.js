// Boots the HTTP server. Nothing else lives here — the app itself is app.js,
// and the background work runs in its own containers (worker/, websocket/,
// deeplink/).

import app from './app.js';
import env from './config/env.js';
import logger from './config/logger.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { closeQueues } from './jobs/index.js';
import { warmUp } from './services/ai/tokens.js';

let server;

async function start() {
  // Connect before listening. A container that accepts requests it cannot
  // serve fails health checks in a way that looks like an application bug.
  await connectDatabase();

  server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'api listening');
    // Share and referral links are built from this. Left at a dev address they are shared as links nobody can open.
    if (env.NODE_ENV === 'production' && /\/\/(localhost|127\.0\.0\.1)\b/.test(env.WEB_BASE_URL)) {
      logger.warn({ WEB_BASE_URL: env.WEB_BASE_URL }, 'WEB_BASE_URL is a local address: shared and referral links will not open');
    }
    // Ask Sakha's first reply must not be the one that pays for building the tokenizer (~300 ms, blocking).
    setImmediate(warmUp);
  });

  // Slow clients on a slightly slow network otherwise get their requests cut
  // off; the default 5s is tight for mobile.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 70_000;
}

// Finish what is in flight, then close. A hard exit during a payment webhook is
// a payment that has to be reconciled by hand.
async function shutdown(signal) {
  logger.info({ signal }, 'api shutting down');

  const timeout = setTimeout(() => {
    logger.error('shutdown took too long — exiting anyway');
    process.exit(1);
  }, 15_000);

  try {
    if (server) await new Promise((resolve) => server.close(resolve));
    await closeQueues();
    await disconnectDatabase();
    clearTimeout(timeout);
    logger.info('api stopped cleanly');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'error during shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// A rejection nobody handled has left the process in a state we cannot reason
// about. Log it loudly and let the orchestrator restart a clean one.
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'unhandled promise rejection');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'uncaught exception');
  shutdown('uncaughtException');
});

start().catch((err) => {
  logger.error({ err }, 'api failed to start');
  process.exit(1);
});
