// =====================================================
// LiveKitCall Model — سجلات مكالمات LiveKit
// ─────────────────────────────────────────────────────
// Stores call records from LiveKit Webhook events
// Separate from AutoCalls — parallel test system
// =====================================================
const mongoose = require('mongoose');

const transcriptEntrySchema = new mongoose.Schema({
  speaker: {
    type: String,
    enum: ['agent', 'user', 'system'],
    required: true,
  },
  text: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
}, { _id: false });

const participantSchema = new mongoose.Schema({
  identity: { type: String, required: true },
  name: { type: String, default: '' },
  joinedAt: { type: Date, default: null },
  leftAt: { type: Date, default: null },
  isAgent: { type: Boolean, default: false },
}, { _id: false });

const livekitCallSchema = new mongoose.Schema({
  // ── Room Info ──
  roomName: {
    type: String,
    required: true,
    index: true,
  },
  roomSid: {
    type: String,
    default: '',
    index: true,
  },

  // ── User Reference ──
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  },

  // ── Agent Reference ──
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent',
    default: null,
    index: true,
  },

  // ── Call Status ──
  status: {
    type: String,
    enum: ['created', 'active', 'completed', 'failed', 'timeout'],
    default: 'created',
    index: true,
  },

  // ── Timing ──
  startedAt: {
    type: Date,
    default: null,
  },
  endedAt: {
    type: Date,
    default: null,
  },
  durationSeconds: {
    type: Number,
    default: 0,
  },

  // ── Participants ──
  participants: [participantSchema],

  agentJoined: {
    type: Boolean,
    default: false,
  },

  // ── Transcript ──
  transcript: [transcriptEntrySchema],

  // ── Agent Config (snapshot at call time) ──
  agentConfig: {
    sttProvider:    { type: String },
    sttModel:       { type: String },
    sttLanguage:    { type: String },
    llmModel:       { type: String },
    llmTemperature: { type: Number },
    ttsProvider:    { type: String },
    ttsModel:       { type: String },
    ttsVoice:       { type: String },
    systemPrompt:   { type: String },
    greeting:       { type: String },
  },

  // ── Call Source ──
  source: {
    type: String,
    enum: ['web', 'sip', 'api'],
    default: 'web',
  },

  // ── Metadata ──
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },

}, {
  timestamps: true,
});

// ── Indexes ──
livekitCallSchema.index({ userId: 1, createdAt: -1 });
livekitCallSchema.index({ status: 1, createdAt: -1 });
livekitCallSchema.index({ agentId: 1, createdAt: -1 });

// ── Virtual: formatted duration ──
livekitCallSchema.virtual('formattedDuration').get(function () {
  const secs = this.durationSeconds || 0;
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
});

// ── Ensure virtuals are included in JSON ──
livekitCallSchema.set('toJSON', { virtuals: true });
livekitCallSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('LiveKitCall', livekitCallSchema);
