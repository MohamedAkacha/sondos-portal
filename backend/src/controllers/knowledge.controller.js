// =====================================================
// Knowledge Controller
// =====================================================
const knowledgeService = require('../services/knowledge.service');

// ── Knowledge Base CRUD ──

exports.createBase = async (req, res) => {
  try {
    const base = await knowledgeService.createBase(req.user._id, req.body);
    res.status(201).json({ success: true, data: base.toPublicJSON() });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.getAllBases = async (req, res) => {
  try {
    const bases = await knowledgeService.getAllBases(req.user._id);
    res.json({ success: true, data: bases });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getBase = async (req, res) => {
  try {
    const base = await knowledgeService.getBase(req.user._id, req.params.id);
    res.json({ success: true, data: base.toPublicJSON() });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.updateBase = async (req, res) => {
  try {
    const base = await knowledgeService.updateBase(req.user._id, req.params.id, req.body);
    res.json({ success: true, data: base.toPublicJSON() });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.deleteBase = async (req, res) => {
  try {
    await knowledgeService.deleteBase(req.user._id, req.params.id);
    res.json({ success: true, message: 'تم حذف قاعدة المعرفة بنجاح' });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// ── Documents ──

exports.getDocuments = async (req, res) => {
  try {
    const docs = await knowledgeService.getDocuments(req.user._id, req.params.id);
    res.json({ success: true, data: docs });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'يرجى اختيار ملف' });
    }
    const doc = await knowledgeService.addFileDocument(req.user._id, req.params.id, req.file);
    res.status(201).json({ success: true, data: doc.toPublicJSON(), message: 'تم رفع المستند — جاري المعالجة' });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.addUrl = async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ success: false, message: 'الرابط مطلوب' });
    const doc = await knowledgeService.addUrlDocument(req.user._id, req.params.id, url);
    res.status(201).json({ success: true, data: doc.toPublicJSON() });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.addFaq = async (req, res) => {
  try {
    const { question, answer } = req.body;
    if (!question || !answer) return res.status(400).json({ success: false, message: 'السؤال والجواب مطلوبان' });
    const doc = await knowledgeService.addFaqDocument(req.user._id, req.params.id, question, answer);
    res.status(201).json({ success: true, data: doc.toPublicJSON() });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.deleteDocument = async (req, res) => {
  try {
    await knowledgeService.deleteDocument(req.user._id, req.params.docId);
    res.json({ success: true, message: 'تم حذف المستند بنجاح' });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// ── Search ──

exports.search = async (req, res) => {
  try {
    const { query, topK } = req.body;
    if (!query) return res.status(400).json({ success: false, message: 'نص البحث مطلوب' });
    const results = await knowledgeService.search(req.user._id, query, parseInt(topK) || 5);
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Internal search (for Agent Worker) ──
exports.internalSearch = async (req, res) => {
  try {
    const { userId, query, topK } = req.body;
    if (!userId || !query) return res.status(400).json({ success: false });
    const results = await knowledgeService.search(userId, query, parseInt(topK) || 5);
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
