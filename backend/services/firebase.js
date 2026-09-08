// One Firebase Admin app, shared by push (services/fcm.js) and client
// attestation (middleware/attestation.js). Initialised lazily so a deployment
// without Firebase credentials — a local dev box, a test run — still boots.

const admin = require('firebase-admin');
const env = require('../config/env');
const logger = require('../config/logger');

let app = null;
let attempted = false;

function getApp() {
  if (app) return app;
  if (attempted) return null;
  attempted = true;

  if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !env.firebasePrivateKey) {
    logger.warn('firebase credentials missing — push and app check are disabled');
    return null;
  }

  app = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.firebasePrivateKey,
    }),
  });
  logger.info('firebase admin initialised');
  return app;
}

const isConfigured = () => Boolean(getApp());
const messaging = () => (getApp() ? admin.messaging() : null);
const appCheck = () => (getApp() ? admin.appCheck() : null);

module.exports = { admin, getApp, isConfigured, messaging, appCheck };
