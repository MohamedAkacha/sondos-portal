// =====================================================
// PhoneNumber Model — أرقام الهاتف المربوطة
// ─────────────────────────────────────────────────────
// Each phone number is linked to one Agent
// Supports: Twilio, Telnyx, or custom SIP trunk
// Flow: Incoming call → SIP Trunk → LiveKit Room → Agent
// =====================================================
const mongoose = require('mongoose');
const crypto = require('crypto');

// ── SIP Password Encryption ──
const SIP_ENCRYPT_ALGO = 'aes-256-cbc';
const SIP_ENCRYPT_KEY = crypto.createHash('sha256')
  .update(process.env.SIP_ENCRYPT_SECRET || process.env.JWT_SECRET || 'sondos-default-key')
  .digest();
const SIP_IV_LENGTH = 16;

function encryptPassword(plaintext) {
  if (!plaintext) return '';
  const iv = crypto.randomBytes(SIP_IV_LENGTH);
  const cipher = crypto.createCipheriv(SIP_ENCRYPT_ALGO, SIP_ENCRYPT_KEY, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decryptPassword(ciphertext) {
  if (!ciphertext || !ciphertext.includes(':')) return '';
  try {
    const [ivHex, encrypted] = ciphertext.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(SIP_ENCRYPT_ALGO, SIP_ENCRYPT_KEY, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    console.error('[SIP Decrypt] Failed:', e.message);
    return '';
  }
}

const phoneNumberSchema = new mongoose.Schema({
  // ── Owner ──
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  // ── Linked Agent ──
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent',
    default: null,
    index: true,
  },

  // ── Phone Number ──
  phoneNumber: {
    type: String,
    required: [true, 'رقم الهاتف مطلوب'],
    trim: true,
    index: true,
  },
  friendlyName: {
    type: String,
    trim: true,
    default: '',
  },
  country: {
    type: String,
    default: 'SA',
    uppercase: true,
  },

  // ── Provider ──
  provider: {
    type: String,
    enum: ['twilio', 'telnyx', 'custom'],
    required: true,
    default: 'twilio',
  },

  // ── Provider-specific IDs ──
  providerNumberSid: {
    type: String,
    default: '',
  },

  // ── LiveKit SIP ──
  sipTrunkId: {
    type: String,
    default: '',
  },
  sipOutboundTrunkId: {
    type: String,
    default: '',
  },
  sipDispatchRuleId: {
    type: String,
    default: '',
  },

  // ── Custom SIP Trunk (for provider: 'custom') ──
  // Matches AutoCalls SIP trunk configuration fields
  customSip: {
    // ── Authentication ──
    sipServer: { type: String, default: '' },
    sipPort: { type: Number, default: 5060 },
    sipUsername: { type: String, default: '' },
    sipPassword: { type: String, default: '' },
    sipTransport: { type: String, enum: ['udp', 'tcp', 'tls'], default: 'udp' },

    // ── Outbound Settings ──
    outboundFixedIp: { type: Boolean, default: false },
    outboundNumberFormat: {
      type: String,
      enum: ['international_plus', 'international_no_plus', 'national'],
      default: 'international_no_plus',
    },

    // ── Inbound Settings ──
    inboundAuthType: {
      type: String,
      enum: ['ip', 'username_password'],
      default: 'ip',
    },
    allowedIpAddresses: {
      type: [String],
      default: [],
    },
  },

  // ── LiveKit SIP Inbound URI (auto-filled on SIP setup) ──
  // e.g. "4gz4kilfp9u.sip.livekit.cloud"
  sipInboundUri: {
    type: String,
    default: '',
  },

  // ── Status ──
  status: {
    type: String,
    enum: ['active', 'inactive', 'pending', 'error'],
    default: 'pending',
    index: true,
  },
  statusMessage: {
    type: String,
    default: '',
  },

  // ── Settings ──
  settings: {
    maxCallDuration: { type: Number, default: 300 },
    recordCalls: { type: Boolean, default: false },
    welcomeMessage: { type: String, default: '' },
    fallbackNumber: { type: String, default: '' },
  },

  // ── Billing ──
  monthlyPrice: {
    type: Number,
    default: 0,
  },
  currency: {
    type: String,
    default: 'USD',
  },

  // ── Stats ──
  stats: {
    totalCalls: { type: Number, default: 0 },
    totalDurationSeconds: { type: Number, default: 0 },
    lastCallAt: { type: Date, default: null },
  },

}, {
  timestamps: true,
});

// ── Indexes ──
phoneNumberSchema.index({ userId: 1, status: 1 });
phoneNumberSchema.index({ phoneNumber: 1 }, { unique: true });
phoneNumberSchema.index({ sipTrunkId: 1 });

// ── Encrypt SIP password before save ──
phoneNumberSchema.pre('save', function (next) {
  if (this.isModified('customSip.sipPassword') && this.customSip?.sipPassword) {
    // Only encrypt if it's not already encrypted (no colon = plaintext)
    if (!this.customSip.sipPassword.includes(':') || this.customSip.sipPassword.length < 40) {
      this.customSip.sipPassword = encryptPassword(this.customSip.sipPassword);
    }
  }
  next();
});

// ── Decrypt SIP password (for internal use only) ──
phoneNumberSchema.methods.getSipPassword = function () {
  return decryptPassword(this.customSip?.sipPassword || '');
};

// ── Public JSON (never exposes password) ──
phoneNumberSchema.methods.toPublicJSON = function () {
  return {
    id: this._id,
    phoneNumber: this.phoneNumber,
    friendlyName: this.friendlyName,
    country: this.country,
    provider: this.provider,
    agentId: this.agentId,
    status: this.status,
    statusMessage: this.statusMessage,
    sipTrunkId: this.sipTrunkId || '',
    sipDispatchRuleId: this.sipDispatchRuleId || '',
    sipOutboundTrunkId: this.sipOutboundTrunkId || '',
    sipInboundUri: this.sipInboundUri || '',
    customSip: this.provider === 'custom' ? {
      sipServer: this.customSip?.sipServer || '',
      sipPort: this.customSip?.sipPort || 5060,
      sipUsername: this.customSip?.sipUsername || '',
      hasPassword: !!this.customSip?.sipPassword,
      sipTransport: this.customSip?.sipTransport || 'udp',
      outboundFixedIp: this.customSip?.outboundFixedIp || false,
      outboundNumberFormat: this.customSip?.outboundNumberFormat || 'international_no_plus',
      inboundAuthType: this.customSip?.inboundAuthType || 'ip',
      allowedIpAddresses: this.customSip?.allowedIpAddresses || [],
    } : undefined,
    settings: this.settings,
    monthlyPrice: this.monthlyPrice,
    currency: this.currency,
    stats: this.stats,
    createdAt: this.createdAt,
  };
};

// ── Format phone for display ──
phoneNumberSchema.methods.displayNumber = function () {
  const num = this.phoneNumber;
  if (num.startsWith('+966')) {
    return `+966 ${num.slice(4, 6)} ${num.slice(6, 9)} ${num.slice(9)}`;
  }
  return num;
};

module.exports = mongoose.model('PhoneNumber', phoneNumberSchema);