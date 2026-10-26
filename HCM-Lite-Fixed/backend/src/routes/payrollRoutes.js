import express from 'express';
import { generatePayroll } from '../controllers/payrollController.js';
import { protect } from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/roleMiddleware.js';

const router = express.Router();

router.post('/generate', protect, authorize('Admin', 'HR'), generatePayroll);

export default router;