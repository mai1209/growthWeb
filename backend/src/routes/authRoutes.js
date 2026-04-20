import express from 'express';
import {
  changePassword,
  forgotPassword,
  login,
  resetPassword,
  signup,
} from '../controllers/authController.js';
import { requireAuth } from '../middlewares/authJwt.js';

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/change-password', requireAuth, changePassword);

export default router;
