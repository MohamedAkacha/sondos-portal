// =====================================================
// Auth Routes — v2 Architecture
// =====================================================
const router = require('express').Router();
const { body } = require('express-validator');
const authCtrl = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validator');

// ── Validation rules ──
const registerValidation = [
  body('name').trim().notEmpty().withMessage('الاسم مطلوب'),
  body('email').isEmail().withMessage('البريد الإلكتروني غير صالح'),
  body('phone').trim().notEmpty().withMessage('رقم الجوال مطلوب'),
  body('password').isLength({ min: 8 }).withMessage('كلمة المرور يجب أن تكون 8 أحرف على الأقل'),
];

// ── Public routes ──

// Register free trial
router.post('/register',
  validate(registerValidation),
  authCtrl.register
);

// Register with payment
router.post('/register-with-payment',
  validate([
    ...registerValidation,
    body('planId').notEmpty().withMessage('الباقة مطلوبة'),
    body('moyasarPaymentId').notEmpty().withMessage('معرف الدفع مطلوب'),
  ]),
  authCtrl.registerWithPayment
);

// Login
router.post('/login',
  validate([
    body('email').isEmail().withMessage('البريد الإلكتروني غير صالح'),
    body('password').notEmpty().withMessage('كلمة المرور مطلوبة'),
  ]),
  authCtrl.login
);

// Forgot password
router.post('/forgot-password',
  validate([
    body('email').isEmail().withMessage('البريد الإلكتروني غير صالح'),
  ]),
  authCtrl.forgotPassword
);

// Reset password
router.post('/reset-password',
  validate([
    body('token').notEmpty().withMessage('رمز إعادة التعيين مطلوب'),
    body('newPassword').isLength({ min: 8 }).withMessage('كلمة المرور يجب أن تكون 8 أحرف على الأقل'),
  ]),
  authCtrl.resetPassword
);

// Verify email
router.post('/verify-email',
  validate([
    body('token').notEmpty().withMessage('رمز التأكيد مطلوب'),
  ]),
  authCtrl.verifyEmail
);

// Refresh token
router.post('/refresh',
  validate([
    body('refreshToken').notEmpty().withMessage('Refresh token مطلوب'),
  ]),
  authCtrl.refresh
);

// Logout
router.post('/logout', authCtrl.logout);

// ── Protected routes ──
router.get('/me', protect, authCtrl.me);

module.exports = router;