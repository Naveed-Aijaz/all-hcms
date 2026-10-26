'use strict';
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { env } = require('../config/env');
const logger = require('../utils/logger');

let transporter;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.mail.host,
      port: env.mail.port,
      secure: env.mail.secure,
      auth: env.mail.user ? { user: env.mail.user, pass: env.mail.pass } : undefined,
    });
  }
  return transporter;
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Sends an email. Failures are logged (without the message body, which may contain
 * a reset link or temporary password) and never break the calling request.
 */
async function sendMail({ to, subject, text, html }) {
  try {
    if (env.mail.mode === 'smtp') {
      await getTransporter().sendMail({ from: env.mail.from, to, subject, text, html });
      logger.info('Email sent', { to, subject });
    } else if (env.mail.mode === 'outbox' && !env.isProd) {
      const dir = path.join(__dirname, '..', '..', '.outbox');
      await fs.mkdir(dir, { recursive: true });
      const file = path.join(dir, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.json`);
      await fs.writeFile(file, JSON.stringify({ to, subject, text, html }, null, 2), { mode: 0o600 });
      logger.info('Email written to dev outbox', { to, subject });
    } else {
      logger.info('Email skipped (MAIL_MODE=off)', { to, subject });
    }
  } catch (e) {
    logger.error('Email delivery failed', { to, subject, message: e.message });
  }
}

const wrap = (title, body) => `<div style="font-family:Arial,sans-serif;max-width:560px"><h2>${esc(title)}</h2>${body}<p style="color:#888;font-size:12px">HCM Lite</p></div>`;

const templates = {
  passwordReset(name, link, minutes) {
    return {
      subject: 'Reset your HCM Lite password',
      text: `Hi ${name},\n\nUse this link to choose a new password (valid for ${minutes} minutes, one use only):\n${link}\n\nIf you did not request this, ignore this email.`,
      html: wrap('Reset your password', `<p>Hi ${esc(name)},</p><p><a href="${esc(link)}">Choose a new password</a> (valid for ${minutes} minutes, one use only).</p><p>If you did not request this, you can ignore this email.</p>`),
    };
  },
  welcome(name, email, tempPassword, loginUrl) {
    return {
      subject: 'Your HCM Lite account',
      text: `Hi ${name},\n\nAn account was created for you.\nEmail: ${email}\nTemporary password: ${tempPassword}\nSign in: ${loginUrl}\n\nYou must change this password at first sign-in.`,
      html: wrap('Your account is ready', `<p>Hi ${esc(name)},</p><p>Email: <b>${esc(email)}</b><br/>Temporary password: <b>${esc(tempPassword)}</b></p><p><a href="${esc(loginUrl)}">Sign in</a> - you must change the password at first sign-in.</p>`),
    };
  },
  passwordResetByAdmin(name, tempPassword, loginUrl) {
    return {
      subject: 'Your HCM Lite password was reset',
      text: `Hi ${name},\n\nAn administrator reset your password.\nTemporary password: ${tempPassword}\nSign in: ${loginUrl}\n\nYou must change it at next sign-in.`,
      html: wrap('Password reset', `<p>Hi ${esc(name)},</p><p>Temporary password: <b>${esc(tempPassword)}</b></p><p><a href="${esc(loginUrl)}">Sign in</a> and choose a new password.</p>`),
    };
  },
  leaveDecision(name, decision, leave, comment) {
    return {
      subject: `Your leave request was ${decision}`,
      text: `Hi ${name},\n\nYour ${leave.type} leave (${leave.startDate} to ${leave.endDate}, ${leave.days} day(s)) was ${decision}.${comment ? `\nComment: ${comment}` : ''}`,
      html: wrap(`Leave ${decision}`, `<p>Hi ${esc(name)},</p><p>Your ${esc(leave.type)} leave (${esc(leave.startDate)} to ${esc(leave.endDate)}, ${leave.days} day(s)) was <b>${esc(decision)}</b>.</p>${comment ? `<p>Comment: ${esc(comment)}</p>` : ''}`),
    };
  },
  leaveRequested(approverName, employeeName, leave) {
    return {
      subject: `Leave request from ${employeeName}`,
      text: `Hi ${approverName},\n\n${employeeName} requested ${leave.type} leave (${leave.startDate} to ${leave.endDate}, ${leave.days} day(s)). Please review it in HCM Lite.`,
      html: wrap('Leave request awaiting approval', `<p>Hi ${esc(approverName)},</p><p>${esc(employeeName)} requested ${esc(leave.type)} leave (${esc(leave.startDate)} to ${esc(leave.endDate)}, ${leave.days} day(s)).</p>`),
    };
  },
  payslipReady(name, month) {
    return {
      subject: `Your payslip for ${month} is available`,
      text: `Hi ${name},\n\nYour payslip for ${month} is now available in HCM Lite.`,
      html: wrap('Payslip available', `<p>Hi ${esc(name)},</p><p>Your payslip for <b>${esc(month)}</b> is now available in HCM Lite.</p>`),
    };
  },
  correctionDecision(name, decision, date, comment) {
    return {
      subject: `Your attendance correction was ${decision}`,
      text: `Hi ${name},\n\nYour attendance correction for ${date} was ${decision}.${comment ? `\nComment: ${comment}` : ''}`,
      html: wrap(`Correction ${decision}`, `<p>Hi ${esc(name)},</p><p>Your attendance correction for ${esc(date)} was <b>${esc(decision)}</b>.</p>${comment ? `<p>Comment: ${esc(comment)}</p>` : ''}`),
    };
  },
};

module.exports = { sendMail, templates };
