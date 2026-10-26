'use strict';
const mongoose = require('mongoose');

const schema = new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } });
const Counter = mongoose.model('Counter', schema);

/** Atomic sequence (used for employee codes). */
Counter.next = async function next(name) {
  const doc = await Counter.findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return doc.seq;
};
module.exports = Counter;
