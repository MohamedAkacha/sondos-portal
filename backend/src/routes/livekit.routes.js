// =====================================================
// LiveKit Routes — Full Feature Set (v2)
// ─────────────────────────────────────────────────────
// Webhook (no auth) → Agent (secret) → User (JWT) → Admin
// =====================================================
const router = require('express').Router();
const livekitCtrl = require('../controllers/livekit.controller');
const { protect, adminOnly } = require('../middleware/auth');

// ══════════════════════════════════════════════════════
// 1. WEBHOOK — No auth (signature verified in controller)
// ══════════════════════════════════════════════════════
router.post('/webhook', livekitCtrl.webhook);

// ══════════════════════════════════════════════════════
// 2. AGENT ENDPOINTS — Internal auth (X-Agent-Secret)
// ══════════════════════════════════════════════════════
const agentAuth = (req, res, next) => {
  const secret = req.get('X-Agent-Secret') || '';
  const expectedSecret = process.env.SONDOS_AGENT_SECRET || '';

  if (!expectedSecret) {
    return res.status(500).json({ success: false, message: 'Agent secret not configured' });
  }
  if (secret !== expectedSecret) {
    return res.status(401).json({ success: false, message: 'Invalid agent secret' });
  }
  next();
};

router.post('/agent/transcript', agentAuth, livekitCtrl.agentTranscript);
router.post('/agent/call-result', agentAuth, livekitCtrl.agentCallResult);

// ══════════════════════════════════════════════════════
// 3. USER ENDPOINTS — JWT auth required
// ══════════════════════════════════════════════════════
router.use(protect);

// Token generation
router.post('/token', livekitCtrl.generateToken);

// Status check
router.get('/status', livekitCtrl.getStatus);

// Call records
router.get('/calls/stats/summary', livekitCtrl.getCallStats);
router.get('/calls', livekitCtrl.listCalls);
router.get('/calls/:callId', livekitCtrl.getCall);
router.post('/calls/:callId/transcript', livekitCtrl.saveTranscript);

// ══════════════════════════════════════════════════════
// 4. ADMIN ENDPOINTS — JWT + Admin role
// ══════════════════════════════════════════════════════
router.get('/admin/rooms', adminOnly, livekitCtrl.listActiveRooms);
router.get('/admin/rooms/:roomName/participants', adminOnly, livekitCtrl.listParticipants);
router.delete('/admin/rooms/:roomName', adminOnly, livekitCtrl.deleteRoom);
router.post('/admin/rooms/:roomName/kick', adminOnly, livekitCtrl.kickParticipant);

module.exports = router;