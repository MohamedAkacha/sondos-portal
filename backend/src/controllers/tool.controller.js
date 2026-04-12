// =====================================================
// Tool Controller — CRUD + Test + Toggle
// =====================================================
const toolService = require('../services/tool.service');

// POST /api/tools
exports.create = async (req, res) => {
  try {
    const tool = await toolService.create(req.user._id, req.body);
    res.status(201).json({ success: true, data: tool.toPublicJSON() });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// GET /api/tools
exports.getAll = async (req, res) => {
  try {
    const { page, limit, type } = req.query;
    const result = await toolService.getAll(req.user._id, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      type,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/tools/built-in
exports.getBuiltIn = async (req, res) => {
  try {
    const tools = toolService.getBuiltInTools();
    res.json({ success: true, data: tools });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/tools/:id
exports.getById = async (req, res) => {
  try {
    const tool = await toolService.getById(req.user._id, req.params.id);
    res.json({ success: true, data: tool.toPublicJSON() });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// PUT /api/tools/:id
exports.update = async (req, res) => {
  try {
    const tool = await toolService.update(req.user._id, req.params.id, req.body);
    res.json({ success: true, data: tool.toPublicJSON() });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// DELETE /api/tools/:id
exports.delete = async (req, res) => {
  try {
    await toolService.delete(req.user._id, req.params.id);
    res.json({ success: true, message: 'تم حذف الأداة بنجاح' });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// POST /api/tools/:id/test
exports.test = async (req, res) => {
  try {
    const result = await toolService.test(req.user._id, req.params.id, req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// POST /api/tools/:id/toggle
exports.toggle = async (req, res) => {
  try {
    const tool = await toolService.toggle(req.user._id, req.params.id);
    res.json({ success: true, data: tool.toPublicJSON() });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// GET /api/agents/:agentId/tools
exports.getForAgent = async (req, res) => {
  try {
    const tools = await toolService.getForAgent(req.user._id, req.params.agentId);
    res.json({ success: true, data: tools.map(t => t.toPublicJSON()) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/internal/tools/:agentId/schemas (for Agent Worker)
exports.getToolSchemas = async (req, res) => {
  try {
    const schemas = await toolService.getToolSchemas(req.params.userId, req.params.agentId);
    res.json({ success: true, data: schemas });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/internal/tools/execute (for Agent Worker)
exports.executeFromAgent = async (req, res) => {
  try {
    const { toolId, params } = req.body;
    const Tool = require('../models/Tool');
    const tool = await Tool.findById(toolId);
    if (!tool) return res.status(404).json({ success: false, message: 'Tool not found' });

    const result = await toolService.executeHTTP(tool, params);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
