// =====================================================
// Usage Service — Track API calls, minutes, messages
// =====================================================
const User = require('../models/User');

class UsageService {

  /**
   * Track a call minute usage
   */
  async trackCallMinutes(userId, minutes) {
    await User.findByIdAndUpdate(userId, {
      $inc: { 'usage.callMinutes': minutes, 'usage.creditsUsed': minutes * 100 },
    });
  }

  /**
   * Track a chat message
   */
  async trackChatMessage(userId) {
    await User.findByIdAndUpdate(userId, {
      $inc: { 'usage.chatMessages': 1, 'usage.creditsUsed': 5 },
    });
  }

  /**
   * Track a document processed
   */
  async trackDocument(userId) {
    await User.findByIdAndUpdate(userId, {
      $inc: { 'usage.documentsProcessed': 1, 'usage.creditsUsed': 50 },
    });
  }

  /**
   * Track an API call
   */
  async trackApiCall(userId) {
    await User.findByIdAndUpdate(userId, {
      $inc: { 'usage.apiCalls': 1, 'usage.creditsUsed': 1 },
    });
  }

  /**
   * Get current usage for a user
   */
  async getCurrentUsage(userId) {
    const user = await User.findById(userId).select('usage planId');
    return user?.usage || {};
  }

  /**
   * Reset monthly usage (called by cron or scheduler)
   */
  async resetMonthlyUsage(userId) {
    await User.findByIdAndUpdate(userId, {
      $set: {
        'usage.currentPeriodStart': new Date(),
        'usage.callMinutes': 0,
        'usage.chatMessages': 0,
        'usage.documentsProcessed': 0,
        'usage.apiCalls': 0,
        'usage.creditsUsed': 0,
      },
    });
  }

  /**
   * Check if user has exceeded their plan limits
   */
  async checkLimits(userId, resource) {
    const user = await User.findById(userId).select('usage planId').populate('planId');
    if (!user || !user.planId) return { allowed: false, reason: 'لا يوجد اشتراك فعال' };

    // TODO: compare user.usage against plan limits
    // For now, always allow
    return { allowed: true };
  }
}

module.exports = new UsageService();
