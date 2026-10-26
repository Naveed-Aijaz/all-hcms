import express from 'express';
import {
  applyLeave,
  getMyLeaves,
  updateLeaveStatus,
} from '../controllers/leaveController.js';
import { protect } from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/roleMiddleware.js';

const router = express.Router();

router.post('/', protect, applyLeave);
router.get('/my-leaves', protect, getMyLeaves);
router.put('/:leaveId/status', protect, authorize('Admin', 'HR', 'Manager'), updateLeaveStatus);

export default router;