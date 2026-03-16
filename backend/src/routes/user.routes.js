const router = require('express').Router();
const { body } = require('express-validator');
const userCtrl = require('../controllers/user.controller');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

router.put('/profile', [
  body('name').optional().trim().notEmpty().withMessage('الاسم لا يمكن أن يكون فارغاً'),
  body('phone').optional().trim().notEmpty().withMessage('رقم الجوال لا يمكن أن يكون فارغاً')
], userCtrl.updateProfile);

router.put('/password', [
  body('currentPassword').notEmpty().withMessage('كلمة المرور الحالية مطلوبة'),
  body('newPassword').isLength({ min: 8 }).withMessage('كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل')
], userCtrl.changePassword);

router.get('/sondos-key', userCtrl.getSondosKey);
router.put('/sondos-key', [
  body('apiKey').notEmpty().withMessage('مفتاح API مطلوب')
], userCtrl.updateSondosKey);

// Automation control
router.get('/automation', userCtrl.getAutomation);
router.put('/automation', [
  body('enabled').isBoolean().withMessage('يرجى إرسال قيمة صحيحة (true أو false)')
], userCtrl.updateAutomation);

// Full API key (for automation integration display)
router.get('/api-key', userCtrl.getFullApiKey);

// My Plan — تفاصيل باقة المستخدم
router.get('/my-plan', userCtrl.getMyPlan);

// My Flows — الأتمتة الخاصة بالمستخدم
router.get('/my-flows', userCtrl.getMyFlows);
router.put('/my-flows/:flowId/toggle', [
  body('enabled').isBoolean().withMessage('يرجى إرسال قيمة صحيحة (true أو false)')
], userCtrl.toggleFlow);

module.exports = router;