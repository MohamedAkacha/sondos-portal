// =====================================================
// Handoff Controller
// =====================================================
const handoffService = require('../services/handoff.service');

exports.getQueue = async (req, res) => {
  try {
    const result = await handoffService.getQueue(req.user._id, {
      status: req.query.status,
      priority: req.query.priority,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const handoff = await handoffService.getById(req.user._id, req.params.id);
    res.json({ success: true, data: handoff.toPublicJSON() });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.assign = async (req, res) => {
  try {
    const handoff = await handoffService.assign(req.user._id, req.params.id, req.body.assignedTo);
    res.json({ success: true, data: handoff.toPublicJSON() });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.startProgress = async (req, res) => {
  try {
    const handoff = await handoffService.startProgress(req.user._id, req.params.id);
    res.json({ success: true, data: handoff.toPublicJSON() });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.resolve = async (req, res) => {
  try {
    const handoff = await handoffService.resolve(req.user._id, req.params.id, req.body.resolution);
    res.json({ success: true, data: handoff.toPublicJSON() });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.getStats = async (req, res) => {
  try {
    const stats = await handoffService.getStats(req.user._id);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Internal: create from Agent Worker
exports.createFromAgent = async (req, res) => {
  try {
    const handoff = await handoffService.createFromAgent(req.body.userId, req.body.agentId, req.body);
    res.json({ success: true, data: handoff.toPublicJSON() });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
