'use strict';
const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 20 },
    annualQuota: { type: Number, default: 0, min: 0, max: 366 },
    unlimited: { type: Boolean, default: false },
    paid: { type: Boolean, default: true },
  },
  { timestamps: true },
);
module.exports = mongoose.model('LeaveType', schema);
