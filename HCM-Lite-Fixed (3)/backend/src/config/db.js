
import mongoose from 'mongoose';

let cached = globalThis.__hcmMongoCache;

if (!cached) {
  cached = globalThis.__hcmMongoCache = {
    connection: null,
    promise: null,
  };
}

export default async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not configured');
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
        maxPoolSize: 10,
        bufferCommands: false,
      })
      .then((instance) => instance.connection)
      .catch((error) => {
        cached.promise = null;
        throw error;
      });
  }

  cached.connection = await cached.promise;
  return cached.connection;
}