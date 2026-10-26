'use strict';
const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    date: { type: String, required: true, unique: true }, // ISO date
    name: { type: String, required: true, trim: true, maxlength: 100 },
  },
  { timestamps: true },
);
module.exports = mongoose.model('Holiday', schema);
