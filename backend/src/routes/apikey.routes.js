const router = require('express').Router();
const apikeyCtrl = require('../controllers/apikey.controller');
const { protect } = require('../middleware/auth');

router.use(protect);
router.post('/', apikeyCtrl.create);
router.get('/', apikeyCtrl.getAll);
router.delete('/:id', apikeyCtrl.delete);
router.post('/:id/toggle', apikeyCtrl.toggle);

module.exports = router;
