import React from 'react';
import { Box, List, ListItem, ListItemButton, ListItemText, Typography } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';

const menuItems = [
  { text: 'Dashboard', path: '/dashboard' },
  { text: 'Attendance', path: '/attendance' },
  { text: 'Leave Management', path: '/leaves' },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Box sx={{ width: 240, bgcolor: '#1e1e2f', color: '#fff', height: '100vh', p: 2 }}>
      <Typography variant="h6" fontWeight="bold" mb={3} textAlign="center">
        HCM Lite
      </Typography>
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => navigate(item.path)}
              sx={{ '&.Mui-selected': { bgcolor: '#3f51b5' } }}
            >
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );
}