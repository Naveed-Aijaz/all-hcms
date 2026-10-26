'use strict';
const AppError = require('../utils/AppError');

/**
 * Who may decide a request raised by `requester` (an Employee document/lean object)?
 *  - nobody decides their own request
 *  - HR: any other employee
 *  - manager: only their direct reports
 *  - admin: only requests raised by HR staff (they would otherwise have no approver)
 */
function assertCanDecide(user, requester) {
  if (!requester) throw AppError.notFound('Employee not found');
  if (user.employeeId && String(requester._id) === String(user.employeeId)) {
    throw AppError.forbidden('You cannot decide your own request', 'SELF_APPROVAL');
  }
  if (user.role === 'hr') return;
  if (user.role === 'manager') {
    if (requester.managerId && String(requester.managerId._id || requester.managerId) === String(user.employeeId)) return;
    throw AppError.forbidden('Only the direct manager or HR can decide this request', 'OUT_OF_SCOPE');
  }
  if (user.role === 'admin') {
    if (requester.role === 'hr') return;
    throw AppError.forbidden('Administrators can only decide requests raised by HR staff', 'OUT_OF_SCOPE');
  }
  throw AppError.forbidden();
}

module.exports = { assertCanDecide };
