'use strict';
const { redact } = require('./redact');

const silent = process.env.NODE_ENV === 'test' && !process.env.LOG_IN_TESTS;
function write(level, msg, meta) {
  if (silent) return;
  const line = { t: new Date().toISOString(), level, msg };
  if (meta) line.meta = redact(meta, { financial: true });
  // eslint-disable-next-line no-console
  (level === 'error' ? console.error : console.log)(JSON.stringify(line));
}

module.exports = {
  info: (m, meta) => write('info', m, meta),
  warn: (m, meta) => write('warn', m, meta),
  error: (m, meta) => write('error', m, meta),
};
