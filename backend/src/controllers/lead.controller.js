// =====================================================
// Lead Controller
// =====================================================
const leadService = require('../services/lead.service');

exports.create = async (req, res) => {
  try {
    const lead = await leadService.create(req.user._id, req.body);
    res.status(201).json({ success: true, data: lead.toPublicJSON() });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.getAll = async (req, res) => {
  try {
    const result = await leadService.getAll(req.user._id, {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      status: req.query.status,
      source: req.query.source,
      search: req.query.search,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const lead = await leadService.getById(req.user._id, req.params.id);
    res.json({ success: true, data: lead.toPublicJSON() });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const lead = await leadService.update(req.user._id, req.params.id, req.body);
    res.json({ success: true, data: lead.toPublicJSON() });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.delete = async (req, res) => {
  try {
    await leadService.delete(req.user._id, req.params.id);
    res.json({ success: true, message: 'تم حذف العميل المحتمل' });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.bulkDelete = async (req, res) => {
  try {
    const { ids } = req.body;
    const count = await leadService.bulkDelete(req.user._id, ids);
    res.json({ success: true, data: { deletedCount: count } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const lead = await leadService.updateStatus(req.user._id, req.params.id, req.body.status);
    res.json({ success: true, data: lead.toPublicJSON() });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.importCSV = async (req, res) => {
  try {
    const { rows } = req.body;
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'لا توجد بيانات للاستيراد' });
    }
    const count = await leadService.importCSV(req.user._id, rows);
    res.json({ success: true, data: { importedCount: count }, message: `تم استيراد ${count} عميل بنجاح` });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.exportCSV = async (req, res) => {
  try {
    const data = await leadService.exportAll(req.user._id, { status: req.query.status });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getStats = async (req, res) => {
  try {
    const stats = await leadService.getStats(req.user._id);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Internal: capture from Agent Worker
exports.captureFromAgent = async (req, res) => {
  try {
    const { userId, agentId, ...data } = req.body;
    const lead = await leadService.captureFromAgent(userId, agentId, data);
    res.json({ success: true, data: lead.toPublicJSON() });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
