// =====================================================
// ChatSession Model — جلسات الدردشة النصية
// =====================================================
const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant', 'system', 'tool'],
    required: true,
  },
  content: { type: String, required: true },
  toolCall: {
    name: { type: String, default: '' },
    result: { type: String, default: '' },
  },
  timestamp: { type: Date, default: Date.now },
}, { _id: false });

const chatSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent',
    required: true,
    index: true,
  },

  // ── Visitor Info ──
  visitorId: { type: String, default: '' },
  visitorName: { type: String, default: '' },
  visitorEmail: { type: String, default: '' },
  visitorPhone: { type: String, default: '' },
  visitorIp: { type: String, default: '' },
  visitorUserAgent: { type: String, default: '' },
  visitorPageUrl: { type: String, default: '' },

  // ── Channel ──
  channel: {
    type: String,
    enum: ['widget', 'api', 'whatsapp', 'telegram', 'test'],
    default: 'widget',
  },

  // ── Status ──
  status: {
    type: String,
    enum: ['active', 'ended', 'handed_off'],
    default: 'active',
    index: true,
  },

  // ── Messages ──
  messages: [chatMessageSchema],

  // ── Stats ──
  messageCount: { type: Number, default: 0 },
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date, default: null },
  durationSeconds: { type: Number, default: 0 },

  // ── Analysis ──
  sentiment: { type: String, default: '' },
  summary: { type: String, default: '' },

  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },

}, { timestamps: true });

chatSessionSchema.index({ userId: 1, createdAt: -1 });
chatSessionSchema.index({ agentId: 1, status: 1 });

chatSessionSchema.methods.toPublicJSON = function() {
  return {
    id: this._id,
    agentId: this.agentId,
    visitorName: this.visitorName,
    visitorEmail: this.visitorEmail,
    channel: this.channel,
    status: this.status,
    messageCount: this.messageCount,
    startedAt: this.startedAt,
    endedAt: this.endedAt,
    durationSeconds: this.durationSeconds,
    sentiment: this.sentiment,
    summary: this.summary,
    createdAt: this.createdAt,
  };
};

chatSessionSchema.methods.toDetailJSON = function() {
  return { ...this.toPublicJSON(), messages: this.messages, visitorPhone: this.visitorPhone, visitorPageUrl: this.visitorPageUrl, metadata: this.metadata };
};

module.exports = mongoose.model('ChatSession', chatSessionSchema);
