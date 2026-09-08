// Named rate limiters. A route asks for one by name (`limit: 'auth'`) rather
// than constructing its own, so the numbers live in one place and can be read
// off at a glance.
//
// Counters are in Redis, not in process memory — the API runs more than one
// container and per-process counters would multiply every limit by the replica
// count.

const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis').default || require('rate-limit-redis');
const { redis } = require('../config/redis');
const env = require('../config/env');
const { fail } = require('../utils/respond');

function store(prefix) {
  return new RedisStore({
    prefix: `rl:${prefix}:`,
    sendCommand: (...args) => redis.call(...args),
  });
}

function build(name, { windowMs, max }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    store: store(name),
    // A signed-in user is limited as a person; everyone else as an IP+device,
    // so one shared NAT does not lock out a whole office or campus.
    keyGenerator: (req) => req.auth?.user?.id || `${req.ip}:${req.deviceId || 'unknown'}`,
    skip: () => env.NODE_ENV === 'test',
    handler: (req, res) =>
      fail(res, 429, 'RATE_LIMITED', 'Too many requests. Please slow down and try again.'),
  });
}

const definitions = {
  // Sign-in and refresh: brute force and token-stuffing land here.
  auth: { windowMs: 15 * 60 * 1000, max: 30 },
  // Account creation is the expensive one to get wrong — it is also attested.
  signup: { windowMs: 60 * 60 * 1000, max: 10 },
  // Ordinary reads.
  read: { windowMs: 60 * 1000, max: 180 },
  // Anything that writes.
  write: { windowMs: 60 * 1000, max: 60 },
  // Endpoints that can cost money downstream.
  ai: { windowMs: 60 * 60 * 1000, max: 30 },
  // Payment callbacks: generous, because providers retry hard, but not open.
  webhook: { windowMs: 60 * 1000, max: 300 },
};

const cache = new Map();

function get(name) {
  const definition = definitions[name];
  if (!definition) throw new Error(`Unknown rate limiter: ${name}`);
  if (!cache.has(name)) cache.set(name, build(name, definition));
  return cache.get(name);
}

module.exports = { get, definitions };
