// =====================================================
// Handoff Routes
// =====================================================
const router = require('express').Router();
const handoffCtrl = require('../controllers/handoff.controller');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/queue', handoffCtrl.getQueue);
router.get('/stats', handoffCtrl.getStats);
router.get('/:id', handoffCtrl.getById);
router.post('/:id/assign', handoffCtrl.assign);
router.post('/:id/start', handoffCtrl.startProgress);
router.post('/:id/resolve', handoffCtrl.resolve);

module.exports = router;
