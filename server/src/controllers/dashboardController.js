'use strict';
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('./respond');
const svc = require('../services/dashboardService');

exports.admin = asyncHandler(async (req, res) => ok(res, await svc.adminDashboard(req.user, req.valid.query)));
exports.hr = asyncHandler(async (req, res) => ok(res, await svc.hrDashboard(req.user, req.valid.query)));
exports.me = asyncHandler(async (req, res) => ok(res, await svc.employeeDashboard(req.user)));
