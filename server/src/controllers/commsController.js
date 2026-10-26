'use strict';
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { ok, paged } = require('./respond');
const { Announcement, Notification, AuditLog } = require('../models');
const { pageParams, pageMeta } = require('../utils/pagination');
const audit = require('../services/auditService');
const notifications = require('../services/notificationService');
const { User } = require('../models');

const shapeAnn = (a) => ({ id: String(a._id), title: a.title, body: a.body, authorName: a.authorName, createdAt: a.createdAt });

exports.listAnnouncements = asyncHandler(async (req, res) => {
  const { page, limit, skip } = pageParams(req.query, { defaultLimit: 20 });
  const [rows, total] = await Promise.all([Announcement.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), Announcement.countDocuments()]);
  paged(res, { data: rows.map(shapeAnn), pagination: pageMeta(page, limit, total) });
});
exports.postAnnouncement = asyncHandler(async (req, res) => {
  const a = await Announcement.create({ ...req.valid.body, authorId: req.user.id, authorName: req.user.name });
  await audit.record(req.user, 'announcement.create', 'announcement', a._id, { after: { title: a.title }, ip: req.ip });
  const everyone = await User.find({ active: true, _id: { $ne: req.user.id } }).select('_id').lean();
  await notifications.notifyUsers(everyone.map((u) => u._id), { type: 'announcement', title: `Announcement: ${a.title}`, message: a.body.slice(0, 140), link: '/announcements' });
  ok(res, shapeAnn(a), 201);
});
exports.deleteAnnouncement = asyncHandler(async (req, res) => {
  const a = await Announcement.findById(req.params.id);
  if (!a) throw AppError.notFound('Announcement not found');
  if (req.user.role !== 'admin' && String(a.authorId) !== req.user.id) throw AppError.forbidden('Only the author or an administrator can delete this');
  await a.deleteOne();
  await audit.record(req.user, 'announcement.delete', 'announcement', a._id, { before: { title: a.title }, ip: req.ip });
  ok(res, { deleted: true });
});

exports.listNotifications = asyncHandler(async (req, res) => {
  const { page, limit, skip } = pageParams(req.valid.query, { defaultLimit: 20 });
  const filter = { userId: req.user.id };
  if (req.valid.query.unread === 'true') filter.read = false;
  const [rows, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ userId: req.user.id, read: false }),
  ]);
  res.json({ data: rows.map((n) => ({ id: String(n._id), type: n.type, title: n.title, message: n.message, link: n.link, read: n.read, createdAt: n.createdAt })), pagination: pageMeta(page, limit, total), unread });
});
exports.markRead = asyncHandler(async (req, res) => {
  const n = await Notification.findOneAndUpdate({ _id: req.params.id, userId: req.user.id }, { $set: { read: true } }, { new: true });
  if (!n) throw AppError.notFound('Notification not found');
  ok(res, { id: String(n._id), read: true });
});
exports.markAllRead = asyncHandler(async (req, res) => {
  const r = await Notification.updateMany({ userId: req.user.id, read: false }, { $set: { read: true } });
  ok(res, { updated: r.modifiedCount });
});

exports.listAudit = asyncHandler(async (req, res) => {
  const { page, limit, skip } = pageParams(req.valid.query, { defaultLimit: 30 });
  const q = req.valid.query;
  const filter = {};
  if (q.entity) filter.entity = q.entity;
  if (q.action) filter.action = q.action;
  if (q.actorId) filter.actorId = q.actorId;
  const [rows, total] = await Promise.all([AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), AuditLog.countDocuments(filter)]);
  paged(res, {
    data: rows.map((a) => ({ id: String(a._id), actor: a.actorName, role: a.actorRole, action: a.action, entity: a.entity, entityId: a.entityId, summary: a.summary, before: a.before, after: a.after, createdAt: a.createdAt })),
    pagination: pageMeta(page, limit, total),
  });
});
