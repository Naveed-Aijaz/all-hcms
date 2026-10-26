import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Paper,
  Typography,
  TextField,
  MenuItem,
  Stack,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { Add, EventNote } from '@mui/icons-material';
import { applyLeaveApi, getMyLeavesApi } from '../api/leaveApi';

const leaveTypes = ['Casual', 'Sick', 'Annual'];

export default function Leave() {
  const [leaves, setLeaves] = useState([]);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [form, setForm] = useState({
    leaveType: 'Casual',
    startDate: '',
    endDate: '',
    reason: '',
  });
  const [loading, setLoading] = useState(false);

  const fetchLeaves = async () => {
    try {
      const res = await getMyLeavesApi();
      setLeaves(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, []);

  const handleSubmit = async () => {
    if (!form.startDate || !form.endDate || !form.reason.trim()) {
      setMessage({ text: 'Please fill all fields', type: 'error' });
      return;
    }
    setLoading(true);
    try {
      await applyLeaveApi(form);
      setMessage({ text: 'Leave request submitted successfully', type: 'success' });
      setOpen(false);
      setForm({ leaveType: 'Casual', startDate: '', endDate: '', reason: '' });
      fetchLeaves();
    } catch (error) {
      setMessage({
        text: error.response?.data?.message || 'Failed to apply leave',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const statusColor = {
    Pending: 'warning',
    Approved: 'success',
    Rejected: 'error',
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight="bold">
            Leave Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Apply and track your leave requests
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => setOpen(true)} sx={{ borderRadius: 2 }}>
          Apply Leave
        </Button>
      </Stack>

      {message.text && (
        <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage({ text: '', type: '' })}>
          {message.text}
        </Alert>
      )}

      <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 2, border: '1px solid #e0e0e0' }}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: '#f8f9fa' }}>
              <TableCell>Type</TableCell>
              <TableCell>From</TableCell>
              <TableCell>To</TableCell>
              <TableCell>Reason</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Applied</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {leaves.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 5 }}>
                  <EventNote sx={{ fontSize: 40, color: '#cbd5e1', mb: 1 }} />
                  <Typography color="text.secondary">No leave requests yet</Typography>
                </TableCell>
              </TableRow>
            ) : (
              leaves.map((row) => (
                <TableRow key={row._id} hover>
                  <TableCell>{row.leaveType}</TableCell>
                  <TableCell>{new Date(row.startDate).toLocaleDateString()}</TableCell>
                  <TableCell>{new Date(row.endDate).toLocaleDateString()}</TableCell>
                  <TableCell sx={{ maxWidth: 200 }}>{row.reason}</TableCell>
                  <TableCell>
                    <Chip label={row.status} size="small" color={statusColor[row.status] || 'default'} />
                  </TableCell>
                  <TableCell>{new Date(row.createdAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Apply for Leave</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              select
              label="Leave Type"
              value={form.leaveType}
              onChange={(e) => setForm({ ...form, leaveType: e.target.value })}
              fullWidth
            >
              {leaveTypes.map((t) => (
                <MenuItem key={t} value={t}>
                  {t}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Start Date"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              fullWidth
            />
            <TextField
              label="End Date"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              fullWidth
            />
            <TextField
              label="Reason"
              multiline
              rows={3}
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              fullWidth
              placeholder="e.g. Family wedding, medical appointment..."
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Submitting...' : 'Submit Request'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
