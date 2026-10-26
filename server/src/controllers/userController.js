'use strict';
const asyncHandler = require('../utils/asyncHandler');
const { ok, paged } = require('./respond');
const userService = require('../services/userService');

exports.list = asyncHandler(async (req, res) => paged(res, await userService.list(req.valid.query)));
exports.createHr = asyncHandler(async (req, res) => ok(res, await userService.createHr(req.user, req.valid.body, req.ip), 201));
exports.setActive = asyncHandler(async (req, res) => ok(res, await userService.setActive(req.user, req.params.id, req.valid.body.active, req.ip)));
exports.resetPassword = asyncHandler(async (req, res) => ok(res, await userService.resetPassword(req.user, req.params.id, req.ip)));
