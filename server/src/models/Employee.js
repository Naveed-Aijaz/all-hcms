'use strict';
const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true, maxlength: 30 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    phone: { type: String, trim: true, maxlength: 30, default: '' },
    address: { type: String, trim: true, maxlength: 300, default: '' },
    gender: { type: String, enum: ['male', 'female', 'other'], default: 'other' },
    dob: { type: String, default: null }, // ISO date
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
    designationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Designation', default: null },
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
    role: { type: String, enum: ['hr', 'manager', 'employee'], default: 'employee' }, // mirrors User.role
    status: { type: String, enum: ['probation', 'active', 'exited'], default: 'active' },
    joinDate: { type: String, required: true }, // ISO date
    exitDate: { type: String, default: null },
    salary: { basic: { type: Number, required: true, min: 0.01 } },
    photo: { type: String, default: null }, // server-generated filename only
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  },
);
employeeSchema.index({ status: 1, departmentId: 1 });
employeeSchema.index({ managerId: 1 });
employeeSchema.index({ name: 1 });
employeeSchema.index({ joinDate: 1 });
employeeSchema.index({ exitDate: 1 }, { sparse: true });

module.exports = mongoose.model('Employee', employeeSchema);
