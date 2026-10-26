'use strict';
const { secondsOfDayInTz, hhmmToMinutes } = require('./dates');

/**
 * Rules are snapshotted onto every attendance record at check-in so that
 * later changes to company settings only apply to new records.
 * rules = { startTime:'09:00', graceMinutes:15, halfDayHours:5, timezone }
 */
function isLateCheckIn(checkIn, rules) {
  const limit = (hhmmToMinutes(rules.startTime) + Number(rules.graceMinutes)) * 60;
  return secondsOfDayInTz(checkIn, rules.timezone) > limit; // 09:15:00 is on time, 09:15:01 is late
}

function workedMinutes(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return ms > 0 ? Math.floor(ms / 60000) : 0;
}

/**
 * Effective status of a record.
 *  - checked out and worked < half-day threshold -> half_day
 *  - checked out otherwise                       -> late | present
 *  - no check-out and the day is over            -> missing_checkout
 *  - no check-out and the day is still running   -> late | present
 */
function computeStatus(rec, rules, today) {
  if (rec.checkOut) {
    const mins = workedMinutes(rec.checkIn, rec.checkOut);
    if (mins < Number(rules.halfDayHours) * 60) return 'half_day';
    return rec.late ? 'late' : 'present';
  }
  if (rec.date < today) return 'missing_checkout';
  return rec.late ? 'late' : 'present';
}

module.exports = { isLateCheckIn, workedMinutes, computeStatus };
