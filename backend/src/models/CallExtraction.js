// =====================================================
// CallExtraction Model — المتغيرات المستخرجة من المكالمات
// =====================================================
const mongoose = require('mongoose');

const callExtractionSchema = new mongoose.Schema({
  callId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LiveKitCall',
    default: null,
  },
  chatSessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatSession',
    default: null,
  },
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  // ── Extracted variables (dynamic key-value) ──
  variables: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },

  // ── Confidence score (0-1) ──
  confidence: { type: Number, default: 0, min: 0, max: 1 },

  // ── Processing ──
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
  },
  errorMessage: { type: String, default: '' },

  // ── Webhook delivery ──
  webhookSent: { type: Boolean, default: false },
  webhookResponse: { type: mongoose.Schema.Types.Mixed, default: null },
  webhookError: { type: String, default: '' },

}, { timestamps: true });

callExtractionSchema.index({ callId: 1 });
callExtractionSchema.index({ userId: 1, createdAt: -1 });

callExtractionSchema.methods.toPublicJSON = function() {
  return {
    id: this._id,
    callId: this.callId,
    chatSessionId: this.chatSessionId,
    agentId: this.agentId,
    variables: this.variables,
    confidence: this.confidence,
    status: this.status,
    webhookSent: this.webhookSent,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('CallExtraction', callExtractionSchema);
