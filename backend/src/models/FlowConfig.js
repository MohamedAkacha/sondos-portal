// =====================================================
// FlowConfig Model — التحكم بكل أتمتة على حدة
// ─────────────────────────────────────────────────────
// كل سجل يمثل فلو (أتمتة) خاص بمستخدم معين
// العميل يقدر يفعّل/يوقف كل أتمتة بشكل منفصل
// الأنظمة الخارجية تتحقق عبر Public API
// =====================================================
const mongoose = require('mongoose');

const flowConfigSchema = new mongoose.Schema({
  // المستخدم (صاحب الأتمتة)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  // اسم الأتمتة (للعرض)
  flowName: {
    type: String,
    required: [true, 'اسم الأتمتة مطلوب'],
    trim: true,
  },

  // معرّف فريد مختصر — يُستخدم في الـ API
  // مثال: welcome_smart, booking_auto, telesales, upselling
  flowKey: {
    type: String,
    required: [true, 'معرّف الأتمتة مطلوب'],
    trim: true,
    lowercase: true,
  },

  // وصف مختصر للأتمتة
  description: {
    type: String,
    default: '',
    trim: true,
  },

  // هل الأتمتة مفعّلة؟
  isEnabled: {
    type: Boolean,
    default: true,
  },

  // كود الباقة اللي جات منها هالأتمتة
  planCode: {
    type: String,
    default: '',
    trim: true,
  },
}, {
  timestamps: true,
});

// ── Indexes ──
// كل مستخدم + flowKey لازم يكون فريد
flowConfigSchema.index({ userId: 1, flowKey: 1 }, { unique: true });
flowConfigSchema.index({ userId: 1, isEnabled: 1 });

// ── Public JSON ──
flowConfigSchema.methods.toPublicJSON = function () {
  return {
    id: this._id,
    flowName: this.flowName,
    flowKey: this.flowKey,
    description: this.description,
    isEnabled: this.isEnabled,
    planCode: this.planCode,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('FlowConfig', flowConfigSchema);
