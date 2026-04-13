// =====================================================
// Public API v1 — Authenticated via API Key
// =====================================================
const router = require('express').Router();
const { apiKeyAuth } = require('../../middleware/apiKeyAuth');
const Agent = require('../../models/Agent');
const LiveKitCall = require('../../models/LiveKitCall');
const Lead = require('../../models/Lead');
const ChatSession = require('../../models/ChatSession');
const chatService = require('../../services/chat.service');
const knowledgeService = require('../../services/knowledge.service');

// All v1 routes require API key
router.use(apiKeyAuth);

// ═══════════════ Agents ═══════════════
router.get('/agents', async (req, res) => {
  try {
    const agents = await Agent.find({ userId: req.user._id }).select('name description status avatar callDirection createdAt');
    res.json({ success: true, data: agents });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.get('/agents/:id', async (req, res) => {
  try {
    const agent = await Agent.findOne({ _id: req.params.id, userId: req.user._id });
    if (!agent) return res.status(404).json({ success: false, message: 'Agent not found' });
    res.json({ success: true, data: agent });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// ═══════════════ Calls ═══════════════
router.get('/calls', async (req, res) => {
  try {
    const { page = 1, limit = 20, status, direction, agentId } = req.query;
    const filter = { userId: req.user._id };
    if (status) filter.status = status;
    if (direction) filter.direction = direction;
    if (agentId) filter.agentId = agentId;

    const [calls, total] = await Promise.all([
      LiveKitCall.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit)).select('-transcript -agentConfig'),
      LiveKitCall.countDocuments(filter),
    ]);
    res.json({ success: true, data: { calls, total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.get('/calls/:id', async (req, res) => {
  try {
    const call = await LiveKitCall.findOne({ _id: req.params.id, userId: req.user._id });
    if (!call) return res.status(404).json({ success: false, message: 'Call not found' });
    res.json({ success: true, data: call });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// ═══════════════ Chat ═══════════════
router.post('/chat/:agentId/start', async (req, res) => {
  try {
    const session = await chatService.startSession(req.params.agentId, { ...req.body, channel: 'api' });
    res.status(201).json({ success: true, data: { sessionId: session._id, greeting: session.messages[0]?.content } });
  } catch (error) { res.status(error.statusCode || 500).json({ success: false, message: error.message }); }
});

router.post('/chat/:sessionId/message', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'Message required' });
    const { reply } = await chatService.sendMessage(req.params.sessionId, message);
    res.json({ success: true, data: { reply } });
  } catch (error) { res.status(error.statusCode || 500).json({ success: false, message: error.message }); }
});

// ═══════════════ Leads ═══════════════
router.get('/leads', async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const filter = { userId: req.user._id };
    if (status) filter.status = status;
    const [leads, total] = await Promise.all([
      Lead.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit)),
      Lead.countDocuments(filter),
    ]);
    res.json({ success: true, data: { leads, total } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.post('/leads', async (req, res) => {
  try {
    const lead = await Lead.create({ userId: req.user._id, source: 'api', ...req.body });
    res.status(201).json({ success: true, data: lead });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// ═══════════════ Knowledge Search ═══════════════
router.post('/knowledge/search', async (req, res) => {
  try {
    const { query, topK } = req.body;
    if (!query) return res.status(400).json({ success: false, message: 'Query required' });
    const results = await knowledgeService.search(req.user._id, query, parseInt(topK) || 5);
    res.json({ success: true, data: results });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

module.exports = router;
