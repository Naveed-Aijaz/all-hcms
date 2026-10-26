'use strict';
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('./respond');
const ai = require('../services/aiService');

exports.chat = asyncHandler(async (req, res) => ok(res, await ai.chat(req.user, req.valid.body.message)));
exports.summary = asyncHandler(async (req, res) => ok(res, await ai.summary(req.user, req.valid.body)));
exports.smartLeave = asyncHandler(async (req, res) => ok(res, await ai.smartLeave(req.user, req.valid.body.text)));
