// One Firebase Admin app, shared by push (services/fcm.js) and client
// attestation (middleware/attestation.js). Initialised lazily so a deployment
// without Firebase credentials — a local dev box, a test run — still boots.

import { existsSync, readFileSync } from 'node:fs';

import admin from 'firebase-admin';
import env from '../config/env.js';
import logger from '../config/logger.js';

let app = null;
let attempted = false;

/**
 * The service account, from a JSON file if one is configured.
 *
 * This is the preferred form: one file, downloaded from the Firebase console,
 * dropped in `secrets/` (which is gitignored). A malformed or missing file is
 * reported and treated as "no credentials" rather than crashing the process —
 * push going quiet is recoverable, a backend that will not boot is not.
 */
function credentialFromFile() {
  const path = env.googleServiceAccountPath;
  if (!path) return null;

  if (!existsSync(path)) {
    logger.warn({ path }, 'GOOGLE_SERVICE_ACCOUNT_PATH points at nothing');
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      logger.warn({ path }, 'service account json is missing required fields');
      return null;
    }
    return { credential: admin.credential.cert(parsed), projectId: parsed.project_id };
  } catch (err) {
    logger.warn({ path, err: err.message }, 'service account json could not be read');
    return null;
  }
}

/** The same account supplied as three environment variables instead. */
function credentialFromEnv() {
  if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !env.firebasePrivateKey) {
    return null;
  }
  return {
    credential: admin.credential.cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.firebasePrivateKey,
    }),
    projectId: env.FIREBASE_PROJECT_ID,
  };
}

function getApp() {
  if (app) return app;
  if (attempted) return null;
  attempted = true;

  const resolved = credentialFromFile() || credentialFromEnv();
  if (!resolved) {
    logger.warn('firebase credentials missing — push and app check are disabled');
    return null;
  }

  app = admin.initializeApp({
    credential: resolved.credential,
    projectId: resolved.projectId,
  });
  logger.info({ projectId: resolved.projectId }, 'firebase admin initialised');
  return app;
}

const isConfigured = () => Boolean(getApp());
const messaging = () => (getApp() ? admin.messaging() : null);
const appCheck = () => (getApp() ? admin.appCheck() : null);

export { admin, getApp, isConfigured, messaging, appCheck };
