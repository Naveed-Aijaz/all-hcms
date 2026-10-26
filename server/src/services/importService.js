'use strict';
const { Employee, User, Department, Designation } = require('../models');
const AppError = require('../utils/AppError');
const { parseCsv, toCsv } = require('../utils/csv');
const { isValidISODate } = require('../utils/dates');
const employeeService = require('./employeeService');
const { env } = require('../config/env');

const COLUMNS = ['code', 'name', 'email', 'phone', 'gender', 'dob', 'department', 'designation', 'manager_code', 'join_date', 'basic_salary', 'role'];
const REQUIRED = ['name', 'email', 'department', 'join_date', 'basic_salary'];
const MAX_ROWS = 500;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validates every row and returns { rows, errors:[{row, field, reason}] }. Nothing is written. */
async function analyse(text) {
  const table = parseCsv(text);
  if (table.length === 0) throw AppError.unprocessable('The CSV file is empty', 'EMPTY_FILE');
  const header = table[0].map((h) => h.trim().toLowerCase());
  const missing = REQUIRED.filter((c) => !header.includes(c));
  if (missing.length) throw AppError.unprocessable(`Missing required column(s): ${missing.join(', ')}`, 'BAD_HEADER');
  const unknown = header.filter((c) => c && !COLUMNS.includes(c));
  if (unknown.length) throw AppError.unprocessable(`Unknown column(s): ${unknown.join(', ')}`, 'BAD_HEADER');
  const body = table.slice(1);
  if (body.length === 0) throw AppError.unprocessable('The CSV has a header but no data rows', 'EMPTY_FILE');
  if (body.length > MAX_ROWS) throw AppError.unprocessable(`At most ${MAX_ROWS} rows per import`, 'TOO_MANY_ROWS');

  const [depts, desigs, dbEmails, dbCodes, managers] = await Promise.all([
    Department.find().lean(),
    Designation.find().lean(),
    Promise.all([Employee.find().select('email').lean(), User.find().select('email').lean()]).then(([a, b]) => new Set([...a, ...b].map((x) => x.email))),
    Employee.find().select('code').lean().then((a) => new Set(a.map((x) => x.code))),
    Employee.find({ role: { $in: ['manager', 'hr'] }, status: { $ne: 'exited' } }).select('code').lean(),
  ]);
  const deptByName = new Map(depts.map((d) => [d.name.toLowerCase(), d]));
  const desigByTitle = new Map(desigs.map((d) => [d.title.toLowerCase(), d]));
  const managerByCode = new Map(managers.map((m) => [m.code, m]));

  const errors = [];
  const rows = [];
  const seenEmail = new Set();
  const seenCode = new Set();
  body.forEach((cells, i) => {
    const rowNo = i + 2; // spreadsheet row number (header = 1)
    const r = {};
    header.forEach((h, idx) => { r[h] = (cells[idx] || '').trim(); });
    const err = (field, reason) => errors.push({ row: rowNo, field, reason });

    for (const f of REQUIRED) if (!r[f]) err(f, 'Required');
    if (r.name && r.name.length > 120) err('name', 'Too long (max 120)');
    if (r.email) {
      const em = r.email.toLowerCase();
      if (!EMAIL_RE.test(em) || em.length > 254) err('email', 'Invalid email address');
      else if (dbEmails.has(em)) err('email', 'Email already exists');
      else if (seenEmail.has(em)) err('email', 'Duplicate email in file');
      seenEmail.add(em);
    }
    if (r.code) {
      const code = r.code.toUpperCase();
      if (!/^[A-Z0-9_-]{1,30}$/.test(code)) err('code', 'Letters, numbers, - and _ only');
      else if (dbCodes.has(code)) err('code', 'Employee code already exists');
      else if (seenCode.has(code)) err('code', 'Duplicate code in file');
      seenCode.add(code);
    }
    const dept = r.department ? deptByName.get(r.department.toLowerCase()) : null;
    if (r.department && !dept) err('department', `Unknown department "${r.department}"`);
    const desig = r.designation ? desigByTitle.get(r.designation.toLowerCase()) : null;
    if (r.designation && !desig) err('designation', `Unknown designation "${r.designation}"`);
    if (r.join_date && !isValidISODate(r.join_date)) err('join_date', 'Must be an ISO date (YYYY-MM-DD)');
    if (r.dob && !isValidISODate(r.dob)) err('dob', 'Must be an ISO date (YYYY-MM-DD)');
    const salary = Number(r.basic_salary);
    if (r.basic_salary && !(Number.isFinite(salary) && salary > 0)) err('basic_salary', 'Must be a number greater than 0');
    if (r.gender && !['male', 'female', 'other'].includes(r.gender.toLowerCase())) err('gender', 'Must be male, female or other');
    if (r.role && !['employee', 'manager'].includes(r.role.toLowerCase())) err('role', 'Must be employee or manager');
    if (r.phone && !/^[0-9+()\-\s]{1,30}$/.test(r.phone)) err('phone', 'Invalid phone number');
    const mgr = r.manager_code ? managerByCode.get(r.manager_code.toUpperCase()) : null;
    if (r.manager_code && !mgr) err('manager_code', `No manager with code "${r.manager_code}"`);

    rows.push({
      code: r.code ? r.code.toUpperCase() : undefined,
      name: r.name,
      email: (r.email || '').toLowerCase(),
      phone: r.phone || '',
      gender: r.gender ? r.gender.toLowerCase() : 'other',
      dob: r.dob || null,
      departmentId: dept ? String(dept._id) : null,
      designationId: desig ? String(desig._id) : null,
      managerId: mgr ? String(mgr._id) : null,
      joinDate: r.join_date,
      basicSalary: salary,
      role: r.role ? r.role.toLowerCase() : 'employee',
    });
  });
  return { rows, errors };
}

async function dryRun(text) {
  const { rows, errors } = await analyse(text);
  const badRows = new Set(errors.map((e) => e.row));
  return { dryRun: true, total: rows.length, valid: rows.length - badRows.size, errors };
}

/** All-or-nothing: if validation finds any error nothing is imported. */
async function importCsv(actor, text, ip) {
  const { rows, errors } = await analyse(text);
  if (errors.length) throw AppError.unprocessable('The file has errors; nothing was imported. Run a dry run to review them.', 'IMPORT_ERRORS', errors);
  const created = [];
  for (const r of rows) {
    const { role, ...data } = r;
    // eslint-disable-next-line no-await-in-loop
    const res = await employeeService.register(actor, data, role, ip);
    created.push({ id: res.employee.id, code: res.employee.code, name: res.employee.name, email: res.employee.email, ...(env.exposeTempPassword ? { temporaryPassword: res.temporaryPassword } : {}) });
  }
  return { dryRun: false, imported: created.length, employees: created };
}

async function exportCsv() {
  const emps = await Employee.find().populate('departmentId', 'name').populate('designationId', 'title').populate('managerId', 'code').sort({ code: 1 }).lean();
  const rows = [COLUMNS];
  for (const e of emps) {
    rows.push([e.code, e.name, e.email, e.phone, e.gender, e.dob || '', e.departmentId ? e.departmentId.name : '', e.designationId ? e.designationId.title : '', e.managerId ? e.managerId.code : '', e.joinDate, e.salary.basic, e.role]);
  }
  return toCsv(rows);
}

module.exports = { dryRun, importCsv, exportCsv, analyse, COLUMNS };
