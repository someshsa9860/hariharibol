// One logger, used by the API, the worker, the websocket server and the
// deeplink service alike. Pretty in development, JSON in production so the log
// shipper can parse it.

const pino = require('pino');
const env = require('./env');

const logger = pino({
  level: env.isProduction ? 'info' : 'debug',
  // Anything that looks like a credential is stripped before it can be written.
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-firebase-appcheck"]',
      '*.password',
      '*.token',
      '*.refreshToken',
      '*.accessToken',
      '*.apiKey',
    ],
    censor: '[redacted]',
  },
  transport: env.isProduction
    ? undefined
    : { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } },
});

module.exports = logger;
