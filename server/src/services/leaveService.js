'use strict';
const mongoose = require('mongoose');
const { LeaveRequest, LeaveType, Holiday, Employee, User } = require('../models');
const AppError = require('../utils/AppError');
const { addDays } = require('../utils/dates');
const { listWorkingDays } = require('../utils/workingDays');
const { employeeFilter } = require('../utils/scope');
const { pageParams, pageMeta } = require('../utils/pagination');
const { getContext } = require('./settingsService');
const { assertCanDecide } = require('./approval');
const notifications = require('./notificationService');
const audit = require('./auditService');
const mail = require('./mailService');

const oid = (v) => new mongoose.Types.ObjectId(String(v));

async function holidayDates(start, end) {
  const hs = await Holiday.find({ date: { $gte: start, $lte: end } }).select('date').lean();
  return hs.map((h) => h.date);
}

/**
 * Map(employeeId -> { 'YYYY-MM-DD': { paid, code } }) of APPROVED leave, expanded to
 * working days (weekends and holidays are never leave days) inside [start, end].
 */
async function approvedLeaveMap(employeeIds, start, end, weekend) {
  const out = new Map();
  if (!employeeIds.length) return out;
  const reqs = await LeaveRequest.find({ status: 'approved', employeeId: { $in: employeeIds }, startDate: { $lte: end }, endDate: { $gte: start } })
    .populate('leaveTypeId', 'paid code')
    .lean();
  if (!reqs.length) return out;
  const holidays = new Set(await holidayDates(start, end));
  for (const r of reqs) {
    const s = r.startDate > start ? r.startDate : start;
    const e = r.endDate < end ? r.endDate : end;
    const key = String(r.employeeId);
    if (!out.has(key)) out.set(key, {});
    for (const d of listWorkingDays(s, e, { weekend, holidays })) {
      out.get(key)[d] = { paid: r.leaveTypeId ? r.leaveTypeId.paid : true, code: r.leaveTypeId ? r.leaveTypeId.code : '' };
    }
  }
  return out;
}

async function balances(employeeId, year) {
  const [types, agg] = await Promise.all([
    LeaveType.find().sort({ name: 1 }).lean(),
    LeaveRequest.aggregate([
      { $match: { employeeId: oid(employeeId), year, status: { $in: ['approved', 'pending'] } } },
      { $group: { _id: { t: '$leaveTypeId', s: '$status' }, days: { $sum: '$days' } } },
    ]),
  ]);
  return types.map((t) => {
    const used = (agg.find((a) => String(a._id.t) === String(t._id) && a._id.s === 'approved') || {}).days || 0;
    const pending = (agg.find((a) => String(a._id.t) === String(t._id) && a._id.s === 'pending') || {}).days || 0;
    return {
      leaveTypeId: String(t._id),
      name: t.name,
      code: t.code,
      paid: t.paid,
      unlimited: t.unlimited,
      quota: t.unlimited ? null : t.annualQuota,
      used,
      pending,
      remaining: t.unlimited ? null : Math.max(0, t.annualQuota - used - pending),
    };
  });
}

/** All leave rules in one place. Throws 422 for any violation; returns the computed day count. */
async function validateRequest(employee, type, startDate, endDate, ctx) {
  const { settings, today } = ctx;
  if (!type) throw AppError.unprocessable('Unknown leave type', 'UNKNOWN_LEAVE_TYPE');
  if (employee.status === 'exited') throw AppError.unprocessable('Exited employees cannot apply for leave', 'EMPLOYEE_EXITED');
  if (endDate < startDate) throw AppError.unprocessable('End date cannot be before the start date', 'INVALID_DATES');
  if (startDate.slice(0, 4) !== endDate.slice(0, 4)) throw AppError.unprocessable('A leave request cannot span two calendar years; please submit two requests', 'SPANS_YEARS');
  if (startDate < employee.joinDate) throw AppError.unprocessable('Leave cannot start before the joining date', 'BEFORE_JOIN_DATE');
  if (startDate < addDays(today, -30)) throw AppError.unprocessable('Leave cannot start more than 30 days in the past', 'TOO_OLD');
  if (startDate > addDays(today, 365)) throw AppError.unprocessable('Leave cannot be requested more than a year ahead', 'TOO_FAR');

  const holidays = await holidayDates(startDate, endDate);
  const days = listWorkingDays(startDate, endDate, { weekend: settings.weekend, holidays }).length;
  if (days === 0) throw AppError.unprocessable('The selected dates contain no working days (weekends and public holidays are excluded)', 'NO_WORKING_DAYS');

  const overlap = await LeaveRequest.exists({ employeeId: employee._id, status: { $in: ['pending', 'approved'] }, startDate: { $lte: endDate }, endDate: { $gte: startDate } });
  if (overlap) throw AppError.unprocessable('These dates overlap an existing pending or approved leave request', 'OVERLAP');

  const year = Number(startDate.slice(0, 4));
  const bal = (await balances(employee._id, year)).find((b) => b.leaveTypeId === String(type._id));
  if (!type.unlimited && days > bal.remaining) {
    throw AppError.unprocessable(`Insufficient ${type.name} leave balance: ${bal.remaining} day(s) left, ${days} requested`, 'INSUFFICIENT_BALANCE');
  }
  return { days, year, balance: bal };
}

const shapeLeave = (l) => ({
  id: String(l._id),
  employee: l.employeeId && l.employeeId._id ? { id: String(l.employeeId._id), name: l.employeeId.name, code: l.employeeId.code } : { id: String(l.employeeId) },
  leaveType: l.leaveTypeId && l.leaveTypeId._id ? { id: String(l.leaveTypeId._id), name: l.leaveTypeId.name, code: l.leaveTypeId.code, paid: l.leaveTypeId.paid } : { id: String(l.leaveTypeId) },
  startDate: l.startDate,
  endDate: l.endDate,
  days: l.days,
  reason: l.reason,
  status: l.status,
  decisionComment: l.decisionComment,
  decidedAt: l.decidedAt,
  createdAt: l.createdAt,
});

async function selfEmployee(user) {
  if (!user.employeeId) throw AppError.forbidden('This account has no employee record');
  const e = await Employee.findById(user.employeeId);
  if (!e) throw AppError.notFound('Employee not found');
  return e;
}

async function preview(user, { leaveTypeId, startDate, endDate }) {
  const ctx = await getContext();
  const emp = await selfEmployee(user);
  const type = await LeaveType.findById(leaveTypeId);
  const { days, balance } = await validateRequest(emp, type, startDate, endDate, ctx);
  return { days, balance, remainingAfter: type.unlimited ? null : balance.remaining - days };
}

async function apply(user, data, ip) {
  const ctx = await getContext();
  const emp = await selfEmployee(user);
  const type = await LeaveType.findById(data.leaveTypeId);
  const { days, year } = await validateRequest(emp, type, data.startDate, data.endDate, ctx);
  const leave = await LeaveRequest.create({ employeeId: emp._id, leaveTypeId: type._id, startDate: data.startDate, endDate: data.endDate, year, days, reason: data.reason || '' });
  await audit.record(user, 'leave.apply', 'leave', leave._id, { after: { type: type.code, startDate: leave.startDate, endDate: leave.endDate, days }, summary: `${emp.name} applied for ${days} day(s) ${type.name}`, ip });

  // Notify the direct manager and HR (never the requester).
  const notice = { type: 'leave_request', title: 'Leave request awaiting approval', message: `${emp.name}: ${type.name}, ${leave.startDate} to ${leave.endDate} (${days} day(s))`, link: '/leave/approvals' };
  const managerUser = emp.managerId ? await User.findOne({ employeeId: emp.managerId, active: true }).select('_id name email').lean() : null;
  const hrIds = await notifications.hrUserIds();
  await notifications.notifyUsers([...(managerUser ? [managerUser._id] : []), ...hrIds].filter((id) => String(id) !== user.id), notice);
  if (managerUser) {
    const t = mail.templates.leaveRequested(managerUser.name, emp.name, { type: type.name, startDate: leave.startDate, endDate: leave.endDate, days });
    await mail.sendMail({ to: managerUser.email, ...t });
  }
  return shapeLeave(await LeaveRequest.findById(leave._id).populate('leaveTypeId', 'name code paid').populate('employeeId', 'name code').lean());
}

async function cancel(user, id, ip) {
  const ctx = await getContext();
  const leave = await LeaveRequest.findById(id);
  if (!leave) throw AppError.notFound('Leave request not found');
  if (!user.employeeId || String(leave.employeeId) !== user.employeeId) throw AppError.forbidden('You can only cancel your own leave');
  const cancellable = leave.status === 'pending' || (leave.status === 'approved' && leave.startDate > ctx.today);
  if (!cancellable) throw AppError.conflict(`A ${leave.status} leave that has already started cannot be cancelled`, 'NOT_CANCELLABLE');
  const before = { status: leave.status };
  const res = await LeaveRequest.findOneAndUpdate({ _id: leave._id, status: leave.status }, { $set: { status: 'cancelled' } }, { new: true });
  if (!res) throw AppError.conflict('This request was just changed by someone else; refresh and retry', 'CONFLICT');
  await audit.record(user, 'leave.cancel', 'leave', leave._id, { before, after: { status: 'cancelled' }, ip });
  return { id: String(leave._id), status: 'cancelled' };
}

async function decide(user, id, decision, comment, ip) {
  const leave = await LeaveRequest.findById(id);
  if (!leave) throw AppError.notFound('Leave request not found');
  const emp = await Employee.findById(leave.employeeId);
  assertCanDecide(user, emp);
  if (decision === 'reject' && !comment) throw AppError.unprocessable('A comment is required when rejecting a request', 'COMMENT_REQUIRED');
  if (leave.status !== 'pending') throw AppError.conflict(`This request is already ${leave.status}`, 'ALREADY_DECIDED');
  const status = decision === 'approve' ? 'approved' : 'rejected';
  const res = await LeaveRequest.findOneAndUpdate(
    { _id: leave._id, status: 'pending' },
    { $set: { status, decidedBy: user.id, decidedAt: new Date(), decisionComment: comment || '' } },
    { new: true },
  );
  if (!res) throw AppError.conflict('This request was just decided by someone else', 'ALREADY_DECIDED');
  const type = await LeaveType.findById(leave.leaveTypeId).lean();
  await audit.record(user, `leave.${decision}`, 'leave', leave._id, { before: { status: 'pending' }, after: { status, comment: comment || '' }, summary: `${decision === 'approve' ? 'Approved' : 'Rejected'} ${emp.name}'s ${type ? type.name : ''} leave`, ip });
  await notifications.notifyEmployee(emp, { type: 'leave_decision', title: `Leave ${status}`, message: `${type ? type.name : 'Leave'} ${leave.startDate} to ${leave.endDate}${comment ? ` - ${comment}` : ''}`, link: '/leave' });
  const t = mail.templates.leaveDecision(emp.name, status, { type: type ? type.name : 'Leave', startDate: leave.startDate, endDate: leave.endDate, days: leave.days }, comment);
  await mail.sendMail({ to: emp.email, ...t });
  return shapeLeave(await LeaveRequest.findById(leave._id).populate('leaveTypeId', 'name code paid').populate('employeeId', 'name code').lean());
}

async function list(user, q) {
  const { page, limit, skip } = pageParams(q);
  const filter = {};
  if (q.status) filter.status = q.status;

  const wantsMine = user.role === 'employee' || q.scope === 'mine';
  if (wantsMine) {
    if (!user.employeeId) return { data: [], pagination: pageMeta(page, limit, 0) };
    filter.employeeId = user.employeeId;
  } else if (user.role === 'manager') {
    const team = await Employee.find({ managerId: user.employeeId }).select('_id').lean();
    filter.employeeId = { $in: team.map((t) => t._id) };
  }
  if (q.employeeId) {
    const allowed = await Employee.exists({ $and: [employeeFilter(user), { _id: q.employeeId }] });
    if (!allowed) throw AppError.forbidden('You can only view leave of people in your scope');
    filter.employeeId = q.employeeId;
  }
  const [rows, total] = await Promise.all([
    LeaveRequest.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('leaveTypeId', 'name code paid').populate('employeeId', 'name code').lean(),
    LeaveRequest.countDocuments(filter),
  ]);
  return { data: rows.map(shapeLeave), pagination: pageMeta(page, limit, total) };
}

async function balanceFor(user, employeeId, year) {
  const ctx = await getContext();
  const target = employeeId || user.employeeId;
  if (!target) throw AppError.forbidden('This account has no employee record');
  if (employeeId) {
    const allowed = await Employee.exists({ $and: [employeeFilter(user), { _id: employeeId }] });
    if (!allowed) throw AppError.forbidden('You can only view balances of people in your scope');
  }
  return balances(target, year || Number(ctx.today.slice(0, 4)));
}

module.exports = { approvedLeaveMap, balances, validateRequest, preview, apply, cancel, decide, list, balanceFor, holidayDates, shapeLeave };
