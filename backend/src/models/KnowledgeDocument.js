// =====================================================
// KnowledgeDocument Model — مستند داخل قاعدة المعرفة
// =====================================================
const mongoose = require('mongoose');

const knowledgeDocumentSchema = new mongoose.Schema({
  knowledgeBaseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'KnowledgeBase',
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  // ── Source type ──
  sourceType: {
    type: String,
    enum: ['file', 'url', 'faq', 'text'],
    required: true,
  },

  // ── File info (for sourceType: file) ──
  fileName: { type: String, default: '' },
  fileSize: { type: Number, default: 0 },
  fileMimeType: { type: String, default: '' },
  fileS3Key: { type: String, default: '' },

  // ── URL info (for sourceType: url) ──
  sourceUrl: { type: String, default: '' },

  // ── FAQ info (for sourceType: faq) ──
  faqQuestion: { type: String, default: '' },
  faqAnswer: { type: String, default: '' },

  // ── Text info (for sourceType: text) ──
  rawText: { type: String, default: '' },

  // ── Processing ──
  status: {
    type: String,
    enum: ['pending', 'processing', 'ready', 'failed'],
    default: 'pending',
    index: true,
  },
  errorMessage: { type: String, default: '' },

  // ── Chunk stats ──
  totalChunks: { type: Number, default: 0 },
  totalTokens: { type: Number, default: 0 },

  // ── Qdrant point IDs for deletion ──
  qdrantPointIds: [String],

}, { timestamps: true });

knowledgeDocumentSchema.methods.toPublicJSON = function() {
  return {
    id: this._id,
    knowledgeBaseId: this.knowledgeBaseId,
    sourceType: this.sourceType,
    fileName: this.fileName,
    fileSize: this.fileSize,
    sourceUrl: this.sourceUrl,
    faqQuestion: this.faqQuestion,
    faqAnswer: this.faqAnswer,
    status: this.status,
    errorMessage: this.errorMessage,
    totalChunks: this.totalChunks,
    totalTokens: this.totalTokens,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('KnowledgeDocument', knowledgeDocumentSchema);
