'use strict';
const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    leaveTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'LeaveType', required: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    year: { type: Number, required: true },
    days: { type: Number, required: true, min: 0.5 }, // working days only
    reason: { type: String, trim: true, maxlength: 500, default: '' },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled'], default: 'pending' },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    decidedAt: { type: Date, default: null },
    decisionComment: { type: String, trim: true, maxlength: 500, default: '' },
  },
  { timestamps: true },
);
schema.index({ employeeId: 1, startDate: 1, endDate: 1 });
schema.index({ status: 1, startDate: 1 });
schema.index({ employeeId: 1, year: 1, status: 1 });

module.exports = mongoose.model('LeaveRequest', schema);
