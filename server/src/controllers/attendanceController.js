'use strict';
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { ok, paged } = require('./respond');
const svc = require('../services/attendanceService');
const employeeService = require('../services/employeeService');
const { getContext } = require('../services/settingsService');

exports.checkIn = asyncHandler(async (req, res) => ok(res, await svc.checkIn(req.user, req.ip), 201));
exports.checkOut = asyncHandler(async (req, res) => ok(res, await svc.checkOut(req.user, req.ip)));
exports.today = asyncHandler(async (req, res) => ok(res, await svc.today(req.user)));
exports.myMonth = asyncHandler(async (req, res) => {
  if (!req.user.employeeId) throw AppError.forbidden('This account has no employee record');
  const ctx = await getContext();
  ok(res, await svc.monthView(req.user.employeeId, req.valid.query.month || ctx.today.slice(0, 7)));
});
exports.employeeMonth = asyncHandler(async (req, res) => {
  await employeeService.getScoped(req.user, req.params.id); // enforces the data scope
  const ctx = await getContext();
  ok(res, await svc.monthView(req.params.id, req.valid.query.month || ctx.today.slice(0, 7)));
});
exports.board = asyncHandler(async (req, res) => ok(res, await svc.board(req.user, req.valid.query)));
exports.createCorrection = asyncHandler(async (req, res) => ok(res, await svc.createCorrection(req.user, req.valid.body, req.ip), 201));
exports.listCorrections = asyncHandler(async (req, res) => paged(res, await svc.listCorrections(req.user, req.valid.query)));
exports.decideCorrection = asyncHandler(async (req, res) => ok(res, await svc.decideCorrection(req.user, req.params.id, req.valid.body.decision, req.valid.body.comment, req.ip)));
