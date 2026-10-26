'use strict';
const PDFDocument = require('pdfkit');
const mongoose = require('mongoose');
const { PayrollRun, Payslip, Employee, Attendance, Settings } = require('../models');
const AppError = require('../utils/AppError');
const { monthRange } = require('../utils/dates');
const { computePayslip, round2 } = require('../utils/payroll');
const { can } = require('../config/permissions');
const { pageParams, pageMeta } = require('../utils/pagination');
const { getContext } = require('./settingsService');
const leaveService = require('./leaveService');
const { effectiveStatus } = require('./attendanceService');
const notifications = require('./notificationService');
const audit = require('./auditService');
const mail = require('./mailService');

/**
 * Create or recompute the DRAFT payroll for a month (HR). A finalized month is locked (409).
 * Formula: see utils/payroll.js and the README ("Payroll calculation").
 */
async function generateDraft(user, ym, ip) {
  const { settings, today } = await getContext();
  if (ym > today.slice(0, 7)) throw AppError.unprocessable('Payroll cannot be run for a future month', 'FUTURE_MONTH');
  const existing = await PayrollRun.findOne({ month: ym }).lean();
  if (existing && existing.status === 'finalized') throw AppError.conflict('This month is finalized and locked', 'PAYROLL_LOCKED');

  const { start, end } = monthRange(ym);
  const emps = await Employee.find({ joinDate: { $lte: end }, $or: [{ exitDate: null }, { exitDate: { $gte: start } }] })
    .populate('departmentId', 'name')
    .populate('designationId', 'title')
    .lean();
  const ids = emps.map((e) => e._id);
  const [records, leaveMap, holidays] = await Promise.all([
    Attendance.find({ employeeId: { $in: ids }, date: { $gte: start, $lte: end } }).lean(),
    leaveService.approvedLeaveMap(ids, start, end, settings.weekend),
    leaveService.holidayDates(start, end),
  ]);
  const attBy = new Map();
  for (const r of records) {
    const k = String(r.employeeId);
    if (!attBy.has(k)) attBy.set(k, {});
    attBy.get(k)[r.date] = effectiveStatus(r, today);
  }

  const slips = emps.map((e) => {
    const calc = computePayslip({
      basic: e.salary.basic,
      rules: settings.payroll,
      monthStart: start,
      monthEnd: end,
      joinDate: e.joinDate,
      exitDate: e.exitDate,
      weekend: settings.weekend,
      holidays,
      attendance: attBy.get(String(e._id)) || {},
      leaves: leaveMap.get(String(e._id)) || {},
      today,
    });
    return {
      month: ym,
      employeeId: e._id,
      employee: {
        name: e.name,
        code: e.code,
        department: e.departmentId ? e.departmentId.name : '',
        designation: e.designationId ? e.designationId.title : '',
        departmentId: e.departmentId ? e.departmentId._id : null,
      },
      ...calc,
    };
  });
  const sum = (k) => round2(slips.reduce((a, s) => a + s[k], 0));
  const totals = { headcount: slips.length, gross: sum('payableGross'), deduction: sum('deduction'), tax: sum('tax'), net: sum('net') };

  let run;
  try {
    run = await PayrollRun.findOneAndUpdate(
      { month: ym, status: { $ne: 'finalized' } },
      { $set: { status: 'draft', totals, skipped: [], createdBy: user.id, generatedAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  } catch (e) {
    if (e && e.code === 11000) throw AppError.conflict('This month is finalized and locked', 'PAYROLL_LOCKED');
    throw e;
  }
  await Payslip.deleteMany({ runId: run._id });
  if (slips.length) await Payslip.insertMany(slips.map((s) => ({ ...s, runId: run._id })));
  // Close the (tiny) race with a concurrent finalize: if it landed meanwhile, mark the new slips final too.
  const fresh = await PayrollRun.findById(run._id).select('status').lean();
  if (fresh.status === 'finalized') await Payslip.updateMany({ runId: run._id }, { $set: { finalized: true } });

  await audit.record(user, 'payroll.draft', 'payroll', run._id, { after: { month: ym, ...totals }, summary: `Payroll draft for ${ym} (${slips.length} employees)`, ip });
  return runView(run.toObject());
}

const runView = (r) => ({
  id: String(r._id),
  month: r.month,
  status: r.status,
  totals: r.totals,
  generatedAt: r.generatedAt,
  finalizedAt: r.finalizedAt,
});

async function listRuns() {
  const runs = await PayrollRun.find().sort({ month: -1 }).limit(60).lean();
  return runs.map(runView);
}

async function getRun(id, q) {
  if (!mongoose.isValidObjectId(id)) throw AppError.notFound('Payroll run not found');
  const run = await PayrollRun.findById(id).lean();
  if (!run) throw AppError.notFound('Payroll run not found');
  const { page, limit, skip } = pageParams(q, { maxLimit: 100, defaultLimit: 50 });
  const [slips, total] = await Promise.all([
    Payslip.find({ runId: run._id }).sort({ 'employee.name': 1 }).skip(skip).limit(limit).lean(),
    Payslip.countDocuments({ runId: run._id }),
  ]);
  return { run: runView(run), data: slips.map(shapeSlip), pagination: pageMeta(page, limit, total) };
}

/** Only an Admin can lock a payroll month; after that nothing can change it. */
async function finalize(user, id, ip) {
  if (!mongoose.isValidObjectId(id)) throw AppError.notFound('Payroll run not found');
  const run = await PayrollRun.findOneAndUpdate({ _id: id, status: 'draft' }, { $set: { status: 'finalized', finalizedBy: user.id, finalizedAt: new Date() } }, { new: true });
  if (!run) {
    const exists = await PayrollRun.exists({ _id: id });
    if (!exists) throw AppError.notFound('Payroll run not found');
    throw AppError.conflict('This payroll run is already finalized', 'PAYROLL_LOCKED');
  }
  await Payslip.updateMany({ runId: run._id }, { $set: { finalized: true } });
  await audit.record(user, 'payroll.finalize', 'payroll', run._id, { before: { status: 'draft' }, after: { status: 'finalized', month: run.month, ...run.toObject().totals }, summary: `Finalized payroll ${run.month}`, ip });

  const emps = await Employee.find({ _id: { $in: await Payslip.distinct('employeeId', { runId: run._id }) } }).select('userId name email').lean();
  await Promise.all(
    emps.map(async (e) => {
      await notifications.notifyEmployee(e, { type: 'payslip', title: `Payslip for ${run.month} is available`, message: 'Open Payslips to view or download it.', link: '/payslips' });
      const t = mail.templates.payslipReady(e.name, run.month);
      await mail.sendMail({ to: e.email, ...t });
    }),
  );
  return runView(run.toObject());
}

function shapeSlip(s) {
  return {
    id: String(s._id),
    runId: String(s.runId),
    month: s.month,
    finalized: s.finalized,
    employee: { id: String(s.employeeId), name: s.employee.name, code: s.employee.code, department: s.employee.department, designation: s.employee.designation },
    basic: s.basic, hra: s.hra, medical: s.medical, gross: s.gross,
    workingDays: s.workingDays, eligibleDays: s.eligibleDays, presentDays: s.presentDays, halfDays: s.halfDays,
    absentDays: s.absentDays, paidLeaveDays: s.paidLeaveDays, unpaidLeaveDays: s.unpaidLeaveDays, deductDays: s.deductDays,
    perDay: s.perDay, earnedGross: s.earnedGross, deduction: s.deduction, payableGross: s.payableGross, tax: s.tax, net: s.net,
  };
}

/** Admin/HR may read any payslip (drafts included); everybody else only their own FINALIZED payslips. */
async function getPayslip(user, id) {
  if (!mongoose.isValidObjectId(id)) throw AppError.notFound('Payslip not found');
  const s = await Payslip.findById(id).lean();
  if (!s) throw AppError.notFound('Payslip not found');
  if (can(user.role, 'payslip:any')) return s;
  if (!user.employeeId || String(s.employeeId) !== user.employeeId || !s.finalized) throw AppError.forbidden('You can only view your own finalized payslips');
  return s;
}

async function listPayslips(user, q) {
  const { page, limit, skip } = pageParams(q);
  const filter = {};
  if (q.month) filter.month = q.month;
  if (q.employeeId) {
    if (!can(user.role, 'payslip:any')) throw AppError.forbidden('You can only view your own payslips');
    filter.employeeId = q.employeeId;
  } else {
    if (!user.employeeId) return { data: [], pagination: pageMeta(page, limit, 0) };
    filter.employeeId = user.employeeId;
    filter.finalized = true;
  }
  const [rows, total] = await Promise.all([
    Payslip.find(filter).sort({ month: -1 }).skip(skip).limit(limit).lean(),
    Payslip.countDocuments(filter),
  ]);
  return { data: rows.map(shapeSlip), pagination: pageMeta(page, limit, total) };
}

const money = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function streamPdf(user, id, res) {
  const s = await getPayslip(user, id);
  const settings = await Settings.findOne({ key: 'main' }).lean();
  const safeCode = String(s.employee.code).replace(/[^A-Za-z0-9_-]/g, '');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="payslip-${s.month}-${safeCode}.pdf"`);
  res.setHeader('Cache-Control', 'no-store');
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  doc.pipe(res);
  doc.fontSize(18).text(settings ? settings.companyName : 'Company', { align: 'left' });
  doc.fontSize(12).fillColor('#555').text(`Payslip - ${s.month}${s.finalized ? '' : '  (DRAFT)'}`).fillColor('#000').moveDown();
  doc.fontSize(11);
  doc.text(`Employee: ${s.employee.name} (${s.employee.code})`);
  doc.text(`Department: ${s.employee.department || '-'}    Designation: ${s.employee.designation || '-'}`).moveDown();
  const row = (label, value, bold = false) => {
    const y = doc.y;
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').text(label, 50, y, { width: 300 });
    doc.text(value, 350, y, { width: 195, align: 'right' });
    doc.moveDown(0.3);
  };
  doc.font('Helvetica-Bold').text('Earnings').moveDown(0.3);
  row('Basic', money(s.basic));
  row('House rent allowance', money(s.hra));
  row('Medical allowance', money(s.medical));
  row('Gross (monthly)', money(s.gross), true);
  doc.moveDown(0.5).font('Helvetica-Bold').text('Attendance').moveDown(0.3);
  row('Working days in month', String(s.workingDays));
  row('Eligible days (join / exit prorating)', String(s.eligibleDays));
  row('Absent days', String(s.absentDays));
  row('Unpaid leave days', String(s.unpaidLeaveDays));
  row('Half days', String(s.halfDays));
  row('Paid leave days (no deduction)', String(s.paidLeaveDays));
  doc.moveDown(0.5).font('Helvetica-Bold').text('Calculation').moveDown(0.3);
  row('Gross for eligible days', money(s.earnedGross));
  row(`Deduction (${s.deductDays} day x ${money(s.perDay)})`, `- ${money(s.deduction)}`);
  row('Payable gross', money(s.payableGross), true);
  row('Income tax', `- ${money(s.tax)}`);
  doc.moveDown(0.3);
  row('NET PAY', money(s.net), true);
  doc.moveDown().font('Helvetica').fontSize(9).fillColor('#777').text('Computer-generated payslip. Tax slabs are illustrative.');
  doc.end();
}

module.exports = { generateDraft, listRuns, getRun, finalize, getPayslip, listPayslips, streamPdf, shapeSlip };
