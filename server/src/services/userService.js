'use strict';
const { User, Employee } = require('../models');
const AppError = require('../utils/AppError');
const { env } = require('../config/env');
const { pageParams, pageMeta, escapeRegex } = require('../utils/pagination');
const { temporaryPassword } = require('../utils/tokens');
const { hashPassword } = require('./authService');
const employeeService = require('./employeeService');
const audit = require('./auditService');
const mail = require('./mailService');

const present = (u) => ({
  id: String(u._id),
  name: u.name,
  email: u.email,
  role: u.role,
  active: u.active,
  mustChangePassword: u.mustChangePassword,
  lastLoginAt: u.lastLoginAt,
  employeeId: u.employeeId ? String(u.employeeId) : null,
  createdAt: u.createdAt,
});

async function list(q) {
  const { page, limit, skip } = pageParams(q);
  const filter = {};
  if (q.role) filter.role = q.role;
  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), 'i');
    filter.$or = [{ name: rx }, { email: rx }];
  }
  const [rows, total] = await Promise.all([User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), User.countDocuments(filter)]);
  return { data: rows.map(present), pagination: pageMeta(page, limit, total) };
}

const createHr = (actor, data, ip) => employeeService.register(actor, data, 'hr', ip);

async function setActive(actor, id, active, ip) {
  const u = await User.findById(id);
  if (!u) throw AppError.notFound('User not found');
  if (String(u._id) === actor.id) throw AppError.unprocessable('You cannot change your own login status', 'SELF_ACTION');
  if (u.role === 'admin' && !active && (await User.countDocuments({ role: 'admin', active: true, _id: { $ne: u._id } })) === 0) {
    throw AppError.conflict('Cannot deactivate the last active administrator', 'LAST_ADMIN');
  }
  const before = { active: u.active };
  u.active = active;
  if (!active) u.tokenVersion += 1; // kills existing sessions immediately
  await u.save();
  await audit.record(actor, active ? 'user.activate' : 'user.deactivate', 'user', u._id, { before, after: { active }, summary: `${active ? 'Activated' : 'Deactivated'} login of ${u.name}`, ip });
  return present(u);
}

async function resetPassword(actor, id, ip) {
  const u = await User.findById(id);
  if (!u) throw AppError.notFound('User not found');
  if (String(u._id) === actor.id) throw AppError.unprocessable('Use "change password" for your own account', 'SELF_ACTION');
  const temp = temporaryPassword();
  u.passwordHash = await hashPassword(temp);
  u.mustChangePassword = true;
  u.tokenVersion += 1;
  u.resetTokenHash = null;
  u.resetTokenExpires = null;
  await u.save();
  await audit.record(actor, 'user.reset_password', 'user', u._id, { summary: `Password reset for ${u.name}`, ip });
  const t = mail.templates.passwordResetByAdmin(u.name, temp, `${env.appUrl}/login`);
  await mail.sendMail({ to: u.email, ...t });
  const out = { user: present(u) };
  if (env.exposeTempPassword) out.temporaryPassword = temp;
  return out;
}

module.exports = { list, createHr, setActive, resetPassword, present };
