import React from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  Chip,
} from '@mui/material';
import {
  Dashboard,
  AccessTime,
  EventNote,
  People,
  Payments,
  Settings,
  SmartToy,
  Campaign,
  BusinessCenter,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';

const allMenus = {
  common: [
    { text: 'Dashboard', path: '/dashboard', icon: <Dashboard /> },
    { text: 'Attendance', path: '/attendance', icon: <AccessTime /> },
    { text: 'Leave', path: '/leaves', icon: <EventNote /> },
  ],
  Employee: [
    { text: 'My Payslips', path: '/payslips', icon: <Payments /> },
    { text: 'AI Assistant', path: '/ai', icon: <SmartToy /> },
  ],
  HR: [
    { text: 'Employees', path: '/employees', icon: <People /> },
    { text: 'Payroll', path: '/payroll', icon: <Payments /> },
    { text: 'AI Assistant', path: '/ai', icon: <SmartToy /> },
    { text: 'Announcements', path: '/announcements', icon: <Campaign /> },
  ],
  Admin: [
    { text: 'Employees', path: '/employees', icon: <People /> },
    { text: 'Payroll', path: '/payroll', icon: <Payments /> },
    { text: 'Org Setup', path: '/settings', icon: <Settings /> },
    { text: 'AI Assistant', path: '/ai', icon: <SmartToy /> },
    { text: 'Audit Log', path: '/audit', icon: <Campaign /> },
  ],
};

const roleColors = {
  Admin: '#7c3aed',
  HR: '#2563eb',
  Employee: '#059669',
};

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useSelector((state) => state.auth);
  const role = user?.role || 'Employee';

  const roleMenus = allMenus[role] || allMenus.Employee;
  const menuItems = [...allMenus.common, ...roleMenus];
  const seen = new Set();
  const uniqueMenus = menuItems.filter((m) => {
    if (seen.has(m.path)) return false;
    seen.add(m.path);
    return true;
  });

  return (
    <Box
      sx={{
        width: 260,
        bgcolor: '#0f172a',
        color: '#e2e8f0',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid #1e293b',
      }}
    >
      <Box sx={{ p: 2.5, pb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.5 }}>
          <BusinessCenter sx={{ fontSize: 28, color: '#60a5fa' }} />
          <Box>
            <Typography variant="h6" fontWeight={800} sx={{ letterSpacing: 0.3, lineHeight: 1.2 }}>
              HCM Lite
            </Typography>
            <Typography variant="caption" sx={{ color: '#94a3b8' }}>
              AI-assisted HR
            </Typography>
          </Box>
        </Box>
        {user && (
          <Chip
            label={role}
            size="small"
            sx={{
              bgcolor: roleColors[role] || '#64748b',
              color: '#fff',
              fontWeight: 700,
              fontSize: 11,
              height: 24,
            }}
          />
        )}
      </Box>

      <Divider sx={{ borderColor: '#1e293b', my: 1 }} />

      <List sx={{ flex: 1, px: 1.25, py: 0.5 }}>
        {uniqueMenus.map((item) => {
          const selected = location.pathname === item.path;
          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.4 }}>
              <ListItemButton
                selected={selected}
                onClick={() => navigate(item.path)}
                sx={{
                  borderRadius: 2,
                  py: 1.1,
                  '&.Mui-selected': {
                    bgcolor: '#1e40af',
                    '&:hover': { bgcolor: '#1e3a8a' },
                  },
                  '&:hover': { bgcolor: '#1e293b' },
                }}
              >
                <ListItemIcon sx={{ color: selected ? '#fff' : '#94a3b8', minWidth: 40 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontSize: 14,
                    fontWeight: selected ? 600 : 400,
                    color: selected ? '#fff' : '#cbd5e1',
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Box sx={{ p: 2, borderTop: '1px solid #1e293b' }}>
        <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block' }}>
          {user?.name || 'User'}
        </Typography>
        <Typography variant="caption" sx={{ color: '#64748b' }}>
          {user?.email}
        </Typography>
      </Box>
    </Box>
  );
}
