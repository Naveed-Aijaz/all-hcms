'use strict';
const { Attendance, AttendanceCorrection, Employee, Holiday, User } = require('../models');
const AppError = require('../utils/AppError');
const { addDays, eachDay, monthRange, weekdayOf, zonedTimeToUtc } = require('../utils/dates');
const { isLateCheckIn, workedMinutes, computeStatus } = require('../utils/attendanceRules');
const { employeeFilter } = require('../utils/scope');
const { pageParams, pageMeta } = require('../utils/pagination');
const { getContext } = require('./settingsService');
const leaveService = require('./leaveService');
const { assertCanDecide } = require('./approval');
const notifications = require('./notificationService');
const audit = require('./auditService');
const mail = require('./mailService');

/** Effective status of a stored record (a record with no check-out becomes missing_checkout once its day is over). */
function effectiveStatus(rec, today) {
  if (rec.checkOut) return rec.status;
  return computeStatus(rec, rec.rules, today);
}

const shapeRecord = (r, today) => ({
  id: String(r._id),
  date: r.date,
  checkIn: r.checkIn,
  checkOut: r.checkOut,
  late: r.late,
  status: effectiveStatus(r, today),
  workedMinutes: r.checkOut ? r.workedMinutes : 0,
  source: r.source,
});

async function activeEmployee(user) {
  if (!user.employeeId) throw AppError.forbidden('This account has no employee record');
  const e = await Employee.findById(user.employeeId).lean();
  if (!e || e.status === 'exited') throw AppError.forbidden('Your employee record is not active');
  return e;
}

async function checkIn(user, ip) {
  const emp = await activeEmployee(user);
  const { rules, today, now } = await getContext(); // time is stamped by the server, never by the client
  const late = isLateCheckIn(now, rules);
  try {
    const rec = await Attendance.create({ employeeId: emp._id, date: today, checkIn: now, late, status: late ? 'late' : 'present', rules, source: 'web' });
    await audit.record(user, 'attendance.check_in', 'attendance', rec._id, { summary: `Check-in ${today}${late ? ' (late)' : ''}`, ip });
    return shapeRecord(rec.toObject(), today);
  } catch (e) {
    if (e && e.code === 11000) throw AppError.conflict('You have already checked in today', 'ALREADY_CHECKED_IN');
    throw e;
  }
}

async function checkOut(user, ip) {
  await activeEmployee(user);
  const { today, now } = await getContext();
  const rec = await Attendance.findOne({ employeeId: user.employeeId, date: today });
  if (!rec) throw AppError.conflict('You have not checked in today', 'NOT_CHECKED_IN');
  if (rec.checkOut) throw AppError.conflict('You have already checked out today', 'ALREADY_CHECKED_OUT');
  const mins = workedMinutes(rec.checkIn, now);
  const status = computeStatus({ date: rec.date, late: rec.late, checkIn: rec.checkIn, checkOut: now }, rec.rules, today);
  const updated = await Attendance.findOneAndUpdate({ _id: rec._id, checkOut: null }, { $set: { checkOut: now, workedMinutes: mins, status } }, { new: true });
  if (!updated) throw AppError.conflict('You have already checked out today', 'ALREADY_CHECKED_OUT');
  await audit.record(user, 'attendance.check_out', 'attendance', rec._id, { summary: `Check-out ${today}, ${mins} min`, ip });
  return shapeRecord(updated.toObject(), today);
}

async function today(user) {
  const { today: t } = await getContext();
  if (!user.employeeId) return { date: t, record: null };
  const rec = await Attendance.findOne({ employeeId: user.employeeId, date: t }).lean();
  return { date: t, record: rec ? shapeRecord(rec, t) : null };
}

const emptySummary = () => ({ present: 0, late: 0, half_day: 0, missing_checkout: 0, absent: 0, on_leave: 0, workingDays: 0, workedMinutes: 0 });

/** Calendar for one employee and month (weekends, holidays, leave and absences resolved). */
async function monthView(employeeId, ym) {
  const emp = await Employee.findById(employeeId).lean();
  if (!emp) throw AppError.notFound('Employee not found');
  const { settings, today } = await getContext();
  const { start, end } = monthRange(ym);
  const [records, holidays, leaveMap] = await Promise.all([
    Attendance.find({ employeeId: emp._id, date: { $gte: start, $lte: end } }).lean(),
    Holiday.find({ date: { $gte: start, $lte: end } }).lean(),
    leaveService.approvedLeaveMap([emp._id], start, end, settings.weekend),
  ]);
  const recByDate = new Map(records.map((r) => [r.date, r]));
  const holByDate = new Map(holidays.map((h) => [h.date, h.name]));
  const leaves = leaveMap.get(String(emp._id)) || {};
  const summary = emptySummary();
  const days = eachDay(start, end).map((date) => {
    const weekend = settings.weekend.includes(weekdayOf(date));
    const holiday = holByDate.get(date) || null;
    const rec = recByDate.get(date);
    const inEmployment = date >= emp.joinDate && (!emp.exitDate || date <= emp.exitDate);
    const day = { date, weekend, holiday, status: null, checkIn: null, checkOut: null, workedMinutes: 0, leave: null };
    if (!inEmployment) return { ...day, status: 'n/a' };
    if (rec) {
      const s = shapeRecord(rec, today);
      Object.assign(day, { status: s.status, checkIn: s.checkIn, checkOut: s.checkOut, workedMinutes: s.workedMinutes });
      summary[s.status] += 1;
      summary.workedMinutes += s.workedMinutes;
      if (!weekend && !holiday) summary.workingDays += 1;
      return day;
    }
    if (weekend) return { ...day, status: 'weekend' };
    if (holiday) return { ...day, status: 'holiday' };
    summary.workingDays += 1;
    if (leaves[date]) {
      summary.on_leave += 1;
      return { ...day, status: 'on_leave', leave: leaves[date].code };
    }
    if (date < today) {
      summary.absent += 1;
      return { ...day, status: 'absent' };
    }
    return { ...day, status: date === today ? 'not_marked' : 'upcoming' };
  });
  return { month: ym, days, summary };
}

/** Daily board for HR/Admin (everyone) and managers (their team). */
async function board(user, { date, departmentId, page: pg, limit: lim }) {
  const { settings, today } = await getContext();
  const d = date || today;
  const and = [employeeFilter(user), { joinDate: { $lte: d } }, { $or: [{ exitDate: null }, { exitDate: { $gte: d } }] }];
  if (user.role === 'manager') and.push({ _id: { $ne: user.employeeId } }); // a manager's board shows their team
  if (departmentId) and.push({ departmentId });
  const emps = await Employee.find({ $and: and }).populate('departmentId', 'name').sort({ name: 1 }).lean();
  const ids = emps.map((e) => e._id);
  const [records, leaveMap, holidays] = await Promise.all([
    Attendance.find({ employeeId: { $in: ids }, date: d }).lean(),
    leaveService.approvedLeaveMap(ids, d, d, settings.weekend),
    Holiday.findOne({ date: d }).lean(),
  ]);
  const recBy = new Map(records.map((r) => [String(r.employeeId), r]));
  const nonWorking = settings.weekend.includes(weekdayOf(d)) || !!holidays;
  const summary = { present: 0, late: 0, half_day: 0, missing_checkout: 0, absent: 0, on_leave: 0, not_marked: 0, off: 0 };
  const rows = emps.map((e) => {
    const rec = recBy.get(String(e._id));
    let status;
    if (rec) status = effectiveStatus(rec, today);
    else if (nonWorking) status = 'off';
    else if ((leaveMap.get(String(e._id)) || {})[d]) status = 'on_leave';
    else if (d < today) status = 'absent';
    else if (d === today) status = 'not_marked';
    else status = 'off';
    summary[status] += 1;
    return {
      employeeId: String(e._id),
      code: e.code,
      name: e.name,
      department: e.departmentId ? e.departmentId.name : null,
      status,
      checkIn: rec ? rec.checkIn : null,
      checkOut: rec ? rec.checkOut : null,
      workedMinutes: rec && rec.checkOut ? rec.workedMinutes : 0,
    };
  });
  const { page, limit, skip } = pageParams({ page: pg, limit: lim }, { maxLimit: 200, defaultLimit: 50 });
  return { date: d, summary, data: rows.slice(skip, skip + limit), pagination: pageMeta(page, limit, rows.length) };
}

// ---------------- corrections ----------------

async function createCorrection(user, data, ip) {
  const emp = await activeEmployee(user);
  const { today } = await getContext();
  if (data.date > today) throw AppError.unprocessable('You cannot correct a future date', 'INVALID_DATE');
  if (data.date < addDays(today, -30)) throw AppError.unprocessable('Corrections are limited to the last 30 days', 'TOO_OLD');
  if (data.date < emp.joinDate) throw AppError.unprocessable('Date is before your joining date', 'BEFORE_JOIN_DATE');
  if (data.checkOut && data.checkOut <= data.checkIn) throw AppError.unprocessable('Check-out must be after check-in', 'INVALID_TIMES');
  try {
    const c = await AttendanceCorrection.create({ employeeId: emp._id, date: data.date, checkIn: data.checkIn, checkOut: data.checkOut || null, reason: data.reason });
    await audit.record(user, 'correction.request', 'correction', c._id, { after: { date: c.date, checkIn: c.checkIn, checkOut: c.checkOut }, ip });
    const managerUser = emp.managerId ? await User.findOne({ employeeId: emp.managerId, active: true }).select('_id').lean() : null;
    await notifications.notifyUsers([...(managerUser ? [managerUser._id] : []), ...(await notifications.hrUserIds())].filter((id) => String(id) !== user.id), {
      type: 'correction_request', title: 'Attendance correction awaiting approval', message: `${emp.name} for ${c.date}`, link: '/attendance/corrections',
    });
    return shapeCorrection(c.toObject(), emp);
  } catch (e) {
    if (e && e.code === 11000) throw AppError.conflict('You already have a pending correction for this date', 'DUPLICATE_PENDING');
    throw e;
  }
}

const shapeCorrection = (c, emp) => ({
  id: String(c._id),
  date: c.date,
  checkIn: c.checkIn,
  checkOut: c.checkOut,
  reason: c.reason,
  status: c.status,
  decisionComment: c.decisionComment,
  decidedAt: c.decidedAt,
  createdAt: c.createdAt,
  employee: emp ? { id: String(emp._id), name: emp.name, code: emp.code } : undefined,
});

async function listCorrections(user, q) {
  const { page, limit, skip } = pageParams(q);
  const filter = {};
  if (q.status) filter.status = q.status;
  if (user.role === 'employee' || q.scope === 'mine') {
    filter.employeeId = user.employeeId || null;
  } else if (user.role === 'manager') {
    const team = await Employee.find({ managerId: user.employeeId }).select('_id').lean();
    filter.employeeId = { $in: team.map((t) => t._id) };
  }
  const [rows, total] = await Promise.all([
    AttendanceCorrection.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('employeeId', 'name code').lean(),
    AttendanceCorrection.countDocuments(filter),
  ]);
  return { data: rows.map((c) => shapeCorrection(c, c.employeeId)), pagination: pageMeta(page, limit, total) };
}

async function decideCorrection(user, id, decision, comment, ip) {
  const c = await AttendanceCorrection.findById(id);
  if (!c) throw AppError.notFound('Correction not found');
  const emp = await Employee.findById(c.employeeId);
  assertCanDecide(user, emp);
  if (decision === 'reject' && !comment) throw AppError.unprocessable('A comment is required when rejecting a request', 'COMMENT_REQUIRED');
  if (c.status !== 'pending') throw AppError.conflict(`This correction is already ${c.status}`, 'ALREADY_DECIDED');
  const status = decision === 'approve' ? 'approved' : 'rejected';
  const res = await AttendanceCorrection.findOneAndUpdate(
    { _id: c._id, status: 'pending' },
    { $set: { status, decidedBy: user.id, decidedAt: new Date(), decisionComment: comment || '' } },
    { new: true },
  );
  if (!res) throw AppError.conflict('This correction was just decided by someone else', 'ALREADY_DECIDED');

  if (status === 'approved') {
    const { rules, today } = await getContext();
    const checkInAt = zonedTimeToUtc(c.date, c.checkIn, rules.timezone);
    const checkOutAt = c.checkOut ? zonedTimeToUtc(c.date, c.checkOut, rules.timezone) : null;
    const late = isLateCheckIn(checkInAt, rules);
    const fields = { checkIn: checkInAt, checkOut: checkOutAt, late, rules, source: 'correction', workedMinutes: workedMinutes(checkInAt, checkOutAt) };
    fields.status = computeStatus({ date: c.date, late, checkIn: checkInAt, checkOut: checkOutAt }, rules, today);
    await Attendance.findOneAndUpdate({ employeeId: c.employeeId, date: c.date }, { $set: fields }, { upsert: true, new: true, setDefaultsOnInsert: true });
  }
  await audit.record(user, `correction.${decision}`, 'correction', c._id, { before: { status: 'pending' }, after: { status, comment: comment || '', date: c.date }, summary: `${decision === 'approve' ? 'Approved' : 'Rejected'} correction of ${emp.name} for ${c.date}`, ip });
  await notifications.notifyEmployee(emp, { type: 'correction_decision', title: `Attendance correction ${status}`, message: `${c.date}${comment ? ` - ${comment}` : ''}`, link: '/attendance' });
  const t = mail.templates.correctionDecision(emp.name, status, c.date, comment);
  await mail.sendMail({ to: emp.email, ...t });
  return shapeCorrection(res.toObject(), emp);
}

module.exports = { effectiveStatus, shapeRecord, checkIn, checkOut, today, monthView, board, createCorrection, listCorrections, decideCorrection };
