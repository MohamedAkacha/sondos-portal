// =====================================================
// Seed Plans — تهيئة الباقات في قاعدة البيانات
// Usage: node scripts/seedPlans.js
// =====================================================
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Plan = require('../src/models/Plan');

const PLANS = [
  {
    name: 'الباقة البرونزية',
    nameEn: 'Bronze Plan',
    planCode: 'PLN-001',
    slug: 'bronze',
    description: 'مثالية للعيادات الصغيرة والبدايات',
    descriptionEn: 'Perfect for small clinics and startups',
    priceHalala: 50000,  // 500 ر.س
    priceDisplay: 500,
    currency: 'SAR',
    period: 'monthly',
    features: [
      { label: 'عدد المكالمات', labelEn: 'Calls', value: '500 مكالمة', valueEn: '500 calls' },
      { label: 'مدة المكالمة', labelEn: 'Call Duration', value: '5 دقائق', valueEn: '5 minutes' },
      { label: 'عدد الأصوات', labelEn: 'Voices', value: '2 صوت', valueEn: '2 voices' },
      { label: 'الدعم الفني', labelEn: 'Support', value: 'بريد إلكتروني', valueEn: 'Email' },
    ],
    limits: { maxCalls: 500, maxCallDuration: 300, maxVoices: 2, maxAssistants: 1 },
    sortOrder: 1,
    color: 'orange',
    icon: 'zap',
    isPopular: false,
    // PLN-001: 4 assistants + 4 flows (feten_plan)
    automations: [
      { name: 'حملات الإعلانات الطبية', key: 'ads_medical', description: 'اتصال صادر لعرض العروض الطبية الجاهزة' },
      { name: 'Telesales طبي', key: 'telesales_medical', description: 'مكالمات مبيعات لتقديم عروض طبية مباشرة' },
      { name: 'المتابعة الدورية والتجديد', key: 'followup_renewal', description: 'متابعة العملاء السابقين وتجديد الخدمات' },
      { name: 'زيادة الخدمات (Upselling)', key: 'upselling', description: 'اقتراح خدمات إضافية للعملاء الحاليين' },
    ],
  },
  {
    name: 'الباقة الفضية',
    nameEn: 'Silver Plan',
    planCode: 'PLN-002',
    slug: 'silver',
    description: 'للمجمعات الطبية المتوسطة',
    descriptionEn: 'For mid-size medical complexes',
    priceHalala: 100000,  // 1000 ر.س
    priceDisplay: 1000,
    currency: 'SAR',
    period: 'monthly',
    features: [
      { label: 'عدد المكالمات', labelEn: 'Calls', value: '1500 مكالمة', valueEn: '1500 calls' },
      { label: 'مدة المكالمة', labelEn: 'Call Duration', value: '10 دقائق', valueEn: '10 minutes' },
      { label: 'عدد الأصوات', labelEn: 'Voices', value: '4 أصوات', valueEn: '4 voices' },
      { label: 'الدعم الفني', labelEn: 'Support', value: 'واتساب + بريد', valueEn: 'WhatsApp + Email' },
    ],
    limits: { maxCalls: 1500, maxCallDuration: 600, maxVoices: 4, maxAssistants: 2 },
    sortOrder: 2,
    color: 'gray',
    icon: 'star',
    isPopular: false,
    // PLN-002: 6 assistants + 5 flows (ameni_plan)
    automations: [
      { name: 'سيناريو الترحيب الذكي', key: 'smart_welcome', description: 'ترحيب تلقائي ذكي بالمتصلين وتوجيههم' },
      { name: 'سيناريو الحجز التلقائي', key: 'auto_booking', description: 'حجز مواعيد تلقائي للعملاء' },
      { name: 'سيناريو الحجز المتسلسل', key: 'sequential_booking', description: 'حجز مواعيد متسلسل متعدد الخطوات' },
      { name: 'سيناريو التحويل الذكي', key: 'smart_transfer', description: 'تحويل المكالمات للقسم المناسب تلقائياً' },
      { name: 'سيناريو خارج الدوام / عدم الرد', key: 'after_hours', description: 'التعامل مع المكالمات خارج أوقات العمل' },
      { name: 'متابعات ما بعد الزيارة', key: 'post_visit_followup', description: 'متابعة المرضى بعد زيارتهم للعيادة' },
    ],
  },
  {
    name: 'الباقة الذهبية',
    nameEn: 'Gold Plan',
    planCode: 'PLN-003',
    slug: 'gold',
    description: 'للمستشفيات والمراكز الكبيرة',
    descriptionEn: 'For hospitals and large centers',
    priceHalala: 200000,  // 2000 ر.س
    priceDisplay: 2000,
    currency: 'SAR',
    period: 'monthly',
    features: [
      { label: 'عدد المكالمات', labelEn: 'Calls', value: 'غير محدود', valueEn: 'Unlimited' },
      { label: 'مدة المكالمة', labelEn: 'Call Duration', value: '15 دقيقة', valueEn: '15 minutes' },
      { label: 'عدد الأصوات', labelEn: 'Voices', value: '8 أصوات', valueEn: '8 voices' },
      { label: 'الدعم الفني', labelEn: 'Support', value: 'أولوية 24/7', valueEn: 'Priority 24/7' },
    ],
    limits: { maxCalls: -1, maxCallDuration: 900, maxVoices: 8, maxAssistants: 5 },
    sortOrder: 3,
    color: 'yellow',
    icon: 'crown',
    isPopular: true,
    // PLN-003: 1 assistant + 2 flows
    automations: [
      { name: 'مساعد حجز المواعيد', key: 'appointment_assistant', description: 'مساعد ذكي لحجز وتأكيد المواعيد الطبية' },
      { name: 'أتمتة واتساب', key: 'whatsapp_flow', description: 'متابعة تلقائية عبر واتساب' },
    ],
  },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_DB_URI);
    console.log('✅ Connected to MongoDB');

    // حذف الباقات القديمة
    await Plan.deleteMany({});
    console.log('🗑️  Cleared existing plans');

    // إنشاء الباقات الجديدة
    const created = await Plan.insertMany(PLANS);
    console.log(`✅ Seeded ${created.length} plans:`);
    created.forEach(p => {
      const autoCount = p.automations ? p.automations.length : 0;
      console.log(`   - ${p.name} (${p.priceDisplay} ر.س) → ${autoCount} أتمتة`);
    });

    await mongoose.disconnect();
    console.log('👋 Done');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    process.exit(1);
  }
}

seed();