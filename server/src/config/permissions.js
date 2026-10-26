'use strict';
/**
 * Central RBAC matrix. Data-scope rules (which rows a role may see) live in
 * utils/scope.js; this file only answers "may this role use this feature?".
 */
const ALL = ['admin', 'hr', 'manager', 'employee'];
const STAFF = ['hr', 'manager', 'employee']; // roles that own an employee record

const PERMISSIONS = {
  'settings:read': ALL,
  'settings:write': ['admin'],
  'org:read': ALL,
  'org:write': ['admin'],
  'user:manage': ['admin'],
  'employee:read': ALL, // scoped
  'employee:write': ['hr'],
  'employee:import': ['hr'],
  'employee:export': ['hr'],
  'salary:read': ['admin', 'hr'],
  'salary:write': ['hr'],
  'attendance:self': STAFF,
  'attendance:read': ALL, // scoped
  'attendance:board': ['admin', 'hr', 'manager'], // scoped
  'correction:request': STAFF,
  'correction:read': ALL, // scoped
  // Route-level access only. Service rules: manager -> direct reports; HR -> anyone but themselves;
  // admin -> only requests raised by HR staff (otherwise an HR user's own request would have no approver).
  'correction:decide': ['admin', 'hr', 'manager'],
  'leave:self': STAFF,
  'leave:read': ALL, // scoped
  'leave:decide': ['admin', 'hr', 'manager'],
  'payroll:read': ['admin', 'hr'],
  'payroll:run': ['hr'],
  'payroll:finalize': ['admin'],
  'payslip:own': STAFF,
  'payslip:any': ['admin', 'hr'],
  'dashboard:admin': ['admin'],
  'dashboard:hr': ['hr'],
  'dashboard:self': STAFF,
  'announcement:post': ['admin', 'hr'],
  'audit:read': ['admin'],
  'ai:chat': ALL,
  'ai:summary': ['admin', 'hr'],
  'ai:smart-leave': STAFF,
};

const can = (role, permission) => Boolean(PERMISSIONS[permission] && PERMISSIONS[permission].includes(role));

module.exports = { PERMISSIONS, can, ALL, STAFF };
