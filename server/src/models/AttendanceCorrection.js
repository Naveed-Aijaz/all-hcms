'use strict';
const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    date: { type: String, required: true },
    checkIn: { type: String, required: true }, // HH:mm company time
    checkOut: { type: String, default: null },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    decidedAt: { type: Date, default: null },
    decisionComment: { type: String, default: '', maxlength: 500 },
  },
  { timestamps: true },
);
schema.index({ employeeId: 1, date: 1, createdAt: -1 });
schema.index({ status: 1, createdAt: -1 });
// Only one pending correction per employee per day.
schema.index({ employeeId: 1, date: 1 }, { unique: true, partialFilterExpression: { status: 'pending' }, name: 'one_pending_per_day' });

module.exports = mongoose.model('AttendanceCorrection', schema);
