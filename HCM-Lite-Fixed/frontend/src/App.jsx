import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchMe } from './store/authSlice';

import Login from './pages/Login';
import Signup from './pages/Signup';
import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Attendance from './pages/Attendance';
import Leave from './pages/Leave';
import { Box, CircularProgress } from '@mui/material';

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useSelector((state) => state.auth);

  if (loading) {
    return (
      <Box sx={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" />;
}

function Placeholder({ title }) {
  return (
    <Box>
      <TypographyH4>{title}</TypographyH4>
      <p style={{ color: '#64748b' }}>This module is under active development for the full HCM Lite requirements.</p>
    </Box>
  );
}

function TypographyH4({ children }) {
  return <h2 style={{ margin: 0, fontWeight: 700 }}>{children}</h2>;
}

export default function App() {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(fetchMe());
  }, [dispatch]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="leaves" element={<Leave />} />
          <Route path="employees" element={<Placeholder title="Employees Directory" />} />
          <Route path="payroll" element={<Placeholder title="Payroll Lite" />} />
          <Route path="payslips" element={<Placeholder title="My Payslips" />} />
          <Route path="settings" element={<Placeholder title="Organization Setup" />} />
          <Route path="ai" element={<Placeholder title="AI Assistant" />} />
          <Route path="announcements" element={<Placeholder title="Announcements" />} />
          <Route path="audit" element={<Placeholder title="Audit Log" />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}
