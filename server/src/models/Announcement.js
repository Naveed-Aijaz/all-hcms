'use strict';
const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 140 },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    authorName: { type: String, required: true },
  },
  { timestamps: true },
);
schema.index({ createdAt: -1 });
module.exports = mongoose.model('Announcement', schema);
