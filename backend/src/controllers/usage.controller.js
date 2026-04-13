// =====================================================
// Usage Controller — Credits & Billing APIs
// =====================================================
const User = require('../models/User');
const UsageRecord = require('../models/UsageRecord');
const LiveKitCall = require('../models/LiveKitCall');
const ChatSession = require('../models/ChatSession');

// GET /api/usage/current — current period usage summary
exports.getCurrent = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('usage planId').populate('planId');
    res.json({ success: true, data: { usage: user.usage, plan: user.planId } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/usage/history — usage records with pagination
exports.getHistory = async (req, res) => {
  try {
    const { page = 1, limit = 50, type, startDate, endDate } = req.query;
    const filter = { userId: req.user._id };
    if (type) filter.type = type;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const [records, total] = await Promise.all([
      UsageRecord.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit)),
      UsageRecord.countDocuments(filter),
    ]);

    res.json({ success: true, data: { records, total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/usage/breakdown — cost breakdown by type
exports.getBreakdown = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const match = { userId: require('mongoose').Types.ObjectId.createFromHexString(req.user._id.toString()) };
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(endDate);
    }

    const breakdown = await UsageRecord.aggregate([
      { $match: match },
      { $group: {
        _id: '$type',
        totalQuantity: { $sum: '$quantity' },
        totalCost: { $sum: '$costHalala' },
        count: { $sum: 1 },
      }},
      { $sort: { totalCost: -1 } },
    ]);

    const totalCost = breakdown.reduce((sum, b) => sum + b.totalCost, 0);

    res.json({ success: true, data: { breakdown, totalCostHalala: totalCost, totalCostSAR: totalCost / 100 } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/usage/daily — daily usage for charts
exports.getDailyUsage = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const daily = await UsageRecord.aggregate([
      { $match: { userId: require('mongoose').Types.ObjectId.createFromHexString(req.user._id.toString()), createdAt: { $gte: startDate } } },
      { $group: {
        _id: { date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, type: '$type' },
        total: { $sum: '$quantity' },
        cost: { $sum: '$costHalala' },
      }},
      { $sort: { '_id.date': 1 } },
    ]);

    res.json({ success: true, data: daily });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/usage/stats — quick stats for dashboard
exports.getStats = async (req, res) => {
  try {
    const userId = req.user._id;
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [callsThisMonth, callsLastMonth, chatsThisMonth, totalLeads, user] = await Promise.all([
      LiveKitCall.countDocuments({ userId, createdAt: { $gte: thisMonth } }),
      LiveKitCall.countDocuments({ userId, createdAt: { $gte: lastMonth, $lt: thisMonth } }),
      ChatSession.countDocuments({ userId, createdAt: { $gte: thisMonth } }),
      require('../models/Lead').countDocuments({ userId }),
      User.findById(userId).select('usage'),
    ]);

    const callsChange = callsLastMonth > 0 ? Math.round(((callsThisMonth - callsLastMonth) / callsLastMonth) * 100) : 0;

    res.json({
      success: true,
      data: {
        callsThisMonth,
        callsChange,
        chatsThisMonth,
        totalLeads,
        usage: user?.usage || {},
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
