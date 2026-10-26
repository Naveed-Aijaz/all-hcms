import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { loginUser, clearError } from '../store/authSlice';
import { useNavigate, Link } from 'react-router-dom';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
  Stack,
  Divider,
  Chip,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  EmailOutlined,
  LockOutlined,
  BusinessCenter,
} from '@mui/icons-material';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAuthenticated, loading, error } = useSelector((state) => state.auth);

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard');
    return () => dispatch(clearError());
  }, [isAuthenticated, navigate, dispatch]);

  const handleSubmit = (e) => {
    e.preventDefault();
    dispatch(loginUser({ email, password }));
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #0f766e 100%)',
      }}
    >
      {/* Left brand panel */}
      <Box
        sx={{
          flex: 1,
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'center',
          px: 8,
          color: '#fff',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5} mb={3}>
          <BusinessCenter sx={{ fontSize: 40 }} />
          <Typography variant="h4" fontWeight={800}>
            HCM Lite
          </Typography>
        </Stack>
        <Typography variant="h5" fontWeight={600} mb={1.5} sx={{ opacity: 0.95 }}>
          AI-assisted Human Capital Management
        </Typography>
        <Typography variant="body1" sx={{ opacity: 0.75, maxWidth: 420, lineHeight: 1.7 }}>
          Manage attendance, leave, payroll and insights in one place.
          Built for Admin, HR and Employees.
        </Typography>
        <Stack direction="row" spacing={1} mt={4}>
          <Chip label="Admin" sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: '#fff' }} />
          <Chip label="HR" sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: '#fff' }} />
          <Chip label="Employee" sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: '#fff' }} />
        </Stack>
      </Box>

      {/* Right form */}
      <Box
        sx={{
          width: { xs: '100%', md: 460 },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3,
          bgcolor: { xs: 'transparent', md: 'transparent' },
        }}
      >
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, sm: 4 },
            width: '100%',
            maxWidth: 400,
            borderRadius: 4,
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
          }}
        >
          <Typography variant="h5" fontWeight={700} mb={0.5}>
            Welcome back
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Sign in to your HCM Lite account
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              label="Email"
              type="email"
              fullWidth
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailOutlined color="action" fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              label="Password"
              type={showPassword ? 'text' : 'password'}
              fullWidth
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              sx={{ mb: 1 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockOutlined color="action" fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">
                      {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              sx={{ mt: 3, mb: 2, py: 1.4 }}
            >
              {loading ? <CircularProgress size={22} color="inherit" /> : 'Sign In'}
            </Button>
          </Box>

          <Divider sx={{ my: 2 }}>
            <Typography variant="caption" color="text.secondary">
              OR
            </Typography>
          </Divider>

          <Typography variant="body2" textAlign="center" color="text.secondary">
            New organization?{' '}
            <Link to="/signup" style={{ color: '#1e40af', fontWeight: 600, textDecoration: 'none' }}>
              Create Admin account
            </Link>
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
}
