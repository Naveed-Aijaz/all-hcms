'use strict';
const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 80 },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
  },
  { timestamps: true },
);
schema.index({ title: 1, departmentId: 1 }, { unique: true });
module.exports = mongoose.model('Designation', schema);
