'use strict';
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('./respond');
const authService = require('../services/authService');
const { User } = require('../models');

exports.setupStatus = asyncHandler(async (req, res) => ok(res, await authService.setupStatus()));
exports.setup = asyncHandler(async (req, res) => ok(res, await authService.setup(req.valid.body, req.ip), 201));
exports.login = asyncHandler(async (req, res) => ok(res, await authService.login(req.valid.body.email, req.valid.body.password, req.ip)));
exports.me = asyncHandler(async (req, res) => {
  const u = await User.findById(req.user.id);
  ok(res, authService.publicUser(u, await authService.loadEmployee(u)));
});
exports.changePassword = asyncHandler(async (req, res) => ok(res, await authService.changePassword(req.user, req.valid.body.currentPassword, req.valid.body.newPassword, req.ip)));
exports.forgot = asyncHandler(async (req, res) => {
  await authService.forgotPassword(req.valid.body.email);
  ok(res, { message: 'If an account exists for that email, a reset link has been sent.' });
});
exports.reset = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.valid.body.token, req.valid.body.newPassword, req.ip);
  ok(res, { message: 'Password updated. You can now sign in.' });
});
exports.logout = asyncHandler(async (req, res) => ok(res, { message: 'Signed out' })); // JWTs are stateless; the client discards the token
