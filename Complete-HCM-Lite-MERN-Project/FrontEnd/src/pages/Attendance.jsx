import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
} from '@mui/material';
import { checkInApi, checkOutApi, getMyAttendanceApi } from '../api/attendanceApi';

export default function Attendance() {
  const [logs, setLogs] = useState([]);
  const [message, setMessage] = useState({ text: '', type: '' });

  const fetchLogs = async () => {
    try {
      const res = await getMyAttendanceApi();
      setLogs(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleCheckIn = async () => {
    try {
      const res = await checkInApi();
      setMessage({ text: 'Check-in successful!', type: 'success' });
      fetchLogs();
    } catch (error) {
      setMessage({ text: error.response?.data?.message || 'Check-in failed', type: 'error' });
    }
  };

  const handleCheckOut = async () => {
    try {
      const res = await checkOutApi();
      setMessage({ text: 'Check-out successful!', type: 'success' });
      fetchLogs();
    } catch (error) {
      setMessage({ text: error.response?.data?.message || 'Check-out failed', type: 'error' });
    }
  };

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" mb={3}>
        Attendance Management
      </Typography>

      {message.text && (
        <Alert severity={message.type} sx={{ mb: 3 }}>
          {message.text}
        </Alert>
      )}

      <Box sx={{ mb: 4, display: 'flex', gap: 2 }}>
        <Button variant="contained" color="primary" onClick={handleCheckIn}>
          Check In
        </Button>
        <Button variant="contained" color="secondary" onClick={handleCheckOut}>
          Check Out
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead sx={{ bgcolor: '#f0f0f0' }}>
            <TableRow>
              <TableCell><b>Date</b></TableCell>
              <TableCell><b>Check-In Time</b></TableCell>
              <TableCell><b>Check-Out Time</b></TableCell>
              <TableCell><b>Status</b></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.map((row) => (
              <TableRow key={row._id}>
                <TableCell>{row.date}</TableCell>
                <TableCell>{row.checkInTime ? new Date(row.checkInTime).toLocaleTimeString() : '-'}</TableCell>
                <TableCell>{row.checkOutTime ? new Date(row.checkOutTime).toLocaleTimeString() : '-'}</TableCell>
                <TableCell>{row.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}