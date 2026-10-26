'use strict';
const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    month: { type: String, required: true, unique: true }, // YYYY-MM
    status: { type: String, enum: ['draft', 'finalized'], default: 'draft' },
    totals: {
      headcount: { type: Number, default: 0 },
      gross: { type: Number, default: 0 },
      deduction: { type: Number, default: 0 },
      tax: { type: Number, default: 0 },
      net: { type: Number, default: 0 },
    },
    skipped: [{ employeeId: mongoose.Schema.Types.ObjectId, name: String, reason: String }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    generatedAt: { type: Date, default: Date.now },
    finalizedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    finalizedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
module.exports = mongoose.model('PayrollRun', schema);
