// The mobile app sends no Origin header, so a missing origin is allowed. Browser
// callers must be on the list — the admin panel and the website.

import env from './env.js';

const allowed = new Set(
  [
    env.WEB_BASE_URL,
    env.API_BASE_URL,
    'http://localhost:3000', // website dev
    'http://localhost:3001', // admin dev
  ].filter(Boolean)
);

export default {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowed.has(origin)) return callback(null, true);
    return callback(new Error(`Origin not allowed: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Device-Id',
    'X-Platform',
    'X-App-Version',
    'X-Firebase-AppCheck',
    'Accept-Language',
  ],
  maxAge: 86400,
};
