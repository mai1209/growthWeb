import express from 'express';
import {
  changePassword,
  checkUsername,
  deleteAccount,
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
router.get('/username-available', requireAuth, checkUsername);
router.put('/profile', requireAuth, updateProfile);
router.delete('/account', requireAuth, deleteAccount);

export default router;
