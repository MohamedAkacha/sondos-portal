// =====================================================
// Extraction Routes
// =====================================================
const router = require('express').Router();
const extractionCtrl = require('../controllers/extraction.controller');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/config/:agentId', extractionCtrl.getConfig);
router.put('/config/:agentId', extractionCtrl.updateConfig);
router.get('/calls', extractionCtrl.listExtractions);

module.exports = router;
