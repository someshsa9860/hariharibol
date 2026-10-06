// Runs before everything else. Pulls the few client facts that show up in logs,
// rate-limit keys and device records off the headers once, so no controller has
// to know what the header is called.

import crypto from 'node:crypto';
import { fromHeader } from '../utils/language.js';

export default function context(req, res, next) {
  req.id = req.get('X-Request-Id') || crypto.randomUUID();
  req.deviceId = req.get('X-Device-Id') || null;
  req.platform = (req.get('X-Platform') || '').toLowerCase() || null;
  req.appVersion = req.get('X-App-Version') || null;
  req.acceptLanguage = fromHeader(req.get('Accept-Language'));

  res.set('X-Request-Id', req.id);
  next();
};
