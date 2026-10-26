import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/Auth.jsx';
import { api } from './api.js';
import Layout from './components/Layout.jsx';
import { Spinner } from './components/ui.jsx';

const Setup = lazy(() => import('./pages/Setup.jsx'));
const Login = lazy(() => import('./pages/Login.jsx'));
const { ForgotPassword, ResetPassword } = {
  ForgotPassword: lazy(() => import('./pages/PasswordReset.jsx').then((m) => ({ default: m.ForgotPassword }))),
  ResetPassword: lazy(() => import('./pages/PasswordReset.jsx').then((m) => ({ default: m.ResetPassword }))),
};
const ChangePassword = lazy(() => import('./pages/ChangePassword.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Employees = lazy(() => import('./pages/Employees.jsx'));
const EmployeeDetail = lazy(() => import('./pages/EmployeeDetail.jsx'));
const Attendance = lazy(() => import('./pages/Attendance.jsx'));
const AttendanceBoard = lazy(() => import('./pages/AttendanceBoard.jsx'));
const Corrections = lazy(() => import('./pages/Corrections.jsx'));
const Leave = lazy(() => import('./pages/Leave.jsx'));
const LeaveApprovals = lazy(() => import('./pages/LeaveApprovals.jsx'));
const Payroll = lazy(() => import('./pages/Payroll.jsx'));
const Payslips = lazy(() => import('./pages/Payslips.jsx'));
const OrgSetup = lazy(() => import('./pages/OrgSetup.jsx'));
const Users = lazy(() => import('./pages/Users.jsx'));
const Announcements = lazy(() => import('./pages/Announcements.jsx'));
const Notifications = lazy(() => import('./pages/Notifications.jsx'));
const AuditLog = lazy(() => import('./pages/AuditLog.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));

/** Role gate. The server enforces the same rules; this only keeps the UI tidy. */
function Guard({ roles, children }) {
  const { user } = useAuth();
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function Protected() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />;
  return <Layout />;
}

export default function App() {
  const { user, loading } = useAuth();
  const [needsSetup, setNeedsSetup] = useState(null);

  useEffect(() => {
    api.get('/setup/status').then((r) => setNeedsSetup(r.data.needsSetup)).catch(() => setNeedsSetup(false));
  }, []);

  if (loading || needsSetup === null) return <Spinner />;
  if (needsSetup) return <Suspense fallback={<Spinner />}><Routes><Route path="*" element={<Setup onDone={() => setNeedsSetup(false)} />} /></Routes></Suspense>;

  const ALL_STAFF = ['hr', 'manager', 'employee'];
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="/login" element={user && !user.mustChangePassword ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/change-password" element={user ? <ChangePassword forced={user.mustChangePassword} /> : <Navigate to="/login" replace />} />
        <Route element={<Protected />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/employees/:id" element={<EmployeeDetail />} />
          <Route path="/attendance" element={<Guard roles={ALL_STAFF}><Attendance /></Guard>} />
          <Route path="/attendance/board" element={<Guard roles={['admin', 'hr', 'manager']}><AttendanceBoard /></Guard>} />
          <Route path="/attendance/corrections" element={<Guard roles={['hr', 'manager']}><Corrections /></Guard>} />
          <Route path="/leave" element={<Guard roles={ALL_STAFF}><Leave /></Guard>} />
          <Route path="/leave/approvals" element={<Guard roles={['admin', 'hr', 'manager']}><LeaveApprovals /></Guard>} />
          <Route path="/payroll" element={<Guard roles={['admin', 'hr']}><Payroll /></Guard>} />
          <Route path="/payslips" element={<Payslips />} />
          <Route path="/org" element={<Guard roles={['admin']}><OrgSetup /></Guard>} />
          <Route path="/users" element={<Guard roles={['admin']}><Users /></Guard>} />
          <Route path="/announcements" element={<Announcements />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/audit" element={<Guard roles={['admin']}><AuditLog /></Guard>} />
          <Route path="/profile" element={<Guard roles={ALL_STAFF}><Profile /></Guard>} />
          <Route path="/account" element={<ChangePassword />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
