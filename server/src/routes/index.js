'use strict';
const express = require('express');
const validate = require('../middleware/validate');
const { authenticate, authenticateAllowingPasswordChange, requirePermission: need, requireEmployeeRecord } = require('../middleware/auth');
const { loginLimiter, resetLimiter, aiLimiter } = require('../middleware/rateLimit');
const { imageUpload, csvUpload } = require('../middleware/upload');
const { s, idParam } = require('../validators/schemas');
const c = {
  auth: require('../controllers/authController'),
  org: require('../controllers/orgController'),
  user: require('../controllers/userController'),
  emp: require('../controllers/employeeController'),
  att: require('../controllers/attendanceController'),
  leave: require('../controllers/leaveController'),
  pay: require('../controllers/payrollController'),
  dash: require('../controllers/dashboardController'),
  comms: require('../controllers/commsController'),
  ai: require('../controllers/aiController'),
};

const router = express.Router();
const id = validate({ params: idParam });

// ---------- public ----------
router.get('/health', (req, res) => res.json({ data: { status: 'ok' } }));
router.get('/setup/status', c.auth.setupStatus);
router.post('/setup', resetLimiter, validate({ body: s.setup }), c.auth.setup);
router.post('/auth/login', loginLimiter, validate({ body: s.login }), c.auth.login);
router.post('/auth/forgot-password', resetLimiter, validate({ body: s.forgot }), c.auth.forgot);
router.post('/auth/reset-password', resetLimiter, validate({ body: s.reset }), c.auth.reset);

// ---------- account (allowed while a temporary password is pending) ----------
router.get('/auth/me', authenticateAllowingPasswordChange, c.auth.me);
router.post('/auth/change-password', authenticateAllowingPasswordChange, validate({ body: s.changePassword }), c.auth.changePassword);
router.post('/auth/logout', authenticateAllowingPasswordChange, c.auth.logout);

// ---------- everything below needs a fully authenticated user ----------
router.use(authenticate);

// settings & organisation
router.get('/settings', need('settings:read'), c.org.getSettings);
router.put('/settings', need('settings:write'), validate({ body: s.settings }), c.org.updateSettings);
const orgRoutes = [
  ['departments', c.org.departments, s.department],
  ['designations', c.org.designations, s.designation],
  ['leave-types', c.org.leaveTypes, s.leaveType],
  ['holidays', c.org.holidays, s.holiday],
];
for (const [path, ctl, schema] of orgRoutes) {
  router.get(`/${path}`, need('org:read'), ctl.list);
  router.post(`/${path}`, need('org:write'), validate({ body: schema }), ctl.create);
  router.put(`/${path}/:id`, need('org:write'), id, validate({ body: schema }), ctl.update);
  router.delete(`/${path}/:id`, need('org:write'), id, ctl.remove);
}

// users (Admin)
router.get('/users', need('user:manage'), validate({ query: s.userList }), c.user.list);
router.post('/users/hr', need('user:manage'), validate({ body: s.hrCreate }), c.user.createHr);
router.patch('/users/:id/active', need('user:manage'), id, validate({ body: s.userActive }), c.user.setActive);
router.post('/users/:id/reset-password', need('user:manage'), id, c.user.resetPassword);

// employees (static paths first)
router.get('/employees', need('employee:read'), validate({ query: s.employeeList }), c.emp.list);
router.post('/employees', need('employee:write'), validate({ body: s.employeeCreate }), c.emp.create);
router.get('/employees/export', need('employee:export'), c.emp.exportCsv);
router.post('/employees/import', need('employee:import'), csvUpload, validate({ query: s.importQuery }), c.emp.importCsv);
router.patch('/employees/me', requireEmployeeRecord, validate({ body: s.selfUpdate }), c.emp.updateSelf);
router.post('/employees/me/photo', requireEmployeeRecord, imageUpload, c.emp.uploadOwnPhoto);
router.get('/employees/:id', need('employee:read'), id, c.emp.get);
router.patch('/employees/:id', need('employee:write'), id, validate({ body: s.employeeUpdate }), c.emp.update);
router.put('/employees/:id/salary', need('salary:write'), id, validate({ body: s.salaryUpdate }), c.emp.updateSalary);
router.post('/employees/:id/exit', need('employee:write'), id, validate({ body: s.exitEmployee }), c.emp.exit);
router.post('/employees/:id/photo', need('employee:write'), id, imageUpload, c.emp.uploadPhoto);

// attendance
router.post('/attendance/check-in', need('attendance:self'), requireEmployeeRecord, c.att.checkIn);
router.post('/attendance/check-out', need('attendance:self'), requireEmployeeRecord, c.att.checkOut);
router.get('/attendance/today', need('attendance:self'), c.att.today);
router.get('/attendance/me', need('attendance:self'), validate({ query: s.monthQuery }), c.att.myMonth);
router.get('/attendance/board', need('attendance:board'), validate({ query: s.boardQuery }), c.att.board);
router.get('/attendance/corrections', need('correction:read'), validate({ query: s.correctionList }), c.att.listCorrections);
router.post('/attendance/corrections', need('correction:request'), requireEmployeeRecord, validate({ body: s.correctionCreate }), c.att.createCorrection);
router.post('/attendance/corrections/:id/decision', need('correction:decide'), id, validate({ body: s.decision }), c.att.decideCorrection);
router.get('/attendance/employee/:id', need('attendance:read'), id, validate({ query: s.monthQuery }), c.att.employeeMonth);

// leave
router.get('/leaves/balance', need('leave:read'), validate({ query: s.balanceQuery }), c.leave.balance);
router.post('/leaves/preview', need('leave:self'), validate({ body: s.leavePreview }), c.leave.preview);
router.get('/leaves', need('leave:read'), validate({ query: s.leaveList }), c.leave.list);
router.post('/leaves', need('leave:self'), validate({ body: s.leaveApply }), c.leave.apply);
router.post('/leaves/:id/cancel', need('leave:self'), id, c.leave.cancel);
router.post('/leaves/:id/decision', need('leave:decide'), id, validate({ body: s.decision }), c.leave.decide);

// payroll
router.get('/payroll/runs', need('payroll:read'), c.pay.listRuns);
router.post('/payroll/runs', need('payroll:run'), validate({ body: s.payrollRun }), c.pay.createRun);
router.get('/payroll/runs/:id', need('payroll:read'), id, c.pay.getRun);
router.post('/payroll/runs/:id/finalize', need('payroll:finalize'), id, c.pay.finalize);
router.get('/payroll/payslips', validate({ query: s.payslipList }), c.pay.listPayslips);
router.get('/payroll/payslips/:id', id, c.pay.getPayslip);
router.get('/payroll/payslips/:id/pdf', id, c.pay.pdf);

// dashboards
router.get('/dashboard/admin', need('dashboard:admin'), validate({ query: s.dashboardQuery }), c.dash.admin);
router.get('/dashboard/hr', need('dashboard:hr'), validate({ query: s.dashboardQuery }), c.dash.hr);
router.get('/dashboard/me', need('dashboard:self'), c.dash.me);

// announcements, notifications, audit
router.get('/announcements', c.comms.listAnnouncements);
router.post('/announcements', need('announcement:post'), validate({ body: s.announcement }), c.comms.postAnnouncement);
router.delete('/announcements/:id', need('announcement:post'), id, c.comms.deleteAnnouncement);
router.get('/notifications', validate({ query: s.notificationList }), c.comms.listNotifications);
router.post('/notifications/read-all', c.comms.markAllRead);
router.post('/notifications/:id/read', id, c.comms.markRead);
router.get('/audit', need('audit:read'), validate({ query: s.auditList }), c.comms.listAudit);

// AI (key stays on the server; per-user hourly limit)
router.post('/ai/chat', need('ai:chat'), aiLimiter, validate({ body: s.aiChat }), c.ai.chat);
router.post('/ai/summary', need('ai:summary'), aiLimiter, validate({ body: s.aiSummary }), c.ai.summary);
router.post('/ai/smart-leave', need('ai:smart-leave'), requireEmployeeRecord, aiLimiter, validate({ body: s.aiSmartLeave }), c.ai.smartLeave);

module.exports = router;
