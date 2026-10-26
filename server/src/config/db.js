'use strict';
const mongoose = require('mongoose');
const { env } = require('./env');
const logger = require('../utils/logger');

async function connectDb(uri = env.mongoUri) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  logger.info('MongoDB connected');
  // Make sure declared indexes exist (unique constraints are relied upon for correctness).
  await mongoose.syncIndexes();
}

module.exports = { connectDb };
