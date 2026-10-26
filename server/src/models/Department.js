'use strict';
const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 300, default: '' },
  },
  { timestamps: true },
);
module.exports = mongoose.model('Department', schema);
