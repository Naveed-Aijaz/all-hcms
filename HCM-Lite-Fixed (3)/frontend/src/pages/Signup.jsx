
import React, { useState } from 'react';
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
  ToggleButton,
  ToggleButtonGroup,
  Divider,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  PersonOutline,
  EmailOutlined,
  LockOutlined,
  Business,
  AdminPanelSettings,
  Badge,
  WorkOutline,
} from '@mui/icons-material';
import API from '../api/axios';

const roles = [
  { value: 'Admin', label: 'Admin', icon: <AdminPanelSettings fontSize="small" />, desc: 'Full control' },
  { value: 'HR', label: 'HR', icon: <WorkOutline fontSize="small" />, desc: 'People ops' },
  { value: 'Employee', label: 'Employee', icon: <Badge fontSize="small" />, desc: 'Self service' },
];

export default function Signup() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    company: '',
    role: 'Admin',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await API.post('/auth/signup', form);
      setSuccess(res.data.message || 'Account created successfully');
      setTimeout(() => navigate('/login'), 1600);
    } catch (err) {
      setError(err.response?.data?.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #0f766e 100%)',
      }}
    >
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
        <Typography variant="h4" fontWeight={800} mb={2}>
          Get started with HCM Lite
        </Typography>
        <Typography variant="body1" sx={{ opacity: 0.8, maxWidth: 400, lineHeight: 1.7 }}>
          The system starts empty. First account is always <strong>Admin</strong>.
          Later HR can register employees.
        </Typography>
        <Stack spacing={1.5} mt={4}>
          {roles.map((r) => (
            <Stack
              key={r.value}
              direction="row"
              spacing={1.5}
              alignItems="center"
              sx={{ opacity: 0.9 }}
            >
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 2,
                  bgcolor: 'rgba(255,255,255,0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {r.icon}
              </Box>
              <Box>
                <Typography fontWeight={600}>{r.label}</Typography>
                <Typography variant="caption" sx={{ opacity: 0.7 }}>
                  {r.desc}
                </Typography>
              </Box>
            </Stack>
          ))}
        </Stack>
      </Box>

      <Box
        sx={{
          width: { xs: '100%', md: 480 },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3,
        }}
      >
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, sm: 4 },
            width: '100%',
            maxWidth: 420,
            borderRadius: 4,
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
          }}
        >
          <Typography variant="h5" fontWeight={700} mb={0.5}>
            Create account
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            First user becomes Admin automatically
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>{success}</Alert>}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              label="Full Name"
              fullWidth
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonOutline color="action" fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              label="Company Name"
              fullWidth
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              sx={{ mb: 2 }}
              placeholder="Your organization"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Business color="action" fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              label="Email"
              type="email"
              fullWidth
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
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
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              sx={{ mb: 2.5 }}
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

            <Typography variant="caption" color="text.secondary" display="block" mb={1}>
              Preferred role (first account is always Admin)
            </Typography>
            <ToggleButtonGroup
              exclusive
              fullWidth
              value={form.role}
              onChange={(_, v) => v && setForm({ ...form, role: v })}
              sx={{ mb: 3 }}
            >
              {roles.map((r) => (
                <ToggleButton
                  key={r.value}
                  value={r.value}
                  sx={{
                    py: 1.2,
                    textTransform: 'none',
                    '&.Mui-selected': {
                      bgcolor: 'primary.main',
                      color: '#fff',
                      '&:hover': { bgcolor: 'primary.dark' },
                    },
                  }}
                >
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    {r.icon}
                    <span>{r.label}</span>
                  </Stack>
                </ToggleButton>
              ))}
            </ToggleButtonGroup>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              sx={{ py: 1.4, mb: 2 }}
            >
              {loading ? <CircularProgress size={22} color="inherit" /> : 'Create Account'}
            </Button>
          </Box>

          <Divider sx={{ my: 2 }} />
          <Typography variant="body2" textAlign="center" color="text.secondary">
            Already have an account?{' '}
            <Link to="/login" style={{ color: '#1e40af', fontWeight: 600, textDecoration: 'none' }}>
              Sign in
            </Link>
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
}
