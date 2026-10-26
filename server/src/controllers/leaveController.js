'use strict';
const asyncHandler = require('../utils/asyncHandler');
const { ok, paged } = require('./respond');
const svc = require('../services/leaveService');

exports.preview = asyncHandler(async (req, res) => ok(res, await svc.preview(req.user, req.valid.body)));
exports.apply = asyncHandler(async (req, res) => ok(res, await svc.apply(req.user, req.valid.body, req.ip), 201));
exports.list = asyncHandler(async (req, res) => paged(res, await svc.list(req.user, req.valid.query)));
exports.balance = asyncHandler(async (req, res) => ok(res, await svc.balanceFor(req.user, req.valid.query.employeeId, req.valid.query.year)));
exports.cancel = asyncHandler(async (req, res) => ok(res, await svc.cancel(req.user, req.params.id, req.ip)));
exports.decide = asyncHandler(async (req, res) => ok(res, await svc.decide(req.user, req.params.id, req.valid.body.decision, req.valid.body.comment, req.ip)));
