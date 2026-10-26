import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchMe } from './store/authSlice';
import { Box, CircularProgress, Typography, Paper } from '@mui/material';

import Login from './pages/Login';
import Signup from './pages/Signup';
import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Attendance from './pages/Attendance';
import Leave from './pages/Leave';

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useSelector((state) => state.auth);

  if (loading) {
    return (
      <Box sx={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function Placeholder({ title, subtitle }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 4,
        borderRadius: 3,
        border: '1px solid #e2e8f0',
        textAlign: 'center',
        maxWidth: 520,
        mx: 'auto',
        mt: 6,
      }}
    >
      <Typography variant="h5" fontWeight={700} mb={1}>
        {title}
      </Typography>
      <Typography color="text.secondary">
        {subtitle || 'This module is under development for the full HCM Lite requirements.'}
      </Typography>
    </Paper>
  );
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
          <Route path="employees" element={<Placeholder title="Employees Directory" subtitle="HR / Admin can register employees, set salary and import CSV." />} />
          <Route path="payroll" element={<Placeholder title="Payroll Lite" subtitle="Monthly payroll run, tax slabs and payslip PDF." />} />
          <Route path="payslips" element={<Placeholder title="My Payslips" subtitle="Download your payslips after Admin finalizes payroll." />} />
          <Route path="settings" element={<Placeholder title="Organization Setup" subtitle="Departments, designations, leave types, holidays and office rules." />} />
          <Route path="ai" element={<Placeholder title="AI Assistant" subtitle="Ask questions on live data with role-scoped answers." />} />
          <Route path="announcements" element={<Placeholder title="Announcements" />} />
          <Route path="audit" element={<Placeholder title="Audit Log" subtitle="Track create, update, approve and finalize actions." />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
