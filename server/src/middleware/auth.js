'use strict';
const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const { can } = require('../config/permissions');
const { User } = require('../models');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

function signToken(user) {
  return jwt.sign({ sub: String(user._id), tv: user.tokenVersion || 0 }, env.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: env.jwtExpiresIn,
  });
}

function makeAuthenticate({ allowPasswordChange = false } = {}) {
  return asyncHandler(async (req, res, next) => {
    const [scheme, token] = (req.headers.authorization || '').split(' ');
    if (scheme !== 'Bearer' || !token) throw AppError.unauthorized();
    let payload;
    try {
      payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
    } catch (e) {
      throw AppError.unauthorized(e.name === 'TokenExpiredError' ? 'Session expired, please sign in again' : 'Invalid token', 'TOKEN_INVALID');
    }
    const user = await User.findById(payload.sub).lean();
    // tokenVersion mismatch = password changed/reset or login deactivated after this token was issued
    if (!user || !user.active || (user.tokenVersion || 0) !== payload.tv) {
      throw AppError.unauthorized('Session is no longer valid', 'TOKEN_INVALID');
    }
    if (user.mustChangePassword && !allowPasswordChange) {
      throw AppError.forbidden('You must change your temporary password first', 'PASSWORD_CHANGE_REQUIRED');
    }
    req.user = {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      employeeId: user.employeeId ? String(user.employeeId) : null,
      mustChangePassword: !!user.mustChangePassword,
    };
    return next();
  });
}

const authenticate = makeAuthenticate();
const authenticateAllowingPasswordChange = makeAuthenticate({ allowPasswordChange: true });

/** Route guard: `requirePermission('payroll:read')` */
const requirePermission = (permission) => (req, res, next) => {
  if (!req.user) return next(AppError.unauthorized());
  if (!can(req.user.role, permission)) return next(AppError.forbidden());
  return next();
};

/** Staff endpoints need an employee record (admin has none). */
const requireEmployeeRecord = (req, res, next) => {
  if (!req.user || !req.user.employeeId) return next(AppError.forbidden('This account has no employee record'));
  return next();
};

module.exports = { signToken, authenticate, authenticateAllowingPasswordChange, requirePermission, requireEmployeeRecord };
