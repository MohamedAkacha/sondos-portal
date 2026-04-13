// =====================================================
// WebhookEndpoint Model — نقاط الويب هوك
// =====================================================
const mongoose = require('mongoose');

const webhookLogSchema = new mongoose.Schema({
  event: String,
  statusCode: Number,
  success: Boolean,
  responseTime: Number,
  error: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now },
}, { _id: false });

const webhookEndpointSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  url: { type: String, required: true },
  secret: { type: String, default: '' },

  // Which events to send
  events: [{
    type: String,
    enum: ['call.completed', 'chat.ended', 'lead.created', 'extraction.completed', 'campaign.completed', 'handoff.created'],
  }],

  // Headers
  headers: [{ key: String, value: String }],

  isActive: { type: Boolean, default: true },

  // Delivery stats
  totalDeliveries: { type: Number, default: 0 },
  successCount: { type: Number, default: 0 },
  failureCount: { type: Number, default: 0 },
  lastDeliveredAt: { type: Date, default: null },

  // Recent logs (keep last 20)
  recentLogs: [webhookLogSchema],

}, { timestamps: true });

webhookEndpointSchema.methods.toPublicJSON = function() {
  return {
    id: this._id,
    name: this.name,
    url: this.url,
    events: this.events,
    isActive: this.isActive,
    totalDeliveries: this.totalDeliveries,
    successCount: this.successCount,
    failureCount: this.failureCount,
    lastDeliveredAt: this.lastDeliveredAt,
    recentLogs: this.recentLogs?.slice(-10),
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('WebhookEndpoint', webhookEndpointSchema);
