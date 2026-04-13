// =====================================================
// UsageRecord Model — سجل استخدام مفصّل لكل عملية
// =====================================================
const mongoose = require('mongoose');

const usageRecordSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  // ── Action type ──
  type: {
    type: String,
    enum: ['call_minute', 'chat_message', 'document_process', 'api_call', 'sms_sent', 'voice_clone', 'embedding'],
    required: true,
    index: true,
  },

  // ── Quantity ──
  quantity: { type: Number, default: 1 },

  // ── Cost in halala (1 SAR = 100 halala) ──
  costHalala: { type: Number, default: 0 },

  // ── Reference ──
  referenceId: { type: String, default: '' },
  referenceType: { type: String, default: '' },

  // ── Details ──
  description: { type: String, default: '' },

  // ── Agent ──
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent',
    default: null,
  },

}, { timestamps: true });

usageRecordSchema.index({ userId: 1, createdAt: -1 });
usageRecordSchema.index({ userId: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model('UsageRecord', usageRecordSchema);
