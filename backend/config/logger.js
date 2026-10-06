// One logger, used by the API, the worker, the websocket server and the
// deeplink service alike. Pretty in development, JSON in production so the log
// shipper can parse it.

import pino from 'pino';
import env from './env.js';
import * as logBuffer from './log-buffer.js';

// A second destination alongside stdout: every redacted line also lands in
// the in-memory ring buffer config/log-buffer.js keeps, so the admin panel's
// log view is reading the same redacted text a human tailing the process
// would see — not a second, unredacted copy of it. pino serializes a log
// record once and hands that string to every stream below, pino-pretty
// included, so redaction (below) applies before either destination sees it.
const memoryStream = {
  write(line) {
    try {
      logBuffer.push(JSON.parse(line));
    } catch {
      // A line pino-pretty produced, or anything else non-JSON — skip it.
    }
  },
};

// pino-pretty is a devDependency — only imported when it will actually be
// used, so a production install (which skips devDependencies) never touches
// this line. Top-level await is safe here: this is an ES module.
const stdoutStream = env.isProduction
  ? process.stdout
  : (await import('pino-pretty')).default({ colorize: true, translateTime: 'HH:MM:ss' });

const logger = pino(
  {
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
  },
  pino.multistream([{ stream: stdoutStream }, { stream: memoryStream }])
);

export default logger;
