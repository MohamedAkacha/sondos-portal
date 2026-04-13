// =====================================================
// Internal Routes — للـ Workers فقط (محمي بـ Agent Secret)
// =====================================================
const router = require('express').Router();
const analysisService = require('../services/analysis.service');
const handoffService = require('../services/handoff.service');
const memoryService = require('../services/memory.service');
const LiveKitCall = require('../models/LiveKitCall');
const CallAnalysis = require('../models/CallAnalysis');

// ── Auth: Agent Secret ──
router.use((req, res, next) => {
  const secret = req.headers['x-agent-secret'];
  if (!secret || secret !== process.env.AGENT_SECRET) {
    return res.status(401).json({ success: false, message: 'Invalid agent secret' });
  }
  next();
});

// ── Get unanalyzed calls ──
router.get('/calls/unanalyzed', async (req, res) => {
  try {
    const analyzedCallIds = await CallAnalysis.distinct('callId');
    const calls = await LiveKitCall.find({
      status: 'completed',
      _id: { $nin: analyzedCallIds },
      'transcript.0': { $exists: true },
    }).sort({ createdAt: -1 }).limit(20).select('_id roomName userId agentId');

    res.json({ success: true, data: calls });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── Analyze a call ──
router.post('/analyze/:callId', async (req, res) => {
  try {
    const analysis = await analysisService.analyzeCall(req.params.callId);
    res.json({ success: true, data: analysis });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── Extract variables from a call ──
router.post('/extract/:callId', async (req, res) => {
  try {
    const extraction = await analysisService.extractVariables(req.params.callId);
    res.json({ success: true, data: extraction });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── Create handoff from Agent Worker ──
router.post('/handoff/create', async (req, res) => {
  try {
    const handoff = await handoffService.createFromAgent(
      req.body.userId,
      req.body.agentId,
      req.body
    );
    res.json({ success: true, data: handoff.toPublicJSON() });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── Update conversation memory ──
router.post('/memory/update', async (req, res) => {
  try {
    const { userId, contactIdentifier, contactName, summary, keyFacts, sentiment, sourceId, contactType } = req.body;
    const memory = await memoryService.updateAfterInteraction(userId, contactIdentifier, {
      contactName, summary, keyFacts, sentiment, sourceId, contactType,
    });
    res.json({ success: true, data: memory.toPublicJSON() });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── Get memory context for a contact (Agent Worker uses before call) ──
router.get('/memory/context', async (req, res) => {
  try {
    const { userId, contactIdentifier } = req.query;
    const context = await memoryService.getContext(userId, contactIdentifier);
    res.json({ success: true, data: { context } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── Knowledge search (Agent Worker uses during call) ──
router.post('/knowledge/search', async (req, res) => {
  try {
    const knowledgeService = require('../services/knowledge.service');
    const { userId, query, topK } = req.body;
    const results = await knowledgeService.search(userId, query, parseInt(topK) || 5);
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── Capture lead from Agent Worker ──
router.post('/leads/capture', async (req, res) => {
  try {
    const leadService = require('../services/lead.service');
    const lead = await leadService.captureFromAgent(req.body.userId, req.body.agentId, req.body);
    res.json({ success: true, data: lead.toPublicJSON() });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
