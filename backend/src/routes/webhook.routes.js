const router = require('express').Router();
const webhookCtrl = require('../controllers/webhook.controller');
const { protect } = require('../middleware/auth');

router.use(protect);
router.post('/', webhookCtrl.create);
router.get('/', webhookCtrl.getAll);
router.get('/:id', webhookCtrl.getById);
router.put('/:id', webhookCtrl.update);
router.delete('/:id', webhookCtrl.delete);
router.post('/:id/test', webhookCtrl.test);

module.exports = router;
