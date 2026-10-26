import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, Stack, Chip } from '@mui/material';
import { AccessTime, EventNote, People, TrendingUp } from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { getMyAttendanceApi } from '../api/attendanceApi';
import { getMyLeavesApi } from '../api/leaveApi';

function StatCard({ title, value, icon, color }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        borderRadius: 3,
        border: '1px solid #e2e8f0',
        height: '100%',
        flex: '1 1 200px',
        minWidth: 180,
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {title}
          </Typography>
          <Typography variant="h4" fontWeight={700}>
            {value}
          </Typography>
        </Box>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 2,
            bgcolor: color + '18',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color,
          }}
        >
          {icon}
        </Box>
      </Stack>
    </Paper>
  );
}

export default function Dashboard() {
  const { user } = useSelector((s) => s.auth);
  const [stats, setStats] = useState({ presentDays: 0, lateDays: 0, pendingLeaves: 0 });

  useEffect(() => {
    (async () => {
      try {
        const [att, leaves] = await Promise.all([getMyAttendanceApi(), getMyLeavesApi()]);
        const logs = att.data || [];
        const leaveList = leaves.data || [];
        setStats({
          presentDays: logs.filter((l) => l.status === 'Present').length,
          lateDays: logs.filter((l) => l.status === 'Late').length,
          pendingLeaves: leaveList.filter((l) => l.status === 'Pending').length,
        });
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" mb={0.5}>
        Dashboard
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Welcome back, {user?.name}. Role:{' '}
        <Chip label={user?.role || 'Employee'} size="small" sx={{ ml: 0.5 }} />
      </Typography>

      <Stack direction="row" flexWrap="wrap" gap={2.5} mb={4}>
        <StatCard title="Present Days" value={stats.presentDays} icon={<AccessTime />} color="#059669" />
        <StatCard title="Late Days" value={stats.lateDays} icon={<TrendingUp />} color="#d97706" />
        <StatCard title="Pending Leaves" value={stats.pendingLeaves} icon={<EventNote />} color="#2563eb" />
        <StatCard title="Role" value={user?.role || '-'} icon={<People />} color="#7c3aed" />
      </Stack>

      <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0' }}>
        <Typography variant="h6" fontWeight={600} mb={1}>
          Quick Actions
        </Typography>
        <Typography variant="body2" color="text.secondary" component="div">
          • Go to <strong>Attendance</strong> and use <strong>Camera Check-In</strong> to mark presence.
          <br />
          • Apply leave from the <strong>Leave</strong> page.
          <br />
          • HR / Admin can manage employees, approve leaves and run payroll (expanding).
        </Typography>
      </Paper>
    </Box>
  );
}
