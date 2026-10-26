import dns from "dns";
dns.setServers(["1.1.1.1", "8.8.8.8"]);
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

// Import Routes (Sirf ek baar)
import authRoutes from './src/routes/authRoutes.js';
import attendanceRoutes from './src/routes/attendanceRoutes.js';
import leaveRoutes from './src/routes/leaveRoutes.js';
import payrollRoutes from './src/routes/payrollRoutes.js';
import userRoutes from './src/routes/userRoutes.js';

const app = express();

const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.disable('x-powered-by');
app.use(helmet());

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true,
  })
);

// Body parsers aur cookie parser hamesha routes se pehle hone chahiye
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// Health Check Route
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'HCM Lite API is running',
    timestamp: new Date().toISOString(),
  });
});

// Mount Feature Routes (Sirf ek dafa yahan mount honge)
app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/users', userRoutes);

// 404 Handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found',
  });
});

// Centralized Error Handler
app.use((err, _req, res, _next) => {
  if (res.headersSent) return;

  const statusCode = err.statusCode || err.status || 500;

  res.status(statusCode).json({
    success: false,
    message:
      statusCode >= 500
        ? 'Internal server error'
        : err.message || 'Request failed',
  });
});

export default app;