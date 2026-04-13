// =====================================================
// ConversationMemory Model — ذاكرة المحادثات لكل رقم
// =====================================================
const mongoose = require('mongoose');

const conversationMemorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  // ── Identifier (phone number or email) ──
  contactIdentifier: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  contactType: {
    type: String,
    enum: ['phone', 'email', 'widget_session'],
    default: 'phone',
  },

  // ── Contact Info (enriched over time) ──
  contactName: { type: String, default: '' },
  contactCompany: { type: String, default: '' },

  // ── Memory Summary (updated by Analysis Worker after each call) ──
  summary: {
    type: String,
    default: '',
    maxlength: 2000,
  },

  // ── Key Facts (structured data extracted from conversations) ──
  keyFacts: [{
    fact: { type: String, required: true },
    source: { type: String, default: '' },  // call ID or chat ID
    createdAt: { type: Date, default: Date.now },
  }],

  // ── Preferences & Notes ──
  preferences: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },

  // ── Interaction History ──
  totalInteractions: { type: Number, default: 0 },
  lastInteractionAt: { type: Date, default: null },
  lastSentiment: {
    type: String,
    enum: ['very_positive', 'positive', 'neutral', 'negative', 'very_negative', ''],
    default: '',
  },

  // ── Linked Lead ──
  leadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead',
    default: null,
  },

}, { timestamps: true });

// Compound unique: one memory per user per contact
conversationMemorySchema.index({ userId: 1, contactIdentifier: 1 }, { unique: true });

/**
 * Get context string for Agent Worker to inject into system prompt
 */
conversationMemorySchema.methods.toContextString = function() {
  let context = '';

  if (this.contactName) {
    context += `اسم المتصل: ${this.contactName}\n`;
  }
  if (this.contactCompany) {
    context += `الشركة: ${this.contactCompany}\n`;
  }
  if (this.totalInteractions > 0) {
    context += `عدد التواصلات السابقة: ${this.totalInteractions}\n`;
  }
  if (this.summary) {
    context += `ملخص التواصلات السابقة: ${this.summary}\n`;
  }
  if (this.keyFacts && this.keyFacts.length > 0) {
    context += `معلومات مهمة:\n`;
    for (const fact of this.keyFacts.slice(-5)) {
      context += `- ${fact.fact}\n`;
    }
  }
  if (this.lastSentiment) {
    const sentimentLabels = {
      very_positive: 'إيجابي جداً',
      positive: 'إيجابي',
      neutral: 'محايد',
      negative: 'سلبي',
      very_negative: 'سلبي جداً',
    };
    context += `الانطباع في آخر تواصل: ${sentimentLabels[this.lastSentiment] || this.lastSentiment}\n`;
  }

  return context;
};

conversationMemorySchema.methods.toPublicJSON = function() {
  return {
    id: this._id,
    contactIdentifier: this.contactIdentifier,
    contactType: this.contactType,
    contactName: this.contactName,
    contactCompany: this.contactCompany,
    summary: this.summary,
    keyFacts: this.keyFacts,
    preferences: this.preferences,
    totalInteractions: this.totalInteractions,
    lastInteractionAt: this.lastInteractionAt,
    lastSentiment: this.lastSentiment,
    leadId: this.leadId,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('ConversationMemory', conversationMemorySchema);
