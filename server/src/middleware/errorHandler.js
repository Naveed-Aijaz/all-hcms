'use strict';
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const { env } = require('../config/env');

const notFoundHandler = (req, res, next) => next(new AppError(404, 'Route not found', 'ROUTE_NOT_FOUND'));

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let message = err.message;
  let code = err.code || 'INTERNAL_ERROR';
  let details = err.details;

  if (err.name === 'ValidationError' && err.errors) {
    status = 422;
    code = 'VALIDATION_ERROR';
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    message = 'Validation failed';
  } else if (err.name === 'CastError') {
    status = 400;
    code = 'BAD_ID';
    message = 'Invalid identifier';
  } else if (err.code === 11000) {
    status = 409;
    code = 'DUPLICATE';
    const field = Object.keys(err.keyPattern || {})[0] || 'value';
    message = `A record with this ${field} already exists`;
  } else if (err.name === 'MulterError') {
    status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    code = 'UPLOAD_ERROR';
    message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : 'Invalid file upload';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    code = 'INVALID_JSON';
    message = 'Request body is not valid JSON';
  } else if (err.type === 'entity.too.large') {
    status = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'Request body is too large';
  } else if (!err.isOperational) {
    // Unknown error: log internally, never leak details to the client.
    logger.error('Unhandled error', { path: req.path, method: req.method, name: err.name, message: err.message, stack: env.isProd ? undefined : err.stack });
    status = 500;
    code = 'INTERNAL_ERROR';
    message = 'Something went wrong on the server';
    details = undefined;
  }

  const body = { error: { message, code } };
  if (details) body.error.details = details;
  res.status(status).json(body);
}

module.exports = { errorHandler, notFoundHandler };
