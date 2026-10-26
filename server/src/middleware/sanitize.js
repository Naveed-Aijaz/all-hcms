'use strict';
/**
 * Request sanitiser (runs before validation):
 *  - drops keys starting with '$' or containing '.' (NoSQL operator injection)
 *  - strips HTML tags and control characters from strings
 *  - never touches password / token fields (they must stay byte-exact)
 */
const SKIP = new Set(['password', 'currentPassword', 'newPassword', 'token', 'adminPassword']);
const TAGS = /<\/?[a-z!][^>]*>/gi;
// eslint-disable-next-line no-control-regex
const CTRL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function clean(value, key, depth = 0) {
  if (depth > 8) return undefined;
  if (typeof value === 'string') return SKIP.has(key) ? value : value.replace(CTRL, '').replace(TAGS, '');
  if (Array.isArray(value)) return value.map((v) => clean(v, key, depth + 1));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (k.startsWith('$') || k.includes('.') || k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      out[k] = clean(v, k, depth + 1);
    }
    return out;
  }
  return value;
}

module.exports = function sanitize(req, res, next) {
  if (req.body && typeof req.body === 'object') req.body = clean(req.body, '');
  if (req.query && typeof req.query === 'object') {
    const q = clean(req.query, '');
    Object.keys(req.query).forEach((k) => delete req.query[k]);
    Object.assign(req.query, q);
  }
  if (req.params && typeof req.params === 'object') req.params = clean(req.params, '');
  next();
};
module.exports.clean = clean;
