import express from 'express';
import { getAllUsers, updateProfile } from '../controllers/userController.js';
import { protect } from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/roleMiddleware.js';
import upload from '../middlewares/uploadMiddleware.js';

const router = express.Router();

router.get('/', protect, authorize('Admin', 'HR'), getAllUsers);
router.put('/profile', protect, upload.single('profilePicture'), updateProfile);

export default router;