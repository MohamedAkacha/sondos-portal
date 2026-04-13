// =====================================================
// ApiKey Model — مفاتيح API للوصول العام
// =====================================================
const mongoose = require('mongoose');
const crypto = require('crypto');

const apiKeySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  key: { type: String, required: true, unique: true, index: true },
  keyPrefix: { type: String, default: '' },
  keyHash: { type: String, required: true },

  permissions: [{
    type: String,
    enum: ['agents:read', 'agents:write', 'calls:read', 'chat:write', 'leads:read', 'leads:write', 'knowledge:read', 'campaigns:read', 'campaigns:write'],
  }],

  isActive: { type: Boolean, default: true },
  lastUsedAt: { type: Date, default: null },
  usageCount: { type: Number, default: 0 },
  expiresAt: { type: Date, default: null },

  // Rate limiting
  rateLimit: { type: Number, default: 100 }, // requests per minute

}, { timestamps: true });

// Generate a new API key
apiKeySchema.statics.generateKey = function() {
  const key = `sk_${crypto.randomBytes(32).toString('hex')}`;
  const keyHash = crypto.createHash('sha256').update(key).digest('hex');
  const keyPrefix = key.substring(0, 7) + '...' + key.substring(key.length - 4);
  return { key, keyHash, keyPrefix };
};

// Find by raw key
apiKeySchema.statics.findByKey = async function(rawKey) {
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  return this.findOne({ keyHash, isActive: true });
};

apiKeySchema.methods.toPublicJSON = function() {
  return {
    id: this._id,
    name: this.name,
    keyPrefix: this.keyPrefix,
    permissions: this.permissions,
    isActive: this.isActive,
    lastUsedAt: this.lastUsedAt,
    usageCount: this.usageCount,
    expiresAt: this.expiresAt,
    rateLimit: this.rateLimit,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('ApiKey', apiKeySchema);
