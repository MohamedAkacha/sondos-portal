// =====================================================
// Chat Routes
// =====================================================
const router = require('express').Router();
const chatCtrl = require('../controllers/chat.controller');
const { protect } = require('../middleware/auth');

// ── Public routes (for widget — no auth) ──
router.post('/public/:agentId/start', chatCtrl.publicStartSession);
router.post('/public/:sessionId/message', chatCtrl.publicSendMessage);

// ── Authenticated routes ──
router.use(protect);
router.post('/:agentId/sessions', chatCtrl.startSession);
router.get('/sessions', chatCtrl.getSessions);
router.get('/sessions/:sessionId', chatCtrl.getSession);
router.post('/sessions/:sessionId/message', chatCtrl.sendMessage);
router.delete('/sessions/:sessionId', chatCtrl.endSession);

module.exports = router;
