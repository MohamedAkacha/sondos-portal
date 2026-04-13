// =====================================================
// Analytics Controller — Call Analysis + Overview
// =====================================================
const analysisService = require('../services/analysis.service');

// POST /api/analytics/analyze/:callId — trigger analysis for a call
exports.analyzeCall = async (req, res) => {
  try {
    const analysis = await analysisService.analyzeCall(req.params.callId);
    res.json({ success: true, data: analysis.toPublicJSON() });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// GET /api/analytics/call/:callId — get analysis for a call
exports.getCallAnalysis = async (req, res) => {
  try {
    const analysis = await analysisService.getForCall(req.params.callId);
    if (!analysis) return res.json({ success: true, data: null });
    res.json({ success: true, data: analysis.toPublicJSON() });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/analytics/extraction/:callId — get extraction for a call
exports.getCallExtraction = async (req, res) => {
  try {
    const extraction = await analysisService.getExtractionForCall(req.params.callId);
    if (!extraction) return res.json({ success: true, data: null });
    res.json({ success: true, data: extraction.toPublicJSON() });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/analytics/extract/:callId — trigger extraction for a call
exports.extractVariables = async (req, res) => {
  try {
    const extraction = await analysisService.extractVariables(req.params.callId);
    if (!extraction) return res.json({ success: true, data: null, message: 'Extraction not configured for this agent' });
    res.json({ success: true, data: extraction.toPublicJSON() });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// GET /api/analytics/overview — dashboard analytics
exports.getOverview = async (req, res) => {
  try {
    const { startDate, endDate, agentId } = req.query;
    const data = await analysisService.getOverview(req.user._id, { startDate, endDate, agentId });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
