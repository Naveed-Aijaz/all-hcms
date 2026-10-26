import React, { useState, useEffect, useRef } from 'react';
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
  Stack,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  IconButton,
} from '@mui/material';
import { CameraAlt, CheckCircle, Logout, Refresh, Close } from '@mui/icons-material';
import { checkInApi, checkOutApi, getMyAttendanceApi } from '../api/attendanceApi';

export default function Attendance() {
  const [logs, setLogs] = useState([]);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [loading, setLoading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [stream, setStream] = useState(null);
  const [capturing, setCapturing] = useState(false);
  const [preview, setPreview] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const fetchLogs = async () => {
    try {
      const res = await getMyAttendanceApi();
      setLogs(res.data || []);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [stream]);

  const openCamera = async () => {
    setMessage({ text: '', type: '' });
    setPreview(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      setStream(mediaStream);
      setCameraOpen(true);
      // attach after dialog opens
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(() => {});
        }
      }, 100);
    } catch (err) {
      console.error(err);
      setMessage({
        text: 'Camera access denied or not available. Please allow camera permission.',
        type: 'error',
      });
    }
  };

  const closeCamera = () => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
    setCameraOpen(false);
    setPreview(null);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
    setPreview(dataUrl);
  };

  const submitCheckIn = async () => {
    if (!preview) {
      setMessage({ text: 'Pehle photo capture karein', type: 'error' });
      return;
    }
    setCapturing(true);
    setLoading(true);
    try {
      // Optional: get rough location
      let location = null;
      try {
        const pos = await new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 4000 })
        );
        location = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
      } catch {
        // location optional
      }

      const res = await checkInApi({ photo: preview, location });
      setMessage({ text: res.message || 'Check-in successful!', type: 'success' });
      closeCamera();
      fetchLogs();
    } catch (error) {
      setMessage({
        text: error.response?.data?.message || 'Check-in failed',
        type: 'error',
      });
    } finally {
      setCapturing(false);
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setLoading(true);
    try {
      const res = await checkOutApi();
      setMessage({ text: res.message || 'Check-out successful!', type: 'success' });
      fetchLogs();
    } catch (error) {
      setMessage({
        text: error.response?.data?.message || 'Check-out failed',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];
  const todayLog = logs.find((l) => l.date === today);

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" mb={1}>
        Attendance
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Camera check-in required. Face should be clearly visible.
      </Typography>

      {message.text && (
        <Alert severity={message.type} sx={{ mb: 3 }} onClose={() => setMessage({ text: '', type: '' })}>
          {message.text}
        </Alert>
      )}

      {/* Status Card */}
      <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 3, border: '1px solid #e0e0e0' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Today ({today})
            </Typography>
            {todayLog ? (
              <Stack direction="row" spacing={1} mt={1} flexWrap="wrap">
                <Chip
                  label={todayLog.status}
                  color={todayLog.status === 'Late' ? 'warning' : 'success'}
                  size="small"
                />
                <Chip
                  label={`In: ${todayLog.checkInTime ? new Date(todayLog.checkInTime).toLocaleTimeString() : '-'}`}
                  size="small"
                  variant="outlined"
                />
                {todayLog.checkOutTime && (
                  <Chip
                    label={`Out: ${new Date(todayLog.checkOutTime).toLocaleTimeString()}`}
                    size="small"
                    variant="outlined"
                  />
                )}
                {todayLog.source === 'camera' && <Chip label="📷 Camera" size="small" color="info" />}
              </Stack>
            ) : (
              <Typography variant="h6" mt={0.5}>
                Not checked in yet
              </Typography>
            )}
          </Box>

          <Stack direction="row" spacing={1.5}>
            {!todayLog && (
              <Button
                variant="contained"
                startIcon={<CameraAlt />}
                onClick={openCamera}
                disabled={loading}
                size="large"
                sx={{ borderRadius: 2, px: 3 }}
              >
                Camera Check-In
              </Button>
            )}
            {todayLog && !todayLog.checkOutTime && (
              <Button
                variant="outlined"
                color="secondary"
                startIcon={<Logout />}
                onClick={handleCheckOut}
                disabled={loading}
                size="large"
                sx={{ borderRadius: 2 }}
              >
                Check Out
              </Button>
            )}
            {todayLog?.checkOutTime && (
              <Chip icon={<CheckCircle />} label="Day completed" color="success" />
            )}
          </Stack>
        </Stack>
      </Paper>

      {/* History */}
      <Typography variant="h6" mb={2}>
        Recent Attendance
      </Typography>
      <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 2, border: '1px solid #e0e0e0' }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#f8f9fa' }}>
              <TableCell>Date</TableCell>
              <TableCell>Check In</TableCell>
              <TableCell>Check Out</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Source</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                  No attendance records yet
                </TableCell>
              </TableRow>
            ) : (
              logs.map((row) => (
                <TableRow key={row._id} hover>
                  <TableCell>{row.date}</TableCell>
                  <TableCell>
                    {row.checkInTime ? new Date(row.checkInTime).toLocaleTimeString() : '-'}
                  </TableCell>
                  <TableCell>
                    {row.checkOutTime ? new Date(row.checkOutTime).toLocaleTimeString() : '-'}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={row.status}
                      size="small"
                      color={
                        row.status === 'Late'
                          ? 'warning'
                          : row.status === 'Present'
                          ? 'success'
                          : 'default'
                      }
                    />
                  </TableCell>
                  <TableCell>{row.source || 'web'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Camera Dialog */}
      <Dialog open={cameraOpen} onClose={closeCamera} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Camera Check-In
          <IconButton onClick={closeCamera} size="small">
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ position: 'relative', bgcolor: '#000', borderRadius: 2, overflow: 'hidden', minHeight: 320 }}>
            {!preview ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ width: '100%', display: 'block', maxHeight: 400 }}
              />
            ) : (
              <img src={preview} alt="Captured" style={{ width: '100%', display: 'block' }} />
            )}
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </Box>
          <Typography variant="caption" color="text.secondary" display="block" mt={1.5} textAlign="center">
            Look at the camera. Face should be clearly visible inside the frame.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          {!preview ? (
            <>
              <Button onClick={closeCamera}>Cancel</Button>
              <Button variant="contained" startIcon={<CameraAlt />} onClick={capturePhoto}>
                Capture Photo
              </Button>
            </>
          ) : (
            <>
              <Button
                startIcon={<Refresh />}
                onClick={() => {
                  setPreview(null);
                  if (videoRef.current && stream) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.play().catch(() => {});
                  }
                }}
              >
                Retake
              </Button>
              <Button
                variant="contained"
                color="success"
                startIcon={capturing ? <CircularProgress size={18} color="inherit" /> : <CheckCircle />}
                onClick={submitCheckIn}
                disabled={capturing}
              >
                Confirm Check-In
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
