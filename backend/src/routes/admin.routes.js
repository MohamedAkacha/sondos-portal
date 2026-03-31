const router = require('express').Router();
const adminCtrl = require('../controllers/admin.controller');
const { protect, adminOnly } = require('../middleware/auth');

// All routes require admin authentication
router.use(protect, adminOnly);

// Dashboard
router.get('/dashboard', adminCtrl.getDashboard);

// Balance Transfer (AutoCalls White-Label)
router.post('/transfer-balance', adminCtrl.transferBalance);

// Users CRUD
router.get('/users', adminCtrl.getUsers);
router.get('/users/:id', adminCtrl.getUser);
router.put('/users/:id', adminCtrl.updateUser);
router.put('/users/:id/status', adminCtrl.updateUserStatus);
router.delete('/users/:id', adminCtrl.deleteUser);

// SIP Cleanup
router.post("/sip-cleanup", adminCtrl.sipCleanup);

module.exports = router;