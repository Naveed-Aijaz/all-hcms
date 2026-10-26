'use strict';
const asyncHandler = require('../utils/asyncHandler');
const { ok, paged } = require('./respond');
const svc = require('../services/payrollService');

exports.listRuns = asyncHandler(async (req, res) => ok(res, await svc.listRuns()));
exports.createRun = asyncHandler(async (req, res) => ok(res, await svc.generateDraft(req.user, req.valid.body.month, req.ip), 201));
exports.getRun = asyncHandler(async (req, res) => {
  const r = await svc.getRun(req.params.id, req.query);
  res.json({ data: { run: r.run, payslips: r.data }, pagination: r.pagination });
});
exports.finalize = asyncHandler(async (req, res) => ok(res, await svc.finalize(req.user, req.params.id, req.ip)));
exports.listPayslips = asyncHandler(async (req, res) => paged(res, await svc.listPayslips(req.user, req.valid.query)));
exports.getPayslip = asyncHandler(async (req, res) => ok(res, svc.shapeSlip(await svc.getPayslip(req.user, req.params.id))));
exports.pdf = asyncHandler(async (req, res) => svc.streamPdf(req.user, req.params.id, res));
