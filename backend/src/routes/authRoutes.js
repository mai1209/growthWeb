import express from 'express';
import {
  changePassword,
  forgotPassword,
  getProfile,
  login,
  resetPassword,
  signup,
  updateProfile,
} from '../controllers/authController.js';
import { requireAuth } from '../middlewares/authJwt.js';

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/change-password', requireAuth, changePassword);
router.get('/profile', requireAuth, getProfile);
router.put('/profile', requireAuth, updateProfile);

export default router;
