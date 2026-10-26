'use strict';
const { Notification, User } = require('../models');
const logger = require('../utils/logger');

async function notifyUser(userId, { type, title, message = '', link = '' }) {
  if (!userId) return;
  try {
    await Notification.create({ userId, type, title, message, link });
  } catch (e) {
    logger.error('Notification failed', { message: e.message });
  }
}

async function notifyUsers(userIds, payload) {
  const unique = [...new Set(userIds.filter(Boolean).map(String))];
  await Promise.all(unique.map((id) => notifyUser(id, payload)));
}

async function notifyEmployee(employee, payload) {
  if (employee && employee.userId) await notifyUser(employee.userId, payload);
}

async function hrUserIds() {
  const users = await User.find({ role: 'hr', active: true }).select('_id').lean();
  return users.map((u) => u._id);
}

module.exports = { notifyUser, notifyUsers, notifyEmployee, hrUserIds };
