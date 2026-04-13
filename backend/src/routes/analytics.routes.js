// =====================================================
// Analytics Routes
// =====================================================
const router = require('express').Router();
const analyticsCtrl = require('../controllers/analytics.controller');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/overview', analyticsCtrl.getOverview);
router.get('/call/:callId', analyticsCtrl.getCallAnalysis);
router.get('/extraction/:callId', analyticsCtrl.getCallExtraction);
router.post('/analyze/:callId', analyticsCtrl.analyzeCall);
router.post('/extract/:callId', analyticsCtrl.extractVariables);

module.exports = router;
