// =====================================================
// Plan Model — الباقات والاشتراكات
// =====================================================
const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'اسم الباقة مطلوب'],
    trim: true
  },
  planCode: {
    type: String,
    unique: true,
    trim: true
  },
  nameEn: {
    type: String,
    trim: true,
    default: ''
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  descriptionEn: {
    type: String,
    default: ''
  },
  // السعر بالهللات (مُيسّر يتعامل بأصغر وحدة عملة)
  // 500 ريال = 50000 هللة
  priceHalala: {
    type: Number,
    required: [true, 'السعر مطلوب'],
    min: [100, 'أقل سعر 1 ريال']
  },
  // السعر بالريال (للعرض)
  priceDisplay: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'SAR'
  },
  period: {
    type: String,
    enum: ['monthly', 'quarterly', 'yearly', 'one_time'],
    default: 'monthly'
  },
  // مميزات الباقة
  features: [{
    label: String,
    labelEn: String,
    value: String,
    valueEn: String
  }],
  // حدود الباقة
  limits: {
    maxCalls: { type: Number, default: -1 },           // -1 = غير محدود
    maxCallDuration: { type: Number, default: 300 },   // بالثواني
    maxVoices: { type: Number, default: 2 },
    maxAssistants: { type: Number, default: 1 },       // عدد المساعدين
    maxPhoneNumbers: { type: Number, default: 0 },     // عدد أرقام الهاتف
    maxMonthlyMinutes: { type: Number, default: 100 }, // دقائق المكالمات الشهرية
    maxClonedVoices: { type: Number, default: 1 },     // عدد الأصوات المستنسخة
  },
  // الترتيب والعرض
  sortOrder: {
    type: Number,
    default: 0
  },
  color: {
    type: String,
    default: 'teal'
  },
  icon: {
    type: String,
    enum: ['zap', 'star', 'crown', 'rocket'],
    default: 'zap'
  },
  isPopular: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // الأتمتة المتاحة في هذه الباقة
  // تُنسخ كـ FlowConfig لكل عميل جديد عند التسجيل
  automations: [{
    name: { type: String, required: true },       // اسم الأتمتة بالعربي
    key: { type: String, required: true },         // معرّف فريد مختصر
    description: { type: String, default: '' },    // وصف مختصر
  }]
}, {
  timestamps: true
});

// Auto-generate slug from name
planSchema.pre('save', function(next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name
      .replace(/\s+/g, '-')
      .replace(/[^\w\u0600-\u06FF-]/g, '')
      .toLowerCase();
  }
  // Sync priceDisplay with priceHalala
  if (this.isModified('priceHalala')) {
    this.priceDisplay = this.priceHalala / 100;
  }
  next();
});

module.exports = mongoose.model('Plan', planSchema);