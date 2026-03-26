// =====================================================
// Agent Routes — المساعدين الأذكياء
// ─────────────────────────────────────────────────────
// All routes require JWT auth (protect middleware)
// =====================================================
const router = require('express').Router();
const agentCtrl = require('../controllers/agent.controller');
const { protect } = require('../middleware/auth');

router.use(protect);

// Templates (must be before /:id routes)
router.get('/templates', agentCtrl.getTemplates);

// AI suggestions
router.post('/suggest', agentCtrl.suggestContent);

// CRUD
router.get('/', agentCtrl.listAgents);
router.post('/', agentCtrl.createAgent);
router.get('/:id', agentCtrl.getAgent);
router.put('/:id', agentCtrl.updateAgent);
router.delete('/:id', agentCtrl.deleteAgent);

// Chat test
router.post('/:id/chat', agentCtrl.chatWithAgent);

// LiveKit config (for token generation)
router.get('/:id/livekit-config', agentCtrl.getAgentLiveKitConfig);

module.exports = router;
