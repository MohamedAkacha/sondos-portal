// =====================================================
// Webhook Controller
// =====================================================
const webhookService = require('../services/webhook.service');

exports.create = async (req, res) => {
  try {
    const endpoint = await webhookService.create(req.user._id, req.body);
    res.status(201).json({ success: true, data: endpoint.toPublicJSON() });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAll = async (req, res) => {
  try {
    const endpoints = await webhookService.getAll(req.user._id);
    res.json({ success: true, data: endpoints });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const endpoint = await webhookService.getById(req.user._id, req.params.id);
    res.json({ success: true, data: endpoint.toPublicJSON() });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const endpoint = await webhookService.update(req.user._id, req.params.id, req.body);
    res.json({ success: true, data: endpoint.toPublicJSON() });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.delete = async (req, res) => {
  try {
    await webhookService.delete(req.user._id, req.params.id);
    res.json({ success: true, message: 'تم حذف الـ Webhook' });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.test = async (req, res) => {
  try {
    const result = await webhookService.test(req.user._id, req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};
