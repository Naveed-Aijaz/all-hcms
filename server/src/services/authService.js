'use strict';
const bcrypt = require('bcryptjs');
const { env } = require('../config/env');
const { User, Settings, LeaveType, Employee } = require('../models');
const AppError = require('../utils/AppError');
const { signToken } = require('../middleware/auth');
const { newOpaqueToken, hashToken } = require('../utils/tokens');
const audit = require('./auditService');
const mail = require('./mailService');
const logger = require('../utils/logger');

// Used to equalise response time when the email does not exist (mitigates user enumeration by timing).
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', env.bcryptRounds);

const hashPassword = (plain) => bcrypt.hash(plain, env.bcryptRounds);

function publicUser(u, employee = null) {
  return {
    id: String(u._id),
    name: u.name,
    email: u.email,
    role: u.role,
    employeeId: u.employeeId ? String(u.employeeId) : null,
    mustChangePassword: !!u.mustChangePassword,
    photo: employee ? employee.photo || null : null,
  };
}

async function loadEmployee(user) {
  return user.employeeId ? Employee.findById(user.employeeId).select('photo').lean() : null;
}

async function login(email, password, ip) {
  const user = await User.findOne({ email }).select('+passwordHash');
  const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !ok || !user.active) throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  user.lastLoginAt = new Date();
  await user.save();
  await audit.record({ id: user._id, name: user.name, role: user.role }, 'auth.login', 'user', user._id, { ip });
  return { token: signToken(user), user: publicUser(user, await loadEmployee(user)) };
}

async function changePassword(actor, currentPassword, newPassword, ip) {
  const user = await User.findById(actor.id).select('+passwordHash');
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw AppError.unauthorized('Current password is incorrect', 'INVALID_CREDENTIALS');
  }
  if (await bcrypt.compare(newPassword, user.passwordHash)) throw AppError.unprocessable('New password must be different from the current one', 'PASSWORD_REUSED');
  user.passwordHash = await hashPassword(newPassword);
  user.mustChangePassword = false;
  user.tokenVersion += 1; // signs out every other session
  await user.save();
  await audit.record(actor, 'auth.password_changed', 'user', user._id, { ip });
  return { token: signToken(user), user: publicUser(user, await loadEmployee(user)) };
}

/** Always resolves the same way, whether or not the email exists. */
async function forgotPassword(email) {
  const user = await User.findOne({ email, active: true });
  if (!user) return;
  const { token, hash } = newOpaqueToken();
  user.resetTokenHash = hash;
  user.resetTokenExpires = new Date(Date.now() + env.resetTokenTtlMinutes * 60 * 1000);
  await user.save(); // a newer request replaces (invalidates) any earlier token
  const link = `${env.appUrl}/reset-password?token=${token}`;
  const t = mail.templates.passwordReset(user.name, link, env.resetTokenTtlMinutes);
  await mail.sendMail({ to: user.email, ...t });
  await audit.record({ id: user._id, name: user.name, role: user.role }, 'auth.reset_requested', 'user', user._id);
}

/** Atomic and single-use: the token hash is cleared by the same update that consumes it. */
async function resetPassword(token, newPassword, ip) {
  const passwordHash = await hashPassword(newPassword);
  const user = await User.findOneAndUpdate(
    { resetTokenHash: hashToken(token), resetTokenExpires: { $gt: new Date() }, active: true },
    { $set: { passwordHash, mustChangePassword: false, resetTokenHash: null, resetTokenExpires: null }, $inc: { tokenVersion: 1 } },
    { new: true },
  );
  if (!user) throw AppError.bad('This reset link is invalid or has expired', 'RESET_TOKEN_INVALID');
  await audit.record({ id: user._id, name: user.name, role: user.role }, 'auth.password_reset', 'user', user._id, { ip });
}

async function setupStatus() {
  return { needsSetup: (await User.countDocuments()) === 0 };
}

const DEFAULT_LEAVE_TYPES = [
  { name: 'Annual', code: 'ANNUAL', annualQuota: 14, paid: true },
  { name: 'Sick', code: 'SICK', annualQuota: 8, paid: true },
  { name: 'Casual', code: 'CASUAL', annualQuota: 10, paid: true },
  { name: 'Unpaid', code: 'UNPAID', annualQuota: 0, unlimited: true, paid: false },
];

/** First-run setup: only works while there are no users at all. */
async function setup({ companyName, adminName, adminEmail, adminPassword, seedDefaults = true }, ip) {
  if ((await User.countDocuments()) > 0) throw AppError.conflict('Setup has already been completed', 'SETUP_DONE');
  const passwordHash = await hashPassword(adminPassword);
  const admin = await User.create({ name: adminName, email: adminEmail, passwordHash, role: 'admin' });
  await Settings.findOneAndUpdate({ key: 'main' }, { $setOnInsert: { companyName } }, { upsert: true });
  if (seedDefaults) {
    for (const lt of DEFAULT_LEAVE_TYPES) {
      await LeaveType.updateOne({ code: lt.code }, { $setOnInsert: lt }, { upsert: true });
    }
  }
  await audit.record({ id: admin._id, name: admin.name, role: 'admin' }, 'setup.completed', 'company', 'main', { after: { companyName, adminEmail }, ip });
  return { token: signToken(admin), user: publicUser(admin) };
}

/** Optional: create the Admin from ADMIN_EMAIL / ADMIN_PASSWORD when the database is empty. */
async function bootstrapFromEnv() {
  const { email, password, name, company } = env.bootstrap;
  if (!email || !password) return false;
  if ((await User.countDocuments()) > 0) return false;
  try {
    await setup({ companyName: company, adminName: name, adminEmail: email.toLowerCase(), adminPassword: password, seedDefaults: true });
    logger.info('Admin account created from environment variables');
    return true;
  } catch (e) {
    logger.error('Admin bootstrap failed', { message: e.message });
    return false;
  }
}

module.exports = { login, changePassword, forgotPassword, resetPassword, setup, setupStatus, bootstrapFromEnv, hashPassword, publicUser, loadEmployee, DEFAULT_LEAVE_TYPES };
