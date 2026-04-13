// =====================================================
// Handoff Service — Human Handoff Queue Management
// =====================================================
const HandoffQueue = require('../models/HandoffQueue');

class HandoffService {

  async create(data) {
    const handoff = await HandoffQueue.create(data);
    return handoff;
  }

  async getQueue(userId, { status, priority, page = 1, limit = 20 } = {}) {
    const filter = { userId };
    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    const [items, total] = await Promise.all([
      HandoffQueue.find(filter).sort({ priority: -1, createdAt: 1 }).skip((page - 1) * limit).limit(limit).populate('agentId', 'name avatar'),
      HandoffQueue.countDocuments(filter),
    ]);

    return { items: items.map(i => i.toPublicJSON()), total, page, limit };
  }

  async getById(userId, handoffId) {
    const handoff = await HandoffQueue.findOne({ _id: handoffId, userId }).populate('agentId', 'name avatar');
    if (!handoff) throw Object.assign(new Error('العنصر غير موجود'), { statusCode: 404 });
    return handoff;
  }

  async assign(userId, handoffId, assignedTo) {
    const handoff = await HandoffQueue.findOne({ _id: handoffId, userId });
    if (!handoff) throw Object.assign(new Error('العنصر غير موجود'), { statusCode: 404 });

    handoff.status = 'assigned';
    handoff.assignedTo = assignedTo;
    handoff.assignedAt = new Date();
    handoff.waitTimeSeconds = Math.floor((new Date() - handoff.createdAt) / 1000);
    await handoff.save();
    return handoff;
  }

  async startProgress(userId, handoffId) {
    const handoff = await HandoffQueue.findOne({ _id: handoffId, userId });
    if (!handoff) throw Object.assign(new Error('العنصر غير موجود'), { statusCode: 404 });
    handoff.status = 'in_progress';
    await handoff.save();
    return handoff;
  }

  async resolve(userId, handoffId, resolution) {
    const handoff = await HandoffQueue.findOne({ _id: handoffId, userId });
    if (!handoff) throw Object.assign(new Error('العنصر غير موجود'), { statusCode: 404 });

    handoff.status = 'resolved';
    handoff.resolution = resolution;
    handoff.resolvedAt = new Date();
    await handoff.save();
    return handoff;
  }

  async getStats(userId) {
    const [waiting, assigned, inProgress, resolvedToday] = await Promise.all([
      HandoffQueue.countDocuments({ userId, status: 'waiting' }),
      HandoffQueue.countDocuments({ userId, status: 'assigned' }),
      HandoffQueue.countDocuments({ userId, status: 'in_progress' }),
      HandoffQueue.countDocuments({ userId, status: 'resolved', resolvedAt: { $gte: new Date(new Date().setHours(0,0,0,0)) } }),
    ]);

    // Average wait time for resolved items today
    const avgWait = await HandoffQueue.aggregate([
      { $match: { userId: require('mongoose').Types.ObjectId.createFromHexString(userId.toString()), status: 'resolved', resolvedAt: { $gte: new Date(new Date().setHours(0,0,0,0)) } } },
      { $group: { _id: null, avgWait: { $avg: '$waitTimeSeconds' } } },
    ]);

    return { waiting, assigned, inProgress, resolvedToday, avgWaitSeconds: Math.round(avgWait[0]?.avgWait || 0) };
  }

  // Called by Agent Worker when transfer_to_human tool is triggered
  async createFromAgent(userId, agentId, { callId, chatSessionId, sourceType, contactPhone, contactName, reason, conversationSummary }) {
    return this.create({
      userId, agentId, sourceType,
      callId: callId || null,
      chatSessionId: chatSessionId || null,
      contactPhone: contactPhone || '',
      contactName: contactName || '',
      reason: reason || 'طلب العميل التحدث مع موظف',
      conversationSummary: conversationSummary || '',
      priority: 'normal',
      status: 'waiting',
    });
  }
}

module.exports = new HandoffService();
