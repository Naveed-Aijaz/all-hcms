'use strict';
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['admin', 'hr', 'manager', 'employee'], required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null, index: true },
    active: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: false },
    // Incremented on password change/reset/deactivation: invalidates every JWT issued before.
    tokenVersion: { type: Number, default: 0 },
    // Password reset: only the SHA-256 hash of the token is stored; cleared on use (single-use).
    resetTokenHash: { type: String, select: false, default: null },
    resetTokenExpires: { type: Date, select: false, default: null },
    lastLoginAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.passwordHash;
        delete ret.resetTokenHash;
        delete ret.resetTokenExpires;
        delete ret.tokenVersion;
        delete ret.__v;
        return ret;
      },
    },
  },
);
userSchema.index({ resetTokenHash: 1 }, { sparse: true });

module.exports = mongoose.model('User', userSchema);
