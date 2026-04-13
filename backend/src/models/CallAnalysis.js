// =====================================================
// CallAnalysis Model — تحليل ما بعد المكالمة
// =====================================================
const mongoose = require('mongoose');

const callAnalysisSchema = new mongoose.Schema({
  callId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LiveKitCall',
    required: true,
    unique: true,
    index: true,
  },
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

  // ── Summary ──
  summary: { type: String, default: '' },

  // ── Sentiment ──
  sentiment: {
    type: String,
    enum: ['very_positive', 'positive', 'neutral', 'negative', 'very_negative'],
    default: 'neutral',
  },
  sentimentScore: { type: Number, default: 0, min: -1, max: 1 },

  // ── Caller Intent ──
  intent: {
    type: String,
    enum: ['inquiry', 'complaint', 'purchase', 'booking', 'support', 'cancellation', 'feedback', 'other'],
    default: 'other',
  },

  // ── Topics discussed ──
  topics: [{ type: String, trim: true }],

  // ── Agent Performance ──
  performance: {
    accuracy: { type: Number, default: 0, min: 0, max: 10 },
    helpfulness: { type: Number, default: 0, min: 0, max: 10 },
    professionalism: { type: Number, default: 0, min: 0, max: 10 },
    overall: { type: Number, default: 0, min: 0, max: 10 },
  },

  // ── Call Outcome ──
  goalAchieved: { type: Boolean, default: null },
  followUpRequired: { type: Boolean, default: false },
  followUpNotes: { type: String, default: '' },

  // ── Processing ──
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
  },
  errorMessage: { type: String, default: '' },
  processingTimeMs: { type: Number, default: 0 },

}, { timestamps: true });

callAnalysisSchema.index({ userId: 1, createdAt: -1 });
callAnalysisSchema.index({ sentiment: 1 });

callAnalysisSchema.methods.toPublicJSON = function() {
  return {
    id: this._id,
    callId: this.callId,
    summary: this.summary,
    sentiment: this.sentiment,
    sentimentScore: this.sentimentScore,
    intent: this.intent,
    topics: this.topics,
    performance: this.performance,
    goalAchieved: this.goalAchieved,
    followUpRequired: this.followUpRequired,
    followUpNotes: this.followUpNotes,
    status: this.status,
    processingTimeMs: this.processingTimeMs,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('CallAnalysis', callAnalysisSchema);
