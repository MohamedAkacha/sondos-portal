// =====================================================
// Public Routes — مسارات عامة للأنظمة الخارجية
// ─────────────────────────────────────────────────────
// لا تحتاج توكن مستخدم — تعتمد على API Key
// =====================================================
const router = require('express').Router();
const publicCtrl = require('../controllers/public.controller');

// GET /api/public/automation-status
// التحقق من حالة الأتمتة — للأنظمة الخارجية
router.get('/automation-status', publicCtrl.getAutomationStatus);

// GET /api/public/flow-status/:flowKey
// التحقق من حالة أتمتة محددة — للأنظمة الخارجية
router.get('/flow-status/:flowKey', publicCtrl.getFlowStatus);

// GET /api/public/flows-status
// جلب حالة كل الأتمتة — للأنظمة الخارجية
router.get('/flows-status', publicCtrl.getAllFlowsStatus);

module.exports = router;
