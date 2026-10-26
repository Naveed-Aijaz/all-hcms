'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const bool = (v, d = false) => (v === undefined || v === '' ? d : ['1', 'true', 'yes'].includes(String(v).toLowerCase()));
const num = (v, d) => (v === undefined || v === '' || Number.isNaN(Number(v)) ? d : Number(v));

const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';

const env = {
  nodeEnv,
  isProd,
  isTest: nodeEnv === 'test',
  port: num(process.env.PORT, 5000),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hcm_lite',
  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean),
  appUrl: (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, ''),
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  bcryptRounds: num(process.env.BCRYPT_ROUNDS, 12),
  resetTokenTtlMinutes: num(process.env.RESET_TOKEN_TTL_MINUTES, 30),
  bootstrap: {
    name: process.env.ADMIN_NAME || 'Administrator',
    email: process.env.ADMIN_EMAIL || '',
    password: process.env.ADMIN_PASSWORD || '',
    company: process.env.COMPANY_NAME || 'My Company',
  },
  mail: {
    mode: process.env.MAIL_MODE || (isProd ? 'smtp' : 'outbox'),
    from: process.env.MAIL_FROM || 'HCM Lite <no-reply@example.com>',
    host: process.env.SMTP_HOST || '',
    port: num(process.env.SMTP_PORT, 587),
    secure: bool(process.env.SMTP_SECURE, false),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
  exposeTempPassword: bool(process.env.EXPOSE_TEMP_PASSWORD, false),
  uploadDir: path.resolve(path.join(__dirname, '..', '..'), process.env.UPLOAD_DIR || 'uploads'),
  rateLimitDisabled: bool(process.env.RATE_LIMIT_DISABLED, false),
  ai: {
    apiKey: process.env.AI_API_KEY || '',
    baseUrl: (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
    model: process.env.AI_MODEL || 'gpt-4o-mini',
    timeoutMs: num(process.env.AI_TIMEOUT_MS, 15000),
    perHour: num(process.env.AI_REQUESTS_PER_HOUR, 20),
  },
};

function validateEnv() {
  const problems = [];
  if (!env.jwtSecret) problems.push('JWT_SECRET is required (see server/.env.example).');
  else if (isProd && (env.jwtSecret.length < 32 || /change-?me/i.test(env.jwtSecret))) problems.push('JWT_SECRET must be a random string of at least 32 characters in production.');
  if (isProd && env.exposeTempPassword) problems.push('EXPOSE_TEMP_PASSWORD must be false in production.');
  if (isProd && env.mail.mode === 'outbox') problems.push('MAIL_MODE=outbox is for development only; use smtp in production.');
  if (env.mail.mode === 'smtp' && !env.mail.host) problems.push('MAIL_MODE=smtp requires SMTP_HOST.');
  if (problems.length) {
    const err = new Error(`Invalid configuration:\n - ${problems.join('\n - ')}`);
    err.isConfigError = true;
    throw err;
  }
}

module.exports = { env, validateEnv };
