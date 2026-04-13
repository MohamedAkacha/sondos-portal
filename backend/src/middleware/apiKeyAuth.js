// =====================================================
// API Key Auth Middleware — For Public API v1
// =====================================================
const ApiKey = require('../models/ApiKey');
const User = require('../models/User');

const apiKeyAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer sk_')) {
    return res.status(401).json({ success: false, message: 'API key required. Use: Authorization: Bearer sk_...' });
  }

  const rawKey = authHeader.split(' ')[1];

  try {
    const apiKey = await ApiKey.findByKey(rawKey);
    if (!apiKey) {
      return res.status(401).json({ success: false, message: 'Invalid API key' });
    }

    // Check expiry
    if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
      return res.status(401).json({ success: false, message: 'API key expired' });
    }

    // Get user
    const user = await User.findById(apiKey.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Account inactive' });
    }

    // Update usage stats (async, don't block)
    ApiKey.findByIdAndUpdate(apiKey._id, { lastUsedAt: new Date(), $inc: { usageCount: 1 } }).catch(() => {});

    // Attach to request
    req.user = user;
    req.apiKey = apiKey;
    next();

  } catch (error) {
    res.status(500).json({ success: false, message: 'Authentication error' });
  }
};

module.exports = { apiKeyAuth };
