// Redis serves three jobs here, and they need different connections:
//   - `redis`     general cache and rate-limit counters
//   - `publisher` fan-out to the websocket container
//   - BullMQ      creates its own via `bullConnection` (it requires
//                 maxRetriesPerRequest: null and will refuse a shared client)

const Redis = require('ioredis');
const env = require('./env');
const logger = require('./logger');

function createClient(name, options = {}) {
  const client = new Redis(env.REDIS_URL, { lazyConnect: false, ...options });
  client.on('error', (err) => logger.error({ err, name }, 'redis error'));
  client.on('connect', () => logger.info({ name }, 'redis connected'));
  return client;
}

const redis = createClient('cache');
const publisher = createClient('publisher');

// BullMQ blocks on connections, so it must never share the cache client.
const bullConnection = { url: env.REDIS_URL, maxRetriesPerRequest: null };

// Channel names shared by the API (publisher) and the websocket container
// (subscriber). Kept here so both sides read the same list.
const channels = {
  userEvent: 'ws:user',
  broadcast: 'ws:broadcast',
};

module.exports = { redis, publisher, createClient, bullConnection, channels };
