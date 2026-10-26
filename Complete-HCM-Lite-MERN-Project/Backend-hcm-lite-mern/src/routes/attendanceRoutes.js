import express from 'express';
import {
  checkIn,
  checkOut,
  getMyAttendance,
} from '../controllers/attendanceController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/check-in', protect, checkIn);
router.put('/check-out', protect, checkOut);
router.get('/my-logs', protect, getMyAttendance);

export default router;