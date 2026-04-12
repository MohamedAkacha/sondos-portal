const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // ── الهوية ──
  name: {
    type: String,
    required: [true, 'الاسم مطلوب'],
    trim: true,
    maxlength: [100, 'الاسم يجب أن يكون أقل من 100 حرف']
  },
  email: {
    type: String,
    required: [true, 'البريد الإلكتروني مطلوب'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'البريد الإلكتروني غير صالح']
  },
  phone: {
    type: String,
    required: [true, 'رقم الجوال مطلوب'],
    trim: true
  },
  company: {
    type: String,
    trim: true,
    default: ''
  },
  timezone: {
    type: String,
    default: 'Asia/Riyadh'
  },

  // ── المصادقة ──
  password: {
    type: String,
    required: [true, 'كلمة المرور مطلوبة'],
    minlength: [8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'],
    select: false
  },
  role: {
    type: String,
    enum: ['client', 'admin', 'super_admin'],
    default: 'client'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationToken: {
    type: String,
    select: false
  },
  resetPasswordToken: {
    type: String,
    select: false
  },
  resetPasswordExpires: {
    type: Date,
    select: false
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: {
    type: String,
    select: false
  },
  tokenVersion: {
    type: Number,
    default: 0
  },

  // ── الملف الشخصي ──
  avatar: {
    type: String,
    default: ''
  },
  settings: {
    language: { type: String, enum: ['ar', 'en', 'fr'], default: 'ar' },
    theme: { type: String, enum: ['dark', 'light', 'system'], default: 'dark' },
    notifications: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      inApp: { type: Boolean, default: true },
      webhook: { type: Boolean, default: false },
    },
  },

  // ── الاشتراك ──
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan',
    default: null
  },

  // ── الاستخدام الشهري ──
  usage: {
    currentPeriodStart: { type: Date, default: Date.now },
    callMinutes: { type: Number, default: 0 },
    chatMessages: { type: Number, default: 0 },
    documentsProcessed: { type: Number, default: 0 },
    apiCalls: { type: Number, default: 0 },
    creditsUsed: { type: Number, default: 0 },
  },

  // ── التتبع ──
  lastLogin: {
    type: Date,
    default: null
  },
  loginCount: {
    type: Number,
    default: 0
  },

  // ── Automation ──
  automationEnabled: {
    type: Boolean,
    default: true
  },
}, { timestamps: true });

// ── Hash password before saving ──
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ── Compare password ──
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// ── Public profile (API responses) ──
userSchema.methods.toPublicJSON = function() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    phone: this.phone,
    company: this.company,
    timezone: this.timezone,
    role: this.role,
    avatar: this.avatar,
    settings: this.settings,
    isActive: this.isActive,
    isVerified: this.isVerified,
    planId: this.planId,
    usage: this.usage,
    lastLogin: this.lastLogin,
    loginCount: this.loginCount,
    automationEnabled: this.automationEnabled,
    createdAt: this.createdAt,
  };
};

// ── Admin view (no sensitive data — just extra fields) ──
userSchema.methods.toAdminJSON = function() {
  return {
    ...this.toPublicJSON(),
    updatedAt: this.updatedAt,
    twoFactorEnabled: this.twoFactorEnabled,
    tokenVersion: this.tokenVersion,
  };
};

module.exports = mongoose.model('User', userSchema);