'use strict';
class AppError extends Error {
  constructor(status, message, code = 'ERROR', details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.isOperational = true;
  }
}
const bad = (m, c = 'BAD_REQUEST', d) => new AppError(400, m, c, d);
const unauthorized = (m = 'Authentication required', c = 'UNAUTHENTICATED') => new AppError(401, m, c);
const forbidden = (m = 'You do not have permission to do this', c = 'FORBIDDEN') => new AppError(403, m, c);
const notFound = (m = 'Not found', c = 'NOT_FOUND') => new AppError(404, m, c);
const conflict = (m, c = 'CONFLICT') => new AppError(409, m, c);
const unprocessable = (m, c = 'UNPROCESSABLE', d) => new AppError(422, m, c, d);

module.exports = AppError;
module.exports.AppError = AppError;
module.exports.bad = bad;
module.exports.unauthorized = unauthorized;
module.exports.forbidden = forbidden;
module.exports.notFound = notFound;
module.exports.conflict = conflict;
module.exports.unprocessable = unprocessable;
