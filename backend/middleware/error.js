// The single place an error becomes a response.
//
// Two kinds of failure, treated differently:
//   - AppError, thrown deliberately — the caller did something we can explain,
//     so the message is theirs to read.
//   - anything else — a bug. Logged with the stack, reported as a bare 500. An
//     internal message must never reach a client.

const { Prisma } = require('@prisma/client');
const logger = require('../config/logger');
const env = require('../config/env');
const { AppError } = require('../utils/errors');
const { fail } = require('../utils/respond');

// Prisma's own errors carry enough to answer properly instead of as a 500.
function fromPrisma(err) {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': {
        const fields = [].concat(err.meta?.target || []).join(', ');
        return new AppError(409, 'CONFLICT', `Already exists${fields ? `: ${fields}` : ''}`);
      }
      case 'P2025':
        return new AppError(404, 'NOT_FOUND', 'Record not found');
      case 'P2003':
        return new AppError(409, 'CONFLICT', 'Related record is missing or still in use');
      case 'P2014':
        return new AppError(409, 'CONFLICT', 'That change would break a required relation');
      default:
        return null;
    }
  }
  if (err instanceof Prisma.PrismaClientValidationError) {
    return new AppError(400, 'BAD_REQUEST', 'Malformed query');
  }
  return null;
}

function notFound(req, res) {
  return fail(res, 404, 'NOT_FOUND', `No route for ${req.method} ${req.originalUrl}`);
}

// eslint-disable-next-line no-unused-vars -- express identifies this by arity
function errorHandler(err, req, res, next) {
  const appError = err instanceof AppError ? err : fromPrisma(err);

  if (appError) {
    logger.warn(
      { requestId: req.id, code: appError.code, path: req.originalUrl, userId: req.auth?.user?.id },
      appError.message
    );
    return fail(res, appError.status, appError.code, appError.message, appError.details);
  }

  logger.error(
    { requestId: req.id, err, path: req.originalUrl, userId: req.auth?.user?.id },
    'unhandled error'
  );

  return fail(
    res,
    500,
    'SERVER_ERROR',
    'Something went wrong on our side.',
    env.isProduction ? undefined : { message: err.message, stack: err.stack?.split('\n').slice(0, 5) }
  );
}

module.exports = { errorHandler, notFound };
