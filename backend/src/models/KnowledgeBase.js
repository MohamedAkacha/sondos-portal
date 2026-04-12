// =====================================================
// KnowledgeBase Model — مجموعة مستندات مرتبطة بمساعد
// =====================================================
const mongoose = require('mongoose');

const knowledgeBaseSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  // Which agents use this KB (empty = available to all)
  agentIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent',
  }],

  name: {
    type: String,
    required: [true, 'اسم قاعدة المعرفة مطلوب'],
    trim: true,
    maxlength: 100,
  },
  description: {
    type: String,
    trim: true,
    default: '',
    maxlength: 500,
  },

  // ── Stats ──
  totalDocuments: { type: Number, default: 0 },
  totalChunks: { type: Number, default: 0 },
  totalTokens: { type: Number, default: 0 },

  // ── Qdrant collection name ──
  qdrantCollection: {
    type: String,
    default: '',
  },

  isActive: { type: Boolean, default: true },

}, { timestamps: true });

knowledgeBaseSchema.methods.toPublicJSON = function() {
  return {
    id: this._id,
    name: this.name,
    description: this.description,
    agentIds: this.agentIds,
    totalDocuments: this.totalDocuments,
    totalChunks: this.totalChunks,
    totalTokens: this.totalTokens,
    isActive: this.isActive,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('KnowledgeBase', knowledgeBaseSchema);
