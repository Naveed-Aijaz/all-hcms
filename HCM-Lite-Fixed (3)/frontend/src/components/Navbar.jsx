import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Chip,
  Avatar,
  Stack,
} from '@mui/material';
import { Logout } from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { logoutUser } from '../store/authSlice';
import { useNavigate } from 'react-router-dom';

const roleColors = {
  Admin: '#7c3aed',
  HR: '#2563eb',
  Employee: '#059669',
};

export default function Navbar() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);

  const handleLogout = async () => {
    await dispatch(logoutUser());
    navigate('/login');
  };

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'U';

  return (
    <AppBar
      position="static"
      elevation={0}
      sx={{
        bgcolor: '#fff',
        color: '#0f172a',
        borderBottom: '1px solid #e2e8f0',
      }}
    >
      <Toolbar sx={{ justifyContent: 'space-between', minHeight: 64 }}>
        <Typography variant="subtitle1" fontWeight={600} color="text.secondary">
          {user?.company || 'HCM Lite'}
        </Typography>

        <Stack direction="row" spacing={1.5} alignItems="center">
          <Chip
            label={user?.role || 'Employee'}
            size="small"
            sx={{
              bgcolor: (roleColors[user?.role] || '#64748b') + '18',
              color: roleColors[user?.role] || '#64748b',
              fontWeight: 700,
              fontSize: 12,
            }}
          />
          <Box sx={{ display: { xs: 'none', sm: 'block' }, textAlign: 'right' }}>
            <Typography variant="body2" fontWeight={600} lineHeight={1.2}>
              {user?.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {user?.email}
            </Typography>
          </Box>
          <Avatar
            sx={{
              width: 36,
              height: 36,
              bgcolor: roleColors[user?.role] || '#1e40af',
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            {initials}
          </Avatar>
          <Button
            color="inherit"
            startIcon={<Logout />}
            onClick={handleLogout}
            sx={{ color: '#64748b', '&:hover': { color: '#dc2626', bgcolor: '#fef2f2' } }}
          >
            Logout
          </Button>
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
