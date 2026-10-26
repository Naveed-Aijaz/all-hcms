'use strict';
const mongoose = require('mongoose');
const { Employee, User, Department, Designation, Counter, LeaveRequest } = require('../models');
const AppError = require('../utils/AppError');
const { env } = require('../config/env');
const { employeeFilter, isEmployeeInScope } = require('../utils/scope');
const { pageParams, pageMeta, escapeRegex } = require('../utils/pagination');
const { temporaryPassword } = require('../utils/tokens');
const { hashPassword } = require('./authService');
const { getSettings } = require('./settingsService');
const audit = require('./auditService');
const mail = require('./mailService');
const { deleteProfilePhoto } = require('../middleware/upload');
const { salaryStructure } = require('../utils/payroll');

const POPULATE = [
  { path: 'departmentId', select: 'name' },
  { path: 'designationId', select: 'title' },
  { path: 'managerId', select: 'name code' },
];

const isHrOrAdmin = (u) => u.role === 'admin' || u.role === 'hr';

/** Public shape of an employee. Pay data is only included for Admin / HR viewers. */
function shape(e, viewer, payroll) {
  const o = e.toObject ? e.toObject() : e;
  const out = {
    id: String(o._id),
    code: o.code,
    name: o.name,
    email: o.email,
    phone: o.phone,
    address: o.address,
    gender: o.gender,
    dob: o.dob,
    role: o.role,
    status: o.status,
    joinDate: o.joinDate,
    exitDate: o.exitDate,
    photo: o.photo || null,
    department: o.departmentId && o.departmentId._id ? { id: String(o.departmentId._id), name: o.departmentId.name } : o.departmentId ? { id: String(o.departmentId), name: null } : null,
    designation: o.designationId && o.designationId._id ? { id: String(o.designationId._id), title: o.designationId.title } : null,
    manager: o.managerId && o.managerId._id ? { id: String(o.managerId._id), name: o.managerId.name, code: o.managerId.code } : null,
  };
  if (viewer && isHrOrAdmin(viewer)) {
    out.salary = salaryStructure(o.salary && o.salary.basic, payroll);
  }
  return out;
}

async function assertRefs({ departmentId, designationId, managerId }, selfId = null) {
  if (departmentId && !(await Department.exists({ _id: departmentId }))) throw AppError.unprocessable('Unknown department', 'UNKNOWN_DEPARTMENT');
  if (designationId && !(await Designation.exists({ _id: designationId }))) throw AppError.unprocessable('Unknown designation', 'UNKNOWN_DESIGNATION');
  if (managerId) {
    if (selfId && String(managerId) === String(selfId)) throw AppError.unprocessable('An employee cannot be their own manager', 'INVALID_MANAGER');
    const m = await Employee.findById(managerId).select('role status').lean();
    if (!m || m.status === 'exited') throw AppError.unprocessable('Unknown or inactive manager', 'INVALID_MANAGER');
    if (!['manager', 'hr'].includes(m.role)) throw AppError.unprocessable('The selected manager does not have the manager role', 'INVALID_MANAGER');
  }
}

async function nextCode() {
  const n = await Counter.next('employee');
  return `EMP-${String(n).padStart(4, '0')}`;
}

/**
 * Registers an employee AND their login (temporary password, must change at first sign-in).
 * `role` is decided by the caller: HR registers employee/manager, Admin creates hr.
 * No transactions (standalone MongoDB): the User is rolled back manually if the Employee fails.
 */
async function register(actor, data, role, ip) {
  await assertRefs(data);
  if (await User.exists({ email: data.email })) throw AppError.conflict('A login with this email already exists', 'DUPLICATE');
  const temp = temporaryPassword();
  const user = await User.create({
    name: data.name,
    email: data.email,
    passwordHash: await hashPassword(temp),
    role,
    mustChangePassword: true,
  });
  let emp;
  try {
    emp = await Employee.create({
      code: data.code || (await nextCode()),
      name: data.name,
      email: data.email,
      phone: data.phone || '',
      address: data.address || '',
      gender: data.gender || 'other',
      dob: data.dob || null,
      departmentId: data.departmentId,
      designationId: data.designationId || null,
      managerId: data.managerId || null,
      role,
      status: data.status || 'active',
      joinDate: data.joinDate,
      salary: { basic: data.basicSalary },
      userId: user._id,
    });
    user.employeeId = emp._id;
    await user.save();
  } catch (e) {
    await User.deleteOne({ _id: user._id });
    throw e;
  }
  await audit.record(actor, 'employee.create', 'employee', emp._id, { after: { code: emp.code, name: emp.name, email: emp.email, role, departmentId: emp.departmentId, joinDate: emp.joinDate, basicSalary: data.basicSalary }, summary: `Registered ${emp.name} (${emp.code})`, ip });
  const t = mail.templates.welcome(emp.name, emp.email, temp, `${env.appUrl}/login`);
  await mail.sendMail({ to: emp.email, ...t });
  const populated = await Employee.findById(emp._id).populate(POPULATE);
  const result = { employee: shape(populated, actor, (await getSettings()).payroll) };
  if (env.exposeTempPassword) result.temporaryPassword = temp; // development convenience only (see README)
  return result;
}

async function list(user, q) {
  const { page, limit, skip } = pageParams(q);
  const and = [employeeFilter(user)];
  if (q.departmentId) and.push({ departmentId: q.departmentId });
  if (q.status) and.push({ status: q.status });
  if (q.role) and.push({ role: q.role });
  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), 'i');
    and.push({ $or: [{ name: rx }, { code: rx }, { email: rx }] });
  }
  const filter = { $and: and };
  const sortMap = { name: { name: 1 }, '-name': { name: -1 }, joinDate: { joinDate: 1 }, '-joinDate': { joinDate: -1 }, code: { code: 1 } };
  const [rows, total, settings] = await Promise.all([
    Employee.find(filter).populate(POPULATE).sort(sortMap[q.sort] || { name: 1 }).skip(skip).limit(limit).lean(),
    Employee.countDocuments(filter),
    getSettings(),
  ]);
  return { data: rows.map((r) => shape(r, user, settings.payroll)), pagination: pageMeta(page, limit, total) };
}

async function getScoped(user, id) {
  if (!mongoose.isValidObjectId(id)) throw AppError.notFound('Employee not found');
  const e = await Employee.findById(id).populate(POPULATE);
  if (!e) throw AppError.notFound('Employee not found');
  if (!isEmployeeInScope(user, e)) throw AppError.forbidden('You can only view your own data');
  return e;
}

/** Employee 360: profile + this month's attendance + leave balances + recent leave. */
async function get360(user, id) {
  const e = await getScoped(user, id);
  const settings = await getSettings();
  const attendanceService = require('./attendanceService');
  const leaveService = require('./leaveService');
  const { dateInTz } = require('../utils/dates');
  const ym = dateInTz(new Date(), settings.timezone).slice(0, 7);
  const [month, balances, recentLeaves] = await Promise.all([
    attendanceService.monthView(e._id, ym),
    leaveService.balances(e._id, Number(ym.slice(0, 4))),
    LeaveRequest.find({ employeeId: e._id }).sort({ createdAt: -1 }).limit(5).populate('leaveTypeId', 'name code').lean(),
  ]);
  return {
    profile: shape(e, user, settings.payroll),
    attendance: { month: ym, summary: month.summary },
    leaveBalances: balances,
    recentLeaves: recentLeaves.map((l) => ({ id: String(l._id), type: l.leaveTypeId && l.leaveTypeId.name, startDate: l.startDate, endDate: l.endDate, days: l.days, status: l.status })),
  };
}

async function update(actor, id, data, ip) {
  const e = await Employee.findById(id);
  if (!e) throw AppError.notFound('Employee not found');
  if (e.status === 'exited') throw AppError.conflict('This employee has exited; their record is read-only', 'EMPLOYEE_EXITED');
  await assertRefs(data, e._id);
  if (data.email && data.email !== e.email && (await User.exists({ email: data.email, _id: { $ne: e.userId } }))) {
    throw AppError.conflict('A login with this email already exists', 'DUPLICATE');
  }
  if (e.role === 'hr' && data.role) throw AppError.forbidden('HR roles are managed by an administrator');
  const before = e.toObject();
  const fields = ['name', 'email', 'phone', 'address', 'gender', 'dob', 'departmentId', 'designationId', 'managerId', 'joinDate', 'status', 'role'];
  for (const f of fields) if (data[f] !== undefined) e[f] = data[f];
  await e.save();
  if (e.userId && (data.name || data.email || data.role)) {
    const u = await User.findById(e.userId);
    if (u) {
      if (data.name) u.name = data.name;
      if (data.email) u.email = data.email;
      if (data.role && u.role !== 'hr') u.role = data.role;
      await u.save();
    }
  }
  const changed = fields.filter((f) => data[f] !== undefined);
  await audit.record(actor, 'employee.update', 'employee', e._id, { before: pick(before, changed), after: pick(e.toObject(), changed), summary: `Updated ${e.name}`, ip });
  return shape(await Employee.findById(e._id).populate(POPULATE), actor, (await getSettings()).payroll);
}

const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o[k]]));

async function updateSalary(actor, id, basicSalary, ip) {
  const e = await Employee.findById(id);
  if (!e) throw AppError.notFound('Employee not found');
  if (e.status === 'exited') throw AppError.conflict('This employee has exited', 'EMPLOYEE_EXITED');
  const before = e.salary.basic;
  e.salary.basic = basicSalary;
  await e.save();
  await audit.record(actor, 'employee.salary_update', 'employee', e._id, { before: { basicSalary: before }, after: { basicSalary }, summary: `Salary structure changed for ${e.name}`, ip });
  const settings = await getSettings();
  return salaryStructure(basicSalary, settings.payroll);
}

/** "Delete" = exit: the record is kept for payroll history and audit integrity, the login is disabled. */
async function exit(actor, id, exitDate, ip) {
  const e = await Employee.findById(id);
  if (!e) throw AppError.notFound('Employee not found');
  if (e.status === 'exited') throw AppError.conflict('Employee has already exited', 'EMPLOYEE_EXITED');
  if (actor.employeeId && String(actor.employeeId) === String(e._id)) throw AppError.unprocessable('You cannot exit your own record', 'SELF_ACTION');
  if (exitDate < e.joinDate) throw AppError.unprocessable('Exit date cannot be before the join date', 'INVALID_DATE');
  if (e.role === 'hr') throw AppError.forbidden('HR accounts are deactivated by an administrator');
  const before = { status: e.status, exitDate: e.exitDate };
  e.status = 'exited';
  e.exitDate = exitDate;
  await e.save();
  if (e.userId) await User.updateOne({ _id: e.userId }, { $set: { active: false }, $inc: { tokenVersion: 1 } });
  await LeaveRequest.updateMany({ employeeId: e._id, status: 'pending' }, { $set: { status: 'cancelled', decisionComment: 'Employee exited' } });
  await Employee.updateMany({ managerId: e._id }, { $set: { managerId: null } });
  await audit.record(actor, 'employee.exit', 'employee', e._id, { before, after: { status: 'exited', exitDate }, summary: `${e.name} exited on ${exitDate}`, ip });
  return { id: String(e._id), status: 'exited', exitDate };
}

async function updateSelf(actor, data, ip) {
  if (!actor.employeeId) throw AppError.forbidden('This account has no employee record');
  const e = await Employee.findById(actor.employeeId);
  const before = { phone: e.phone, address: e.address };
  if (data.phone !== undefined) e.phone = data.phone;
  if (data.address !== undefined) e.address = data.address;
  await e.save();
  await audit.record(actor, 'employee.self_update', 'employee', e._id, { before, after: { phone: e.phone, address: e.address }, ip });
  return shape(await Employee.findById(e._id).populate(POPULATE), actor);
}

async function setPhoto(actor, targetId, filename, ip) {
  const e = await Employee.findById(targetId);
  if (!e) {
    await deleteProfilePhoto(filename);
    throw AppError.notFound('Employee not found');
  }
  const old = e.photo;
  e.photo = filename;
  await e.save();
  await deleteProfilePhoto(old);
  await audit.record(actor, 'employee.photo', 'employee', e._id, { summary: 'Profile photo updated', ip });
  return { photo: filename };
}

module.exports = { shape, register, list, getScoped, get360, update, updateSalary, exit, updateSelf, setPhoto, assertRefs, nextCode, POPULATE };
