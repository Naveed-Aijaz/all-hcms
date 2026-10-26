'use strict';
const mongoose = require('mongoose');

/** Append-only. Update/delete operations are blocked at the model layer and no API exposes them. */
const schema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actorName: { type: String, default: '' },
    actorRole: { type: String, default: '' },
    action: { type: String, required: true, maxlength: 60 },
    entity: { type: String, required: true, maxlength: 40 },
    entityId: { type: String, default: '' },
    summary: { type: String, default: '', maxlength: 300 },
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null },
    ip: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
schema.index({ createdAt: -1 });
schema.index({ entity: 1, entityId: 1 });
schema.index({ actorId: 1, createdAt: -1 });
schema.index({ action: 1, createdAt: -1 });

const immutable = () => {
  throw new Error('Audit log entries are immutable');
};
['updateOne', 'updateMany', 'findOneAndUpdate', 'findOneAndReplace', 'replaceOne', 'deleteOne', 'deleteMany', 'findOneAndDelete'].forEach((op) => {
  schema.pre(op, immutable);
});
schema.pre('save', function guard(next) {
  if (!this.isNew) return next(new Error('Audit log entries are immutable'));
  return next();
});

module.exports = mongoose.model('AuditLog', schema);
