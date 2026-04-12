// =====================================================
// Agent Service — Business Logic for Agents
// =====================================================
const Agent = require('../models/Agent');
const { PLAN_LIMITS } = require('../config/constants');

class AgentService {

  /**
   * Create a new agent (checks subscription limits)
   */
  async create(userId, data) {
    // Check agent count limit
    const agentCount = await Agent.countDocuments({ userId });
    // TODO: get user plan and check against PLAN_LIMITS
    // For now, hard limit at 10
    if (agentCount >= 10) {
      throw Object.assign(new Error('وصلت للحد الأقصى من المساعدين'), { statusCode: 403 });
    }

    const agent = await Agent.create({
      userId,
      ...data,
      status: data.status || 'draft',
    });

    return agent;
  }

  /**
   * Get all agents for a user
   */
  async getAll(userId, { page = 1, limit = 20, status } = {}) {
    const filter = { userId };
    if (status) filter.status = status;

    const [agents, total] = await Promise.all([
      Agent.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Agent.countDocuments(filter),
    ]);

    return { agents, total, page, limit };
  }

  /**
   * Get single agent (checks ownership)
   */
  async getById(userId, agentId) {
    const agent = await Agent.findOne({ _id: agentId, userId });
    if (!agent) {
      throw Object.assign(new Error('المساعد غير موجود'), { statusCode: 404 });
    }
    return agent;
  }

  /**
   * Update agent (checks ownership)
   */
  async update(userId, agentId, data) {
    const agent = await Agent.findOne({ _id: agentId, userId });
    if (!agent) {
      throw Object.assign(new Error('المساعد غير موجود'), { statusCode: 404 });
    }

    Object.assign(agent, data);
    await agent.save();
    return agent;
  }

  /**
   * Delete agent (checks ownership)
   */
  async delete(userId, agentId) {
    const agent = await Agent.findOneAndDelete({ _id: agentId, userId });
    if (!agent) {
      throw Object.assign(new Error('المساعد غير موجود'), { statusCode: 404 });
    }
    return agent;
  }
}

module.exports = new AgentService();
