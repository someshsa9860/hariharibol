// One error type. Controllers throw it, the error middleware turns it into a
// response. Anything thrown that is not an AppError is treated as a bug and
// reported as a 500 with its details hidden.

class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.expected = true; // distinguishes "the caller was wrong" from "we broke"
  }
}

const badRequest = (message = 'Bad request', details) =>
  new AppError(400, 'BAD_REQUEST', message, details);

const unauthorized = (message = 'Authentication required') =>
  new AppError(401, 'UNAUTHORIZED', message);

const forbidden = (message = 'You do not have access to this') =>
  new AppError(403, 'FORBIDDEN', message);

const notFound = (what = 'Resource') => new AppError(404, 'NOT_FOUND', `${what} not found`);

const conflict = (message = 'Already exists', details) =>
  new AppError(409, 'CONFLICT', message, details);

const gone = (message = 'No longer available') => new AppError(410, 'GONE', message);

const unprocessable = (message = 'Could not process the request', details) =>
  new AppError(422, 'UNPROCESSABLE', message, details);

const tooMany = (message = 'Too many requests') => new AppError(429, 'RATE_LIMITED', message);

const paymentRequired = (message = 'This feature is part of Premium') =>
  new AppError(402, 'PREMIUM_REQUIRED', message);

const serverError = (message = 'Something went wrong') =>
  new AppError(500, 'SERVER_ERROR', message);

module.exports = {
  AppError,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  gone,
  unprocessable,
  tooMany,
  paymentRequired,
  serverError,
};
