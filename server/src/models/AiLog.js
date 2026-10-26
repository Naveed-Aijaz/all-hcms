'use strict';
const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: String,
    kind: { type: String, enum: ['chat', 'summary', 'smart_leave'], required: true },
    prompt: { type: String, maxlength: 600, default: '' },
    tools: [String],
    status: { type: String, enum: ['ok', 'error', 'timeout', 'refused', 'disabled'], required: true },
    error: { type: String, maxlength: 300, default: '' },
    latencyMs: Number,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
schema.index({ userId: 1, createdAt: -1 });
module.exports = mongoose.model('AiLog', schema);
