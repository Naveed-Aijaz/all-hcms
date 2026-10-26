'use strict';
const { env, validateEnv } = require('./config/env');
const logger = require('./utils/logger');

async function main() {
  validateEnv();
  const { connectDb } = require('./config/db');
  const { createApp } = require('./app');
  const { bootstrapFromEnv } = require('./services/authService');
  await connectDb();
  await bootstrapFromEnv();
  const server = createApp().listen(env.port, () => logger.info(`HCM Lite API listening on :${env.port}`, { env: env.nodeEnv }));
  const shutdown = (sig) => {
    logger.info(`${sig} received, shutting down`);
    server.close(() => require('mongoose').disconnect().then(() => process.exit(0)));
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err.isConfigError ? err.message : `Failed to start: ${err.message}`);
  process.exit(1);
});
