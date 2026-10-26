import 'dotenv/config';
import app from './app.js';
import connectDB from './src/config/db.js';

const PORT = Number(process.env.PORT) || 5000;

connectDB().catch((error) => {
  console.error('Database connection failed:', error.message);
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`HCM Lite API running on port ${PORT}`);
  });
}

export default app;
