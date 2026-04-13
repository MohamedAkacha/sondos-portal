// =====================================================
// Usage Routes
// =====================================================
const router = require('express').Router();
const usageCtrl = require('../controllers/usage.controller');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/current', usageCtrl.getCurrent);
router.get('/history', usageCtrl.getHistory);
router.get('/breakdown', usageCtrl.getBreakdown);
router.get('/daily', usageCtrl.getDailyUsage);
router.get('/stats', usageCtrl.getStats);

module.exports = router;
