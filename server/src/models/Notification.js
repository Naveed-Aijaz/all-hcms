'use strict';
const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true, maxlength: 40 },
    title: { type: String, required: true, maxlength: 140 },
    message: { type: String, default: '', maxlength: 500 },
    link: { type: String, default: '', maxlength: 200 },
    read: { type: Boolean, default: false },
  },
  { timestamps: true },
);
schema.index({ userId: 1, read: 1, createdAt: -1 });
module.exports = mongoose.model('Notification', schema);
