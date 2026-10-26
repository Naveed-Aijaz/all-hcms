'use strict';
const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    runId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollRun', required: true },
    month: { type: String, required: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    employee: { name: String, code: String, department: String, designation: String, departmentId: mongoose.Schema.Types.ObjectId },
    finalized: { type: Boolean, default: false }, // employees can only read finalized payslips
    basic: Number,
    hra: Number,
    medical: Number,
    gross: Number,
    workingDays: Number,
    eligibleDays: Number,
    presentDays: Number,
    halfDays: Number,
    absentDays: Number,
    paidLeaveDays: Number,
    unpaidLeaveDays: Number,
    deductDays: Number,
    perDay: Number,
    earnedGross: Number,
    deduction: Number,
    payableGross: Number,
    tax: Number,
    net: Number,
  },
  { timestamps: true },
);
schema.index({ runId: 1, employeeId: 1 }, { unique: true });
schema.index({ employeeId: 1, month: 1 });
schema.index({ month: 1, 'employee.departmentId': 1 });

module.exports = mongoose.model('Payslip', schema);
