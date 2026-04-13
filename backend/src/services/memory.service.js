// =====================================================
// Memory Service — Conversation Memory per Contact
// =====================================================
const ConversationMemory = require('../models/ConversationMemory');

class MemoryService {

  /**
   * Get memory for a contact (used by Agent Worker before call starts)
   */
  async getMemory(userId, contactIdentifier) {
    const memory = await ConversationMemory.findOne({ userId, contactIdentifier });
    return memory;
  }

  /**
   * Get context string for Agent Worker
   */
  async getContext(userId, contactIdentifier) {
    const memory = await this.getMemory(userId, contactIdentifier);
    if (!memory) return '';
    return memory.toContextString();
  }

  /**
   * Update memory after a call/chat (called by Analysis Worker)
   */
  async updateAfterInteraction(userId, contactIdentifier, { contactName, contactCompany, summary, keyFacts, sentiment, sourceId, contactType = 'phone' }) {
    let memory = await ConversationMemory.findOne({ userId, contactIdentifier });

    if (!memory) {
      memory = new ConversationMemory({
        userId,
        contactIdentifier,
        contactType,
      });
    }

    // Update contact info if provided
    if (contactName && !memory.contactName) memory.contactName = contactName;
    if (contactCompany && !memory.contactCompany) memory.contactCompany = contactCompany;

    // Update summary (append or replace)
    if (summary) {
      memory.summary = summary;
    }

    // Add key facts
    if (keyFacts && Array.isArray(keyFacts)) {
      for (const fact of keyFacts) {
        memory.keyFacts.push({
          fact,
          source: sourceId || '',
          createdAt: new Date(),
        });
      }
      // Keep only last 20 facts
      if (memory.keyFacts.length > 20) {
        memory.keyFacts = memory.keyFacts.slice(-20);
      }
    }

    // Update sentiment
    if (sentiment) memory.lastSentiment = sentiment;

    // Update interaction tracking
    memory.totalInteractions += 1;
    memory.lastInteractionAt = new Date();

    await memory.save();
    return memory;
  }

  /**
   * Get all memories for a user (admin view)
   */
  async getAll(userId, { page = 1, limit = 20, search } = {}) {
    const filter = { userId };
    if (search) {
      filter.$or = [
        { contactIdentifier: { $regex: search, $options: 'i' } },
        { contactName: { $regex: search, $options: 'i' } },
      ];
    }

    const [memories, total] = await Promise.all([
      ConversationMemory.find(filter).sort({ lastInteractionAt: -1 }).skip((page - 1) * limit).limit(limit),
      ConversationMemory.countDocuments(filter),
    ]);

    return { memories: memories.map(m => m.toPublicJSON()), total, page, limit };
  }

  /**
   * Delete memory for a contact
   */
  async deleteMemory(userId, memoryId) {
    const memory = await ConversationMemory.findOneAndDelete({ _id: memoryId, userId });
    if (!memory) throw Object.assign(new Error('الذاكرة غير موجودة'), { statusCode: 404 });
    return memory;
  }
}

module.exports = new MemoryService();
