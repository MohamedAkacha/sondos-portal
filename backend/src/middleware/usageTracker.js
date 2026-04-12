// =====================================================
// Usage Tracker Middleware — Logs API calls per user
// =====================================================
const usageService = require('../services/usage.service');

/**
 * Middleware that tracks API usage for authenticated users
 * Add to routes that should count toward API usage limits
 */
const usageTracker = async (req, res, next) => {
  // Only track for authenticated users
  if (req.user && req.user._id) {
    try {
      await usageService.trackApiCall(req.user._id);
    } catch (err) {
      // Don't block the request if tracking fails
      console.error('Usage tracking error:', err.message);
    }
  }
  next();
};

module.exports = { usageTracker };
