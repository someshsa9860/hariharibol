// Account creation must be provably from one of our own clients — the mobile
// app or our website. Without this, anyone can point curl at /auth/google and
// mint accounts, and the first thing that gets abused is the free tier.
//
// Firebase App Check is the mechanism: Play Integrity on Android, App Attest on
// iOS, reCAPTCHA Enterprise on web. The client attaches a short-lived token; we
// verify it here. Firebase is already in the project for push, so this costs no
// new vendor.
//
// It is deliberately not applied to every route. A stolen access token is a
// different problem from a fake client, and attesting every request would mean
// every request carries a second token that has to be refreshed. It guards the
// unauthenticated doors: sign-in, sign-up, device registration.

import env from '../config/env.js';
import logger from '../config/logger.js';
import * as firebase from './../services/firebase.js';
import { forbidden } from '../utils/errors.js';

export default async function attestation(req, res, next) {
  // Off by default outside production so a local client can be pointed at the
  // API without a Firebase project. Turning it off in production is a decision
  // someone has to make in the environment, not an accident.
  if (!env.APP_CHECK_ENABLED) {
    if (env.isProduction) logger.warn('APP_CHECK_ENABLED is false in production');
    return next();
  }

  const token = req.get('X-Firebase-AppCheck');
  if (!token) return next(forbidden('This client is not recognised'));

  const client = firebase.appCheck();
  if (!client) return next(forbidden('Attestation is unavailable'));

  try {
    const claims = await client.verifyToken(token);
    req.attestation = { appId: claims.appId };
    return next();
  } catch (err) {
    logger.warn({ err: err.message, ip: req.ip, deviceId: req.deviceId }, 'app check rejected');
    return next(forbidden('This client is not recognised'));
  }
};
