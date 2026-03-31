// =====================================================
// Campaign Routes — حملات المكالمات الصادرة
// ─────────────────────────────────────────────────────
// All routes require JWT auth (protect middleware)
// =====================================================
const router = require('express').Router();
const campaignCtrl = require('../controllers/campaign.controller');
const { protect } = require('../middleware/auth');

router.use(protect);

// CRUD
router.get('/', campaignCtrl.listCampaigns);
router.post('/', campaignCtrl.createCampaign);
router.get('/:id', campaignCtrl.getCampaign);
router.put('/:id', campaignCtrl.updateCampaign);
router.delete('/:id', campaignCtrl.deleteCampaign);

// Actions
router.post('/:id/start', campaignCtrl.startCampaign);
router.post('/:id/pause', campaignCtrl.pauseCampaign);

// Results
router.get('/:id/results', campaignCtrl.getCampaignResults);

module.exports = router;
