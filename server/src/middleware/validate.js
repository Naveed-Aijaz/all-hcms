'use strict';
const { ZodError } = require('zod');
const AppError = require('../utils/AppError');

/** validate({ body, query, params }) -> parsed values on req.valid.{body,query,params}. Unknown keys are stripped. */
const validate = (schemas) => (req, res, next) => {
  try {
    req.valid = {};
    for (const part of ['params', 'query', 'body']) {
      if (schemas[part]) req.valid[part] = schemas[part].parse(req[part] || {});
    }
    return next();
  } catch (err) {
    if (err instanceof ZodError) {
      const details = err.issues.map((i) => ({ field: i.path.join('.') || '(root)', message: i.message }));
      return next(new AppError(422, details[0] ? `${details[0].field}: ${details[0].message}` : 'Validation failed', 'VALIDATION_ERROR', details));
    }
    return next(err);
  }
};

module.exports = validate;
