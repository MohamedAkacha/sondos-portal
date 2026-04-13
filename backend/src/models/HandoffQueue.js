// =====================================================
// HandoffQueue Model — قائمة التحويل لموظف بشري
// =====================================================
const mongoose = require('mongoose');

const handoffQueueSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent',
    default: null,
  },

  // ── Source ──
  sourceType: {
    type: String,
    enum: ['call', 'chat'],
    required: true,
  },
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

  // ── Contact ──
  contactPhone: { type: String, default: '' },
  contactName: { type: String, default: '' },
  contactEmail: { type: String, default: '' },

  // ── Handoff Details ──
  reason: { type: String, default: '' },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal',
  },
  conversationSummary: { type: String, default: '' },

  // ── Status ──
  status: {
    type: String,
    enum: ['waiting', 'assigned', 'in_progress', 'resolved', 'expired'],
    default: 'waiting',
    index: true,
  },

  // ── Assignment ──
  assignedTo: { type: String, default: '' },
  assignedAt: { type: Date, default: null },
  resolvedAt: { type: Date, default: null },
  resolution: { type: String, default: '' },

  // ── Timing ──
  waitTimeSeconds: { type: Number, default: 0 },

}, { timestamps: true });

handoffQueueSchema.index({ userId: 1, status: 1, createdAt: -1 });

handoffQueueSchema.methods.toPublicJSON = function() {
  return {
    id: this._id,
    agentId: this.agentId,
    sourceType: this.sourceType,
    callId: this.callId,
    chatSessionId: this.chatSessionId,
    contactPhone: this.contactPhone,
    contactName: this.contactName,
    contactEmail: this.contactEmail,
    reason: this.reason,
    priority: this.priority,
    conversationSummary: this.conversationSummary,
    status: this.status,
    assignedTo: this.assignedTo,
    assignedAt: this.assignedAt,
    resolvedAt: this.resolvedAt,
    resolution: this.resolution,
    waitTimeSeconds: this.waitTimeSeconds,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('HandoffQueue', handoffQueueSchema);
