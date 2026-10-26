'use strict';
const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    date: { type: String, required: true }, // ISO date in company timezone
    checkIn: { type: Date, required: true }, // always stamped by the server
    checkOut: { type: Date, default: null },
    late: { type: Boolean, default: false },
    status: { type: String, enum: ['present', 'late', 'half_day', 'missing_checkout'], required: true },
    workedMinutes: { type: Number, default: 0 },
    source: { type: String, enum: ['web', 'correction'], default: 'web' },
    // Rules in force when the record was created (settings changes apply to new records only).
    rules: {
      startTime: String,
      graceMinutes: Number,
      halfDayHours: Number,
      timezone: String,
    },
  },
  { timestamps: true },
);
// One record per employee per day: the unique index is what turns a racing double check-in into a 409.
schema.index({ employeeId: 1, date: 1 }, { unique: true });
schema.index({ date: 1, status: 1 });

module.exports = mongoose.model('Attendance', schema);
