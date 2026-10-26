'use strict';
const { Settings } = require('../models');
const AppError = require('../utils/AppError');
const { dateInTz } = require('../utils/dates');

async function getSettings() {
  const s = await Settings.findOne({ key: 'main' }).lean();
  if (!s) throw new AppError(409, 'The system has not been set up yet', 'SETUP_REQUIRED');
  return s;
}

/** Attendance rules snapshot (applied to new records only). */
const rulesFrom = (s) => ({ startTime: s.officeStart, graceMinutes: s.graceMinutes, halfDayHours: s.halfDayHours, timezone: s.timezone });

async function getContext(now = new Date()) {
  const settings = await getSettings();
  return { settings, rules: rulesFrom(settings), today: dateInTz(now, settings.timezone), now };
}

module.exports = { getSettings, rulesFrom, getContext };
