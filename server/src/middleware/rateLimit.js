'use strict';
const rateLimit = require('express-rate-limit');
const { env } = require('../config/env');

const make = (opts) =>
  rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => env.rateLimitDisabled,
    handler: (req, res) => res.status(429).json({ error: { message: opts.message || 'Too many requests, please try again later', code: 'RATE_LIMITED' } }),
    ...opts,
  });

const globalLimiter = make({ windowMs: 15 * 60 * 1000, limit: 600 });
// Brute-force protection for credential endpoints (per IP)
const loginLimiter = make({ windowMs: 15 * 60 * 1000, limit: 10, message: 'Too many sign-in attempts. Try again in 15 minutes.' });
const resetLimiter = make({ windowMs: 60 * 60 * 1000, limit: 5, message: 'Too many password reset requests. Try again later.' });
// AI: about N requests per user per hour (keyed by user id, not IP)
const aiLimiter = make({
  windowMs: 60 * 60 * 1000,
  limit: env.ai.perHour,
  keyGenerator: (req) => (req.user ? `u:${req.user.id}` : 'anon'),
  message: 'AI request limit reached for this hour. Please try again later.',
});

module.exports = { globalLimiter, loginLimiter, resetLimiter, aiLimiter };
