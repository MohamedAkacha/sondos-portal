// =====================================================
// Lead Routes
// =====================================================
const router = require('express').Router();
const leadCtrl = require('../controllers/lead.controller');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/', leadCtrl.create);
router.get('/', leadCtrl.getAll);
router.get('/stats', leadCtrl.getStats);
router.get('/export', leadCtrl.exportCSV);
router.post('/import', leadCtrl.importCSV);
router.post('/bulk-delete', leadCtrl.bulkDelete);
router.get('/:id', leadCtrl.getById);
router.put('/:id', leadCtrl.update);
router.delete('/:id', leadCtrl.delete);
router.patch('/:id/status', leadCtrl.updateStatus);

module.exports = router;
