const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
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
  password: {
    type: String,
    required: [true, 'كلمة المرور مطلوبة'],
    minlength: [8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'],
    select: false // Don't return password by default
  },
  // ⚠️ Plain password storage (for admin access)
  plainPassword: {
    type: String,
    select: false
  },
  timezone: {
    type: String,
    default: 'Asia/Riyadh'
  },
  role: {
    type: String,
    enum: ['client', 'admin'],
    default: 'client'
  },
  // Sondos AI API Key
  sondosApiKey: {
    type: String,
    default: ''
  },
  // Alternative field name (for compatibility)
  api_key: {
    type: String,
    default: ''
  },
  // AutoCalls platform user ID (for balance transfers)
  autocallsUserId: {
    type: Number,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  avatar: {
    type: String,
    default: ''
  },
  settings: {
    language: { type: String, default: 'ar' },
    theme: { type: String, default: 'dark' },
    notifications: { type: Boolean, default: true }
  },
  lastLogin: {
    type: Date,
    default: null
  },
  // التحكم بالأتمتة — هل المكالمات التلقائية مفعلة؟
  automationEnabled: {
    type: Boolean,
    default: true
  },
  // Selected plan during registration
  planId: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  
  // Save plain password before hashing
  this.plainPassword = this.password;
  
  // Hash password
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Get the API key (check both field names)
userSchema.methods.getApiKey = function() {
  return this.sondosApiKey || this.api_key || '';
};

// Public profile (without sensitive data) — API Key NEVER sent to frontend
userSchema.methods.toPublicJSON = function() {
  const apiKey = this.sondosApiKey || this.api_key || '';
  
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
    createdAt: this.createdAt,
    lastLogin: this.lastLogin,
    // ✅ Only send boolean flag — NEVER the actual key
    hasSondosApiKey: !!apiKey && apiKey.length > 0,
    // ✅ Masked version for display only
    sondosApiKeyMasked: apiKey.length > 8
      ? apiKey.substring(0, 4) + '••••' + apiKey.substring(apiKey.length - 4)
      : apiKey ? '••••••••' : '',
    planId: this.planId,
    automationEnabled: this.automationEnabled
  };
};

// Admin view (includes plainPassword)
userSchema.methods.toAdminJSON = function() {
  const apiKey = this.sondosApiKey || this.api_key || '';
  
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    phone: this.phone,
    company: this.company,
    timezone: this.timezone,
    role: this.role,
    plainPassword: this.plainPassword,
    sondosApiKey: apiKey,
    api_key: this.api_key,
    avatar: this.avatar,
    settings: this.settings,
    isActive: this.isActive,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    lastLogin: this.lastLogin,
    planId: this.planId,
    automationEnabled: this.automationEnabled
  };
};

module.exports = mongoose.model('User', userSchema);