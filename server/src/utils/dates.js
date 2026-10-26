'use strict';
/**
 * Date helpers. All business dates are plain 'YYYY-MM-DD' strings in the
 * company timezone, so calculations never depend on the server's timezone.
 */
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_RE = /^(\d{4})-(\d{2})$/;
const pad = (n) => String(n).padStart(2, '0');

function isValidISODate(s) {
  if (typeof s !== 'string') return false;
  const m = ISO_RE.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

function isValidMonth(s) {
  if (typeof s !== 'string') return false;
  const m = MONTH_RE.exec(s);
  return !!m && Number(m[2]) >= 1 && Number(m[2]) <= 12 && Number(m[1]) >= 2000;
}

function toUTC(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUTC(dt) {
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

function addDays(s, n) {
  const dt = toUTC(s);
  dt.setUTCDate(dt.getUTCDate() + n);
  return fromUTC(dt);
}

/** 0 = Sunday ... 6 = Saturday */
function weekdayOf(s) {
  return toUTC(s).getUTCDay();
}

/** Inclusive list of ISO dates from start to end (capped at ~10 years). */
function eachDay(start, end) {
  const out = [];
  if (start > end) return out;
  let cur = start;
  for (let i = 0; i < 3660 && cur <= end; i += 1) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

function monthRange(ym) {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${y}-${pad(m)}-01`, end: `${y}-${pad(m)}-${pad(last)}`, days: last };
}

function monthOf(s) {
  return s.slice(0, 7);
}

function yearRange(year) {
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

/** Monday-based start of week for an ISO date. */
function startOfWeek(s) {
  const wd = weekdayOf(s);
  return addDays(s, wd === 0 ? -6 : 1 - wd);
}

function partsInTz(date, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const out = {};
  for (const p of fmt.formatToParts(date)) out[p.type] = p.value;
  return out;
}

/** 'YYYY-MM-DD' of an instant in the given timezone. */
function dateInTz(date, timeZone) {
  const p = partsInTz(date, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Seconds since local midnight of an instant in the given timezone. */
function secondsOfDayInTz(date, timeZone) {
  const p = partsInTz(date, timeZone);
  return Number(p.hour) * 3600 + Number(p.minute) * 60 + Number(p.second);
}

function hhmmToMinutes(hhmm) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm || '');
  if (!m) throw new Error(`Invalid HH:mm value: ${hhmm}`);
  return Number(m[1]) * 60 + Number(m[2]);
}

function isValidTimezone(tz) {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz });
    return true;
  } catch (e) {
    return false;
  }
}

/** Convert a local wall-clock date + HH:mm in a timezone to a UTC Date. */
function zonedTimeToUtc(dateStr, hhmm, timeZone) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  const target = Date.UTC(y, mo - 1, d, h, mi, 0);
  let guess = target;
  for (let i = 0; i < 2; i += 1) {
    const p = partsInTz(new Date(guess), timeZone);
    const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
    guess -= asUtc - target;
  }
  return new Date(guess);
}

module.exports = {
  isValidISODate,
  isValidMonth,
  addDays,
  weekdayOf,
  eachDay,
  monthRange,
  monthOf,
  yearRange,
  startOfWeek,
  dateInTz,
  secondsOfDayInTz,
  hhmmToMinutes,
  isValidTimezone,
  zonedTimeToUtc,
};
