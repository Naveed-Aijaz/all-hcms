'use strict';
const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { env } = require('./config/env');
const sanitize = require('./middleware/sanitize');
const { globalLimiter } = require('./middleware/rateLimit');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');
const routes = require('./routes');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1); // set when behind a reverse proxy so rate limits see the real IP

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin || env.clientOrigins.includes(origin)) return cb(null, true);
        return cb(null, false); // not allowed: no CORS headers are sent, the browser blocks it
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(sanitize);

  // Minimal request log: method, path (no query string, no body), status, duration.
  app.use((req, res, next) => {
    const t = Date.now();
    res.on('finish', () => logger.info('request', { method: req.method, path: req.path, status: res.statusCode, ms: Date.now() - t }));
    next();
  });

  // Profile photos: random server-generated names only, never executable/sniffed.
  app.use('/uploads/profiles', express.static(path.join(env.uploadDir, 'profiles'), {
    index: false,
    dotfiles: 'deny',
    maxAge: '1h',
    setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
  }));

  app.use('/api', globalLimiter, routes);

  // Optional single-process deployment: serve the built client (client/dist) with SPA fallback.
  const dist = path.join(__dirname, '..', '..', 'client', 'dist');
  if (fs.existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    app.get(/^\/(?!api\/|uploads\/).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
  }
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
