// =====================================================
// API Key Controller
// =====================================================
const ApiKey = require('../models/ApiKey');

exports.create = async (req, res) => {
  try {
    const { name, permissions, expiresAt } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'اسم المفتاح مطلوب' });

    const { key, keyHash, keyPrefix } = ApiKey.generateKey();

    const apiKey = await ApiKey.create({
      userId: req.user._id,
      name,
      key,
      keyHash,
      keyPrefix,
      permissions: permissions || [],
      expiresAt: expiresAt || null,
    });

    // Return the raw key ONLY on creation
    res.status(201).json({
      success: true,
      data: { ...apiKey.toPublicJSON(), key },
      message: 'انسخ المفتاح الآن — لن يظهر مرة أخرى',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAll = async (req, res) => {
  try {
    const keys = await ApiKey.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: keys.map(k => k.toPublicJSON()) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const key = await ApiKey.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!key) return res.status(404).json({ success: false, message: 'المفتاح غير موجود' });
    res.json({ success: true, message: 'تم حذف المفتاح' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.toggle = async (req, res) => {
  try {
    const key = await ApiKey.findOne({ _id: req.params.id, userId: req.user._id });
    if (!key) return res.status(404).json({ success: false, message: 'المفتاح غير موجود' });
    key.isActive = !key.isActive;
    await key.save();
    res.json({ success: true, data: key.toPublicJSON() });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
