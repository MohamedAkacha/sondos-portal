// =====================================================
// Phone Routes — أرقام الهاتف
// ─────────────────────────────────────────────────────
// All routes require JWT auth (protect middleware)
// =====================================================
const router = require('express').Router();
const phoneCtrl = require('../controllers/phone.controller');
const { protect } = require('../middleware/auth');

router.use(protect);

// Provider info (must be before /:id routes)
router.get('/providers', phoneCtrl.getProviders);

// Search available numbers to buy
router.get('/available', phoneCtrl.searchAvailable);

// Purchase from Twilio/Telnyx
router.post('/purchase', phoneCtrl.purchaseNumber);

// Add custom SIP number
router.post('/custom', phoneCtrl.addCustomNumber);

// CRUD
router.get('/', phoneCtrl.listPhones);
router.get('/:id', phoneCtrl.getPhone);
router.put('/:id', phoneCtrl.updatePhone);
router.delete('/:id', phoneCtrl.deletePhone);

// Retry SIP setup
router.post('/:id/setup-sip', phoneCtrl.setupSip);

module.exports = router;
