'use strict';
const mongoose = require('mongoose');

/** Singleton company settings document (key = 'main'). */
const schema = new mongoose.Schema(
  {
    key: { type: String, default: 'main', unique: true },
    companyName: { type: String, required: true, trim: true, maxlength: 120 },
    timezone: { type: String, default: 'Asia/Karachi' },
    officeStart: { type: String, default: '09:00' },
    graceMinutes: { type: Number, default: 15, min: 0, max: 180 },
    halfDayHours: { type: Number, default: 5, min: 1, max: 12 },
    weekend: { type: [Number], default: [0, 6] }, // 0 = Sunday ... 6 = Saturday
    office: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      radiusMeters: { type: Number, default: 150 },
    },
    payroll: {
      hraPercent: { type: Number, default: 40, min: 0, max: 100 },
      medicalPercent: { type: Number, default: 10, min: 0, max: 100 },
    },
  },
  { timestamps: true },
);
module.exports = mongoose.model('Settings', schema);
