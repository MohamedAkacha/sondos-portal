// =====================================================
// Voice Model — Cloned & Custom Voices
// =====================================================
const mongoose = require('mongoose');

const voiceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  // ── Voice Identity ──
  name: {
    type: String,
    required: [true, 'اسم الصوت مطلوب'],
    trim: true,
    maxlength: 100,
  },
  description: { type: String, default: '', maxlength: 300 },

  // ── Provider ──
  provider: {
    type: String,
    enum: ['openai', 'elevenlabs'],
    default: 'elevenlabs',
  },
  providerVoiceId: {
    type: String,
    required: true,
  },

  // ── Type ──
  type: {
    type: String,
    enum: ['preset', 'cloned'],
    default: 'preset',
  },

  // ── Clone info (for type: cloned) ──
  cloneStatus: {
    type: String,
    enum: ['pending', 'processing', 'ready', 'failed'],
    default: null,
  },
  cloneFileS3Key: { type: String, default: '' },
  cloneFileName: { type: String, default: '' },

  // ── Metadata ──
  language: { type: String, default: 'ar' },
  gender: { type: String, enum: ['male', 'female', 'neutral', ''], default: '' },
  accent: { type: String, default: '' },
  previewUrl: { type: String, default: '' },

  // ── Usage ──
  usageCount: { type: Number, default: 0 },
  lastUsedAt: { type: Date, default: null },

  isActive: { type: Boolean, default: true },

}, { timestamps: true });

voiceSchema.index({ userId: 1, provider: 1 });

voiceSchema.methods.toPublicJSON = function() {
  return {
    id: this._id,
    name: this.name,
    description: this.description,
    provider: this.provider,
    providerVoiceId: this.providerVoiceId,
    type: this.type,
    cloneStatus: this.cloneStatus,
    cloneFileName: this.cloneFileName,
    language: this.language,
    gender: this.gender,
    accent: this.accent,
    previewUrl: this.previewUrl,
    usageCount: this.usageCount,
    lastUsedAt: this.lastUsedAt,
    isActive: this.isActive,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('Voice', voiceSchema);
