'use strict';
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { ok, paged } = require('./respond');
const { Settings, Department, Designation, LeaveType, Holiday, Employee, LeaveRequest } = require('../models');
const { pageParams, pageMeta } = require('../utils/pagination');
const audit = require('../services/auditService');
const { getSettings } = require('../services/settingsService');

exports.getSettings = asyncHandler(async (req, res) => ok(res, await getSettings()));

exports.updateSettings = asyncHandler(async (req, res) => {
  const before = await getSettings();
  const body = req.valid.body;
  const $set = {};
  for (const [k, v] of Object.entries(body)) {
    if ((k === 'office' || k === 'payroll') && v) for (const [k2, v2] of Object.entries(v)) { if (v2 !== undefined) $set[`${k}.${k2}`] = v2; }
    else if (v !== undefined) $set[k] = v;
  }
  if ($set.weekend) $set.weekend = [...new Set($set.weekend)];
  const after = await Settings.findOneAndUpdate({ key: 'main' }, { $set }, { new: true, runValidators: true }).lean();
  await audit.record(req.user, 'settings.update', 'settings', 'main', { before, after, summary: 'Company settings changed (applies to new records only)', ip: req.ip });
  ok(res, after);
});

/** Generic CRUD for small reference collections, with audit and in-use protection on delete. */
function crud(Model, { entity, fields, sort, inUse, label }) {
  const pick = (body) => Object.fromEntries(fields.filter((f) => body[f] !== undefined).map((f) => [f, body[f]]));
  return {
    list: asyncHandler(async (req, res) => {
      const { page, limit, skip } = pageParams(req.query, { maxLimit: 200, defaultLimit: 100 });
      const [rows, total] = await Promise.all([Model.find().sort(sort).skip(skip).limit(limit).lean(), Model.countDocuments()]);
      paged(res, { data: rows.map((r) => ({ ...r, id: String(r._id) })), pagination: pageMeta(page, limit, total) });
    }),
    create: asyncHandler(async (req, res) => {
      const doc = await Model.create(pick(req.valid.body));
      await audit.record(req.user, `${entity}.create`, entity, doc._id, { after: doc.toObject(), summary: `Created ${entity} ${label(doc)}`, ip: req.ip });
      ok(res, { ...doc.toObject(), id: String(doc._id) }, 201);
    }),
    update: asyncHandler(async (req, res) => {
      const doc = await Model.findById(req.params.id);
      if (!doc) throw AppError.notFound(`${entity} not found`);
      const before = doc.toObject();
      Object.assign(doc, pick(req.valid.body));
      await doc.save();
      await audit.record(req.user, `${entity}.update`, entity, doc._id, { before, after: doc.toObject(), summary: `Updated ${entity} ${label(doc)}`, ip: req.ip });
      ok(res, { ...doc.toObject(), id: String(doc._id) });
    }),
    remove: asyncHandler(async (req, res) => {
      const doc = await Model.findById(req.params.id);
      if (!doc) throw AppError.notFound(`${entity} not found`);
      if (inUse && (await inUse(doc))) throw AppError.conflict(`This ${entity} is in use and cannot be deleted`, 'IN_USE');
      await doc.deleteOne();
      await audit.record(req.user, `${entity}.delete`, entity, doc._id, { before: doc.toObject(), summary: `Deleted ${entity} ${label(doc)}`, ip: req.ip });
      ok(res, { id: String(doc._id), deleted: true });
    }),
  };
}

exports.departments = crud(Department, { entity: 'department', fields: ['name', 'description'], sort: { name: 1 }, label: (d) => d.name, inUse: async (d) => (await Employee.exists({ departmentId: d._id })) || (await Designation.exists({ departmentId: d._id })) });
exports.designations = crud(Designation, { entity: 'designation', fields: ['title', 'departmentId'], sort: { title: 1 }, label: (d) => d.title, inUse: (d) => Employee.exists({ designationId: d._id }) });
exports.leaveTypes = crud(LeaveType, { entity: 'leave_type', fields: ['name', 'code', 'annualQuota', 'unlimited', 'paid'], sort: { name: 1 }, label: (d) => d.code, inUse: (d) => LeaveRequest.exists({ leaveTypeId: d._id }) });
exports.holidays = crud(Holiday, { entity: 'holiday', fields: ['date', 'name'], sort: { date: 1 }, label: (d) => `${d.name} (${d.date})` });
