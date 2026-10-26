'use strict';
const mongoose = require('mongoose');
const { Employee, Attendance, AttendanceCorrection, LeaveRequest, LeaveType, Department, Payslip, Announcement, AuditLog, Notification } = require('../models');
const AppError = require('../utils/AppError');
const { employeeFilter } = require('../utils/scope');
const { addDays, startOfWeek, weekdayOf } = require('../utils/dates');
const { listWorkingDays } = require('../utils/workingDays');
const metrics = require('../utils/metrics');
const { salaryStructure, round2 } = require('../utils/payroll');
const { getContext } = require('./settingsService');
const leaveService = require('./leaveService');
const { effectiveStatus } = require('./attendanceService');

const STATUSES = ['present', 'late', 'half_day', 'missing_checkout', 'absent', 'on_leave'];
const blankCounts = () => Object.fromEntries(STATUSES.map((s) => [s, 0]));
const oid = (v) => new mongoose.Types.ObjectId(String(v));

/** All numbers are computed on the server for the caller's own data scope (admin/hr = company, manager = team, employee = self). */
function rangeFrom(ctx, q = {}) {
  const to = q.to || ctx.today;
  const from = q.from || `${ctx.today.slice(0, 7)}-01`;
  if (from > to) throw AppError.unprocessable('"from" must not be after "to"', 'INVALID_RANGE');
  if (addDays(from, 366) < to) throw AppError.unprocessable('Date range cannot exceed one year', 'INVALID_RANGE');
  return { from, to };
}

async function scopedEmployees(user, { from, to, departmentId, activeOn }) {
  const and = [employeeFilter(user)];
  if (departmentId) and.push({ departmentId });
  if (activeOn) and.push({ joinDate: { $lte: activeOn } }, { $or: [{ exitDate: null }, { exitDate: { $gt: activeOn } }] });
  else and.push({ joinDate: { $lte: to } }, { $or: [{ exitDate: null }, { exitDate: { $gte: from } }] });
  return Employee.find({ $and: and }).select('_id name code departmentId designationId joinDate exitDate gender salary status role').lean();
}

/** One row per (employee, expected working day) with its resolved status. */
async function attendanceMatrix(emps, from, to, ctx) {
  const end = to < ctx.today ? to : ctx.today;
  if (from > end || !emps.length) return [];
  const ids = emps.map((e) => e._id);
  const holidays = new Set(await leaveService.holidayDates(from, end));
  const [records, leaveMap] = await Promise.all([
    Attendance.find({ employeeId: { $in: ids }, date: { $gte: from, $lte: end } }).select('employeeId date late status checkIn checkOut rules').lean(),
    leaveService.approvedLeaveMap(ids, from, end, ctx.settings.weekend),
  ]);
  const recBy = new Map(records.map((r) => [`${r.employeeId}|${r.date}`, r]));
  const rows = [];
  for (const e of emps) {
    const s = from > e.joinDate ? from : e.joinDate;
    const eEnd = e.exitDate && e.exitDate < end ? e.exitDate : end;
    const leaves = leaveMap.get(String(e._id)) || {};
    for (const d of listWorkingDays(s, eEnd, { weekend: ctx.settings.weekend, holidays })) {
      const rec = recBy.get(`${e._id}|${d}`);
      let status;
      let late = false;
      if (rec) {
        status = effectiveStatus(rec, ctx.today);
        late = !!rec.late;
      } else if (leaves[d]) status = 'on_leave';
      else if (d < ctx.today) status = 'absent';
      else continue; // today, not checked in yet: undecided
      rows.push({ employeeId: String(e._id), departmentId: e.departmentId ? String(e.departmentId) : null, date: d, status, late });
    }
  }
  return rows;
}

const tally = (rows) => rows.reduce((c, r) => { c[r.status] += 1; return c; }, blankCounts());

async function departmentNames() {
  return new Map((await Department.find().select('name').lean()).map((d) => [String(d._id), d.name]));
}

/** Attendance KPIs, trend, by-department and late-comers for the caller's scope. */
async function attendanceSummary(user, q = {}) {
  const ctx = await getContext();
  const { from, to } = rangeFrom(ctx, q);
  const emps = await scopedEmployees(user, { from, to, departmentId: q.departmentId });
  const rows = await attendanceMatrix(emps, from, to, ctx);
  const counts = tally(rows);
  const names = await departmentNames();
  const empName = new Map(emps.map((e) => [String(e._id), e]));

  const byDate = new Map();
  const byDept = new Map();
  const lateBy = new Map();
  for (const r of rows) {
    if (!byDate.has(r.date)) byDate.set(r.date, []);
    byDate.get(r.date).push(r);
    const k = r.departmentId || 'none';
    if (!byDept.has(k)) byDept.set(k, []);
    byDept.get(k).push(r);
    if (r.late) lateBy.set(r.employeeId, (lateBy.get(r.employeeId) || 0) + 1);
  }
  const trend = [...byDate.keys()].sort().map((date) => {
    const c = tally(byDate.get(date));
    return { date, rate: metrics.attendanceRate(c), ...c };
  });
  const byDepartment = [...byDept.entries()].map(([id, rs]) => {
    const c = tally(rs);
    return { departmentId: id, name: names.get(id) || 'Unassigned', counts: c, attendanceRate: metrics.attendanceRate(c), latePercent: metrics.latePercent(c), absenteeismPercent: metrics.absenteeism(c.absent, rs.length) };
  }).sort((a, b) => a.name.localeCompare(b.name));
  const lateComers = [...lateBy.entries()]
    .map(([id, n]) => ({ employeeId: id, name: empName.get(id).name, code: empName.get(id).code, lateCount: n }))
    .sort((a, b) => b.lateCount - a.lateCount || a.name.localeCompare(b.name))
    .slice(0, 5);
  return {
    from, to,
    expectedWorkingDays: rows.length,
    counts,
    attendanceRate: metrics.attendanceRate(counts),
    latePercent: metrics.latePercent(counts),
    absenteeismPercent: metrics.absenteeism(counts.absent, rows.length),
    byDepartment, trend, lateComers,
  };
}

async function leaveSummary(user, q = {}) {
  const ctx = await getContext();
  const { from, to } = rangeFrom(ctx, q);
  const emps = await scopedEmployees(user, { from, to, departmentId: q.departmentId });
  const ids = emps.map((e) => e._id);
  const year = Number(to.slice(0, 4));
  const [types, inRange, yearAgg, pending] = await Promise.all([
    LeaveType.find().lean(),
    LeaveRequest.aggregate([
      { $match: { employeeId: { $in: ids }, status: 'approved', startDate: { $lte: to }, endDate: { $gte: from } } },
      { $group: { _id: '$leaveTypeId', days: { $sum: '$days' }, requests: { $sum: 1 } } },
    ]),
    LeaveRequest.aggregate([
      { $match: { employeeId: { $in: ids }, status: 'approved', year } },
      { $group: { _id: '$leaveTypeId', days: { $sum: '$days' } } },
    ]),
    LeaveRequest.countDocuments({ employeeId: { $in: ids }, status: 'pending' }),
  ]);
  const headcount = emps.filter((e) => e.status !== 'exited').length;
  const byType = types.map((t) => {
    const r = inRange.find((x) => String(x._id) === String(t._id)) || { days: 0, requests: 0 };
    const y = yearAgg.find((x) => String(x._id) === String(t._id)) || { days: 0 };
    return {
      code: t.code, name: t.name, approvedDays: r.days, requests: r.requests, approvedDaysYear: y.days,
      quotaPerEmployee: t.unlimited ? null : t.annualQuota,
      utilizationPercent: t.unlimited ? null : metrics.leaveUtilization(y.days, t.annualQuota * headcount),
    };
  });
  return { from, to, year, pendingRequests: pending, byType };
}

/** Headcount "as of" a date: joined on/before it and not exited by it (active + probation). */
async function headcountSummary(user, q = {}) {
  const ctx = await getContext();
  const asOf = q.to || ctx.today;
  const emps = await scopedEmployees(user, { activeOn: asOf, departmentId: q.departmentId });
  const names = await departmentNames();
  const by = new Map();
  for (const e of emps) {
    const k = e.departmentId ? String(e.departmentId) : 'none';
    by.set(k, (by.get(k) || 0) + 1);
  }
  return { asOf, headcount: emps.length, byDepartment: [...by.entries()].map(([id, n]) => ({ departmentId: id, name: names.get(id) || 'Unassigned', headcount: n })).sort((a, b) => a.name.localeCompare(b.name)) };
}

async function todayKpis(user, q = {}) {
  const ctx = await getContext();
  const emps = await scopedEmployees(user, { activeOn: ctx.today, departmentId: q.departmentId });
  const ids = emps.map((e) => e._id);
  const [recs, leaveMap, pendingLeaves, pendingCorrections] = await Promise.all([
    Attendance.find({ employeeId: { $in: ids }, date: ctx.today }).select('employeeId late').lean(),
    leaveService.approvedLeaveMap(ids, ctx.today, ctx.today, ctx.settings.weekend),
    LeaveRequest.countDocuments({ employeeId: { $in: ids }, status: 'pending' }),
    AttendanceCorrection.countDocuments({ employeeId: { $in: ids }, status: 'pending' }),
  ]);
  const checked = new Set(recs.map((r) => String(r.employeeId)));
  const onLeave = [...leaveMap.entries()].filter(([id, days]) => days[ctx.today] && !checked.has(id)).length;
  return {
    date: ctx.today,
    headcount: emps.length,
    presentToday: recs.length,
    onLeaveToday: onLeave,
    lateToday: recs.filter((r) => r.late).length,
    pendingApprovals: pendingLeaves + pendingCorrections,
    pendingLeaves,
    pendingCorrections,
  };
}

async function latestAnnouncements(limit = 5) {
  const rows = await Announcement.find().sort({ createdAt: -1 }).limit(limit).lean();
  return rows.map((a) => ({ id: String(a._id), title: a.title, body: a.body, authorName: a.authorName, createdAt: a.createdAt }));
}

async function hrDashboard(user, q = {}) {
  const [kpis, attendance, leave, announcements] = await Promise.all([todayKpis(user, q), attendanceSummary(user, q), leaveSummary(user, q), latestAnnouncements()]);
  return { filters: { from: attendance.from, to: attendance.to, departmentId: q.departmentId || null }, kpis, attendance, leave, announcements };
}

async function adminDashboard(user, q = {}) {
  const ctx = await getContext();
  const { from, to } = rangeFrom(ctx, q);
  const year = Number(ctx.today.slice(0, 4));
  const yearStart = `${year}-01-01`;
  const deptFilter = q.departmentId ? { departmentId: oid(q.departmentId) } : {};

  const [kpis, attendance, leave, announcements, active, headNow, headStart, exits, costByMonth, auditFeed] = await Promise.all([
    todayKpis(user, q),
    attendanceSummary(user, q),
    leaveSummary(user, q),
    latestAnnouncements(),
    Employee.find({ status: { $ne: 'exited' }, ...deptFilter }).populate('departmentId', 'name').populate('designationId', 'title').select('salary gender joinDate departmentId designationId').lean(),
    Employee.countDocuments({ ...deptFilter, joinDate: { $lte: ctx.today }, $or: [{ exitDate: null }, { exitDate: { $gt: ctx.today } }] }),
    Employee.countDocuments({ ...deptFilter, joinDate: { $lte: yearStart }, $or: [{ exitDate: null }, { exitDate: { $gt: yearStart } }] }),
    Employee.countDocuments({ ...deptFilter, exitDate: { $gte: yearStart, $lte: ctx.today } }),
    Payslip.aggregate([
      { $match: { month: { $gte: `${year - 1}-01`, $lte: `${year}-12` }, ...(q.departmentId ? { 'employee.departmentId': oid(q.departmentId) } : {}) } },
      { $group: { _id: '$month', gross: { $sum: '$payableGross' }, net: { $sum: '$net' }, tax: { $sum: '$tax' }, headcount: { $sum: 1 }, finalized: { $min: '$finalized' } } },
      { $sort: { _id: 1 } },
    ]),
    AuditLog.find().sort({ createdAt: -1 }).limit(8).select('actorName actorRole action summary entity createdAt').lean(),
  ]);
  const latestMonth = costByMonth.length ? costByMonth[costByMonth.length - 1]._id : null;
  const costByDept = latestMonth
    ? await Payslip.aggregate([
        { $match: { month: latestMonth, ...(q.departmentId ? { 'employee.departmentId': oid(q.departmentId) } : {}) } },
        { $group: { _id: '$employee.department', gross: { $sum: '$payableGross' }, net: { $sum: '$net' } } },
        { $sort: { _id: 1 } },
      ])
    : [];

  const withGross = active.map((e) => ({ ...e, gross: salaryStructure(e.salary.basic, ctx.settings.payroll).gross }));
  const mean = (arr) => (arr.length ? round2(arr.reduce((a, x) => a + x.gross, 0) / arr.length) : 0);
  const group = (keyFn) => {
    const m = new Map();
    for (const e of withGross) { const k = keyFn(e); if (!m.has(k)) m.set(k, []); m.get(k).push(e); }
    return [...m.entries()].map(([name, list]) => ({ name, headcount: list.length, avgGross: mean(list) })).sort((a, b) => a.name.localeCompare(b.name));
  };
  const gender = { male: 0, female: 0, other: 0 };
  const tenure = { 'under 1 year': 0, '1-3 years': 0, '3-5 years': 0, '5+ years': 0 };
  for (const e of active) {
    gender[e.gender] = (gender[e.gender] || 0) + 1;
    const yrs = (Date.parse(`${ctx.today}T00:00:00Z`) - Date.parse(`${e.joinDate}T00:00:00Z`)) / (365.25 * 864e5);
    if (yrs < 1) tenure['under 1 year'] += 1; else if (yrs < 3) tenure['1-3 years'] += 1; else if (yrs < 5) tenure['3-5 years'] += 1; else tenure['5+ years'] += 1;
  }
  return {
    filters: { from, to, departmentId: q.departmentId || null },
    kpis: {
      ...kpis,
      headcount: active.length,
      attritionYtdPercent: metrics.attrition(exits, headStart, headNow),
      exitsYtd: exits,
      avgGross: mean(withGross),
      payrollCostLatest: costByMonth.length ? { month: latestMonth, gross: round2(costByMonth[costByMonth.length - 1].gross), net: round2(costByMonth[costByMonth.length - 1].net), finalized: !!costByMonth[costByMonth.length - 1].finalized } : null,
    },
    headcountByDepartment: group((e) => (e.departmentId ? e.departmentId.name : 'Unassigned')).map((g) => ({ name: g.name, headcount: g.headcount })),
    avgGrossByDepartment: group((e) => (e.departmentId ? e.departmentId.name : 'Unassigned')).map((g) => ({ name: g.name, avgGross: g.avgGross })),
    avgGrossByDesignation: group((e) => (e.designationId ? e.designationId.title : 'Unassigned')).map((g) => ({ name: g.name, avgGross: g.avgGross })),
    gender, tenure,
    payrollCostByMonth: costByMonth.map((c) => ({ month: c._id, gross: round2(c.gross), net: round2(c.net), tax: round2(c.tax), headcount: c.headcount, finalized: !!c.finalized })),
    payrollCostByDepartment: costByDept.map((c) => ({ name: c._id || 'Unassigned', gross: round2(c.gross), net: round2(c.net) })),
    attendance, leave, announcements,
    auditFeed: auditFeed.map((a) => ({ id: String(a._id), actor: a.actorName, role: a.actorRole, action: a.action, summary: a.summary, createdAt: a.createdAt })),
  };
}

async function employeeDashboard(user) {
  if (!user.employeeId) throw AppError.forbidden('This account has no employee record');
  const ctx = await getContext();
  const emp = await Employee.findById(user.employeeId).lean();
  const weekStart = startOfWeek(ctx.today);
  const monthStart = `${ctx.today.slice(0, 7)}-01`;
  const [todayRec, weekRecs, monthRows, balances, lastSlip, unread] = await Promise.all([
    Attendance.findOne({ employeeId: emp._id, date: ctx.today }).lean(),
    Attendance.find({ employeeId: emp._id, date: { $gte: weekStart, $lte: ctx.today } }).lean(),
    attendanceMatrix([emp], monthStart, ctx.today, ctx),
    leaveService.balances(emp._id, Number(ctx.today.slice(0, 4))),
    Payslip.findOne({ employeeId: emp._id, finalized: true }).sort({ month: -1 }).lean(),
    Notification.countDocuments({ userId: user.id, read: false }),
  ]);
  const { shapeRecord } = require('./attendanceService');
  const weekMinutes = weekRecs.reduce((a, r) => a + (r.checkOut ? r.workedMinutes : 0), 0);
  // Open check-in today: count the running time so the widget moves during the day.
  const running = todayRec && !todayRec.checkOut ? Math.max(0, Math.floor((Date.now() - new Date(todayRec.checkIn).getTime()) / 60000)) : 0;
  const counts = tally(monthRows);
  return {
    kpis: {
      date: ctx.today,
      todayRecord: todayRec ? shapeRecord(todayRec, ctx.today) : null,
      weekMinutes: weekMinutes + running,
      weekTargetMinutes: 40 * 60,
      lateCountThisMonth: monthRows.filter((r) => r.late).length,
      monthSummary: counts,
      leaveBalances: balances,
      lastPayslip: lastSlip ? { id: String(lastSlip._id), month: lastSlip.month, net: lastSlip.net } : null,
      unreadNotifications: unread,
    },
    announcements: await latestAnnouncements(),
  };
}

async function payrollSummary(user, { month }) {
  if (!['admin', 'hr'].includes(user.role)) throw AppError.forbidden('Payroll data is restricted to HR and Admin');
  const ctx = await getContext();
  const m = month || ctx.today.slice(0, 7);
  const rows = await Payslip.aggregate([
    { $match: { month: m } },
    { $group: { _id: '$employee.department', gross: { $sum: '$payableGross' }, net: { $sum: '$net' }, tax: { $sum: '$tax' }, headcount: { $sum: 1 }, finalized: { $min: '$finalized' } } },
    { $sort: { _id: 1 } },
  ]);
  return {
    month: m,
    totalGross: round2(rows.reduce((a, r) => a + r.gross, 0)),
    totalNet: round2(rows.reduce((a, r) => a + r.net, 0)),
    employees: rows.reduce((a, r) => a + r.headcount, 0),
    finalized: rows.length > 0 && rows.every((r) => r.finalized),
    byDepartment: rows.map((r) => ({ department: r._id || 'Unassigned', gross: round2(r.gross), net: round2(r.net), headcount: r.headcount })),
  };
}

module.exports = { rangeFrom, scopedEmployees, attendanceMatrix, attendanceSummary, leaveSummary, headcountSummary, todayKpis, hrDashboard, adminDashboard, employeeDashboard, payrollSummary, weekdayOf };
