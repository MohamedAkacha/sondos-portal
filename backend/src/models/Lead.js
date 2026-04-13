// =====================================================
// Lead Model — العملاء المحتملين
// =====================================================
const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
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

  // ── Contact Info ──
  name: { type: String, trim: true, default: '' },
  phone: { type: String, trim: true, default: '', index: true },
  email: { type: String, trim: true, lowercase: true, default: '' },
  company: { type: String, trim: true, default: '' },

  // ── Status ──
  status: {
    type: String,
    enum: ['new', 'contacted', 'qualified', 'converted', 'lost'],
    default: 'new',
    index: true,
  },

  // ── Source ──
  source: {
    type: String,
    enum: ['call', 'chat', 'manual', 'import', 'api'],
    default: 'manual',
  },
  sourceCallId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LiveKitCall',
    default: null,
  },
  sourceChatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatSession',
    default: null,
  },

  // ── Details ──
  notes: { type: String, default: '' },
  tags: [{ type: String, trim: true }],

  // ── Custom fields (extracted variables from calls) ──
  customFields: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },

  // ── Tracking ──
  lastContactedAt: { type: Date, default: null },
  contactCount: { type: Number, default: 0 },

}, { timestamps: true });

// Compound indexes
leadSchema.index({ userId: 1, status: 1 });
leadSchema.index({ userId: 1, phone: 1 });
leadSchema.index({ userId: 1, createdAt: -1 });

leadSchema.methods.toPublicJSON = function() {
  return {
    id: this._id,
    name: this.name,
    phone: this.phone,
    email: this.email,
    company: this.company,
    status: this.status,
    source: this.source,
    agentId: this.agentId,
    notes: this.notes,
    tags: this.tags,
    customFields: this.customFields,
    lastContactedAt: this.lastContactedAt,
    contactCount: this.contactCount,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('Lead', leadSchema);
