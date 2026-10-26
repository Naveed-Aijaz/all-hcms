'use strict';
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { ok, paged } = require('./respond');
const employeeService = require('../services/employeeService');
const importService = require('../services/importService');
const { saveProfilePhoto, csvText } = require('../middleware/upload');

exports.list = asyncHandler(async (req, res) => paged(res, await employeeService.list(req.user, req.valid.query)));
exports.create = asyncHandler(async (req, res) => ok(res, await employeeService.register(req.user, req.valid.body, req.valid.body.role || 'employee', req.ip), 201));
exports.get = asyncHandler(async (req, res) => ok(res, await employeeService.get360(req.user, req.params.id)));
exports.update = asyncHandler(async (req, res) => ok(res, await employeeService.update(req.user, req.params.id, req.valid.body, req.ip)));
exports.updateSalary = asyncHandler(async (req, res) => ok(res, await employeeService.updateSalary(req.user, req.params.id, req.valid.body.basicSalary, req.ip)));
exports.exit = asyncHandler(async (req, res) => ok(res, await employeeService.exit(req.user, req.params.id, req.valid.body.exitDate, req.ip)));
exports.updateSelf = asyncHandler(async (req, res) => ok(res, await employeeService.updateSelf(req.user, req.valid.body, req.ip)));

exports.uploadOwnPhoto = asyncHandler(async (req, res) => {
  if (!req.user.employeeId) throw AppError.forbidden('This account has no employee record');
  const name = await saveProfilePhoto(req.file);
  ok(res, await employeeService.setPhoto(req.user, req.user.employeeId, name, req.ip));
});
exports.uploadPhoto = asyncHandler(async (req, res) => {
  const name = await saveProfilePhoto(req.file);
  ok(res, await employeeService.setPhoto(req.user, req.params.id, name, req.ip));
});

exports.importCsv = asyncHandler(async (req, res) => {
  const text = csvText(req.file);
  const result = req.valid.query.dryRun === 'true' ? await importService.dryRun(text) : await importService.importCsv(req.user, text, req.ip);
  ok(res, result, result.dryRun ? 200 : 201);
});
exports.exportCsv = asyncHandler(async (req, res) => {
  const csv = await importService.exportCsv();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="employees.csv"');
  res.setHeader('Cache-Control', 'no-store');
  res.send(csv);
});
