'use strict';
const { AuditLog } = require('../models');
const { redact } = require('../utils/redact');
const logger = require('../utils/logger');

/**
 * Append an audit entry. Never throws: a failing audit write must not break the request,
 * but it is logged. Passwords/tokens are always redacted from before/after.
 */
async function record(actor, action, entity, entityId, { before = null, after = null, summary = '', ip = '' } = {}) {
  try {
    await AuditLog.create({
      actorId: actor && actor.id ? actor.id : null,
      actorName: (actor && actor.name) || 'system',
      actorRole: (actor && actor.role) || 'system',
      action,
      entity,
      entityId: entityId ? String(entityId) : '',
      summary,
      before: before ? redact(before) : null,
      after: after ? redact(after) : null,
      ip,
    });
  } catch (e) {
    logger.error('Audit write failed', { action, entity, message: e.message });
  }
}

module.exports = { record };
