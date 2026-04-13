// =====================================================
// Extraction Controller — Manage Agent Extraction Config
// =====================================================
const Agent = require('../models/Agent');
const CallExtraction = require('../models/CallExtraction');

// GET /api/extraction/config/:agentId
exports.getConfig = async (req, res) => {
  try {
    const agent = await Agent.findOne({ _id: req.params.agentId, userId: req.user._id });
    if (!agent) return res.status(404).json({ success: false, message: 'المساعد غير موجود' });

    res.json({ success: true, data: agent.extractionConfig || { enabled: false, variables: [] } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/extraction/config/:agentId
exports.updateConfig = async (req, res) => {
  try {
    const agent = await Agent.findOne({ _id: req.params.agentId, userId: req.user._id });
    if (!agent) return res.status(404).json({ success: false, message: 'المساعد غير موجود' });

    agent.extractionConfig = req.body;
    await agent.save();

    res.json({ success: true, data: agent.extractionConfig });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/extraction/calls — list all extractions for user
exports.listExtractions = async (req, res) => {
  try {
    const { page = 1, limit = 20, agentId } = req.query;
    const filter = { userId: req.user._id };
    if (agentId) filter.agentId = agentId;

    const [extractions, total] = await Promise.all([
      CallExtraction.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit)).populate('callId', 'roomName durationSeconds direction createdAt'),
      CallExtraction.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        extractions: extractions.map(e => e.toPublicJSON()),
        total,
        page: parseInt(page),
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
