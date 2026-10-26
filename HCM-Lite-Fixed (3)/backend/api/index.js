
import 'dotenv/config';
import app from '../app.js';
import connectDB from '../src/config/db.js';

export default async function handler(req, res) {
  try {
    await connectDB();
    return app(req, res);
  } catch (error) {
    console.error('API initialization failed:', error.message);

    if (res.headersSent) return;

    return res.status(503).json({
      success: false,
      message: 'Service temporarily unavailable',
    });
  }
}
