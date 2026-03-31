// =====================================================
// Create Agent Page — معالج إنشاء مساعد جديد
// ─────────────────────────────────────────────────────
// 6-step wizard: القالب ← نوع المكالمات ← الشخصية ← الصوت ← رقم الهاتف ← المراجعة
// =====================================================
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bot, ArrowRight, ArrowLeft, Loader2, AlertCircle, CheckCircle,
  Sparkles, Volume2, Check, ChevronLeft, PhoneIncoming, PhoneOutgoing, Phone, Plus, Globe, Wifi,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { createAgent, getAgentTemplates } from "@/services/api/agentAPI";
import { phoneAPI } from "@/services/api/phoneAPI";

// ── Constants ──
const ROLES = [
  { value: 'receptionist', label: 'موظف استقبال', icon: '📞' },
  { value: 'sales',        label: 'مبيعات',       icon: '💰' },
  { value: 'support',      label: 'دعم فني',      icon: '🔧' },
  { value: 'collections',  label: 'تحصيل',        icon: '📋' },
  { value: 'booking',      label: 'حجوزات',       icon: '📅' },
  { value: 'medical',      label: 'استقبال عيادة', icon: '🏥' },
  { value: 'custom',       label: 'مخصص',         icon: '⚙️' },
];

const SPEAKING_STYLES = [
  { value: 'formal',       label: 'رسمي',  desc: 'لغة فصحى واحترافية' },
  { value: 'friendly',     label: 'ودود',  desc: 'قريب من العميل ومريح' },
  { value: 'professional', label: 'مهني',  desc: 'متوازن بين الرسمية والودّية' },
];

const LANGUAGES = [
  { value: 'ar',   label: 'العربية',         icon: '🇸🇦' },
  { value: 'en',   label: 'English',          icon: '🇺🇸' },
  { value: 'both', label: 'عربي + إنجليزي',  icon: '🌐' },
];

const OPENAI_VOICES = [
  { id: 'nova',    name: 'Nova',    gender: 'أنثى', desc: 'دافئ ومهني' },
  { id: 'alloy',   name: 'Alloy',   gender: 'محايد', desc: 'متوازن ومحايد' },
  { id: 'echo',    name: 'Echo',    gender: 'ذكر',  desc: 'واضح ومهني' },
  { id: 'fable',   name: 'Fable',   gender: 'ذكر',  desc: 'دافئ وهادئ' },
  { id: 'onyx',    name: 'Onyx',    gender: 'ذكر',  desc: 'عميق وقوي' },
  { id: 'shimmer', name: 'Shimmer', gender: 'أنثى', desc: 'حيوي ونشيط' },
];

const STEPS = [
  { key: 'template',    label: 'القالب',          num: 1 },
  { key: 'callType',    label: 'نوع المكالمات',  num: 2 },
  { key: 'personality', label: 'الشخصية',        num: 3 },
  { key: 'voice',       label: 'الصوت',          num: 4 },
  { key: 'phone',       label: 'رقم الهاتف',    num: 5 },
  { key: 'review',      label: 'المراجعة',       num: 6 },
];

// ══════════════════════════════════════════════════════
// Step Indicator
// ══════════════════════════════════════════════════════
function StepIndicator({ currentStep, isDark }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((step, i) => {
        const isActive = step.key === currentStep;
        const isPast = STEPS.findIndex(s => s.key === currentStep) > i;
        return (
          <div key={step.key} className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              isActive
                ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30'
                : isPast
                ? isDark ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                : isDark ? 'bg-[#111113] text-gray-600 border border-[#1f1f23]' : 'bg-gray-50 text-gray-400 border border-gray-200'
            }`}>
              {isPast ? <Check className="w-3 h-3" /> : <span>{step.num}</span>}
              <span className="hidden sm:inline">{step.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-8 h-px ${isPast ? 'bg-emerald-500/30' : isDark ? 'bg-[#1f1f23]' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// Step: Call Type Selection
// ══════════════════════════════════════════════════════
const CALL_DIRECTIONS = [
  {
    value: 'inbound',
    label: 'مكالمات واردة',
    desc: 'العملاء يتصلون بك — المساعد يستقبل ويرد على الأسئلة',
    icon: PhoneIncoming,
    color: 'emerald',
    examples: 'استقبال، دعم فني، حجوزات، استفسارات',
  },
  {
    value: 'outbound',
    label: 'مكالمات صادرة',
    desc: 'المساعد يتصل بالعملاء نيابة عنك بهدف محدد',
    icon: PhoneOutgoing,
    color: 'teal',
    examples: 'مبيعات، تحصيل، تأكيد مواعيد، استبيانات',
  },
  {
    value: 'both',
    label: 'واردة + صادرة',
    desc: 'المساعد يستقبل المكالمات ويتصل بالعملاء أيضاً',
    icon: Phone,
    color: 'cyan',
    examples: 'خدمة عملاء شاملة، متابعة + استقبال',
  },
];

function CallTypeStep({ agent, setAgent, isDark }) {
  const selected = agent.callDirection || 'inbound';

  return (
    <div>
      <div className="text-center mb-6">
        <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          نوع المكالمات
        </h2>
        <p className={`text-sm mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          كيف سيتعامل المساعد مع المكالمات؟
        </p>
      </div>

      <div className="max-w-lg mx-auto space-y-3">
        {CALL_DIRECTIONS.map(dir => {
          const Icon = dir.icon;
          const isSelected = selected === dir.value;
          const colorMap = {
            emerald: { active: 'border-emerald-500/40 bg-emerald-500/5', icon: 'text-emerald-400', ring: 'ring-emerald-500/20' },
            teal:    { active: 'border-teal-500/40 bg-teal-500/5',    icon: 'text-teal-400',    ring: 'ring-teal-500/20' },
            cyan:    { active: 'border-cyan-500/40 bg-cyan-500/5',    icon: 'text-cyan-400',    ring: 'ring-cyan-500/20' },
          };
          const c = colorMap[dir.color] || colorMap.teal;

          return (
            <button
              key={dir.value}
              onClick={() => setAgent(prev => ({ ...prev, callDirection: dir.value }))}
              className={`w-full p-5 rounded-2xl border text-right transition-all ${
                isSelected
                  ? `${c.active} ring-2 ${c.ring}`
                  : isDark ? 'border-[#1f1f23] hover:border-[#2a2a2e] bg-[#111113]' : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                  isSelected ? c.active : isDark ? 'bg-[#1a1a1d]' : 'bg-gray-50'
                }`}>
                  <Icon className={`w-6 h-6 ${isSelected ? c.icon : isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className={`font-bold text-sm ${isSelected ? (isDark ? 'text-white' : 'text-gray-900') : isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      {dir.label}
                    </p>
                    {isSelected && <Check className={`w-5 h-5 ${c.icon}`} />}
                  </div>
                  <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    {dir.desc}
                  </p>
                  <p className={`text-xs mt-2 ${isDark ? 'text-gray-600' : 'text-gray-300'}`}>
                    مثال: {dir.examples}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Outbound Settings (shown when outbound or both) ── */}
      {(selected === 'outbound' || selected === 'both') && (
        <div className={`max-w-lg mx-auto mt-6 rounded-2xl border p-5 space-y-4 ${isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center gap-2 mb-1">
            <PhoneOutgoing className={`w-4 h-4 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
            <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>إعدادات المكالمات الصادرة</h3>
          </div>

          {/* Objective */}
          <div>
            <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              هدف المكالمة
            </label>
            <input
              type="text"
              placeholder="مثال: تأكيد موعد يوم الخميس، متابعة طلب رقم 1234"
              value={agent.outboundSettings?.objective || ''}
              onChange={e => setAgent(prev => ({ ...prev, outboundSettings: { ...prev.outboundSettings, objective: e.target.value } }))}
              className={`w-full px-4 py-2.5 rounded-xl border text-sm ${isDark ? 'bg-[#0a0a0b] border-[#1f1f23] text-white placeholder:text-gray-600' : 'bg-gray-50 border-gray-200 placeholder:text-gray-400'}`}
            />
            <p className={`text-xs mt-1 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
              الوكيل سيتبع هذا الهدف أثناء المحادثة مع العميل
            </p>
          </div>

          {/* Opening Message */}
          <div>
            <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              رسالة الافتتاح
            </label>
            <textarea
              rows={2}
              placeholder="مثال: مرحباً، أتصل من عيادة الرياض لتأكيد موعدك يوم الخميس الساعة 3"
              value={agent.outboundSettings?.openingMessage || ''}
              onChange={e => setAgent(prev => ({ ...prev, outboundSettings: { ...prev.outboundSettings, openingMessage: e.target.value } }))}
              className={`w-full px-4 py-2.5 rounded-xl border text-sm resize-none ${isDark ? 'bg-[#0a0a0b] border-[#1f1f23] text-white placeholder:text-gray-600' : 'bg-gray-50 border-gray-200 placeholder:text-gray-400'}`}
            />
            <p className={`text-xs mt-1 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
              أول جملة يقولها الوكيل لما العميل يرد — لو فارغ يستخدم الترحيب العادي
            </p>
          </div>

          {/* Retries */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                عدد المحاولات
              </label>
              <select
                value={agent.outboundSettings?.maxRetries ?? 2}
                onChange={e => setAgent(prev => ({ ...prev, outboundSettings: { ...prev.outboundSettings, maxRetries: parseInt(e.target.value) } }))}
                className={`w-full px-3 py-2.5 rounded-xl border text-sm ${isDark ? 'bg-[#0a0a0b] border-[#1f1f23] text-white' : 'bg-gray-50 border-gray-200'}`}
              >
                {[0,1,2,3,5].map(n => (
                  <option key={n} value={n}>{n === 0 ? 'بدون إعادة' : `${n} ${n === 1 ? 'محاولة' : 'محاولات'}`}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                الفترة بين المحاولات
              </label>
              <select
                value={agent.outboundSettings?.retryIntervalMinutes ?? 60}
                onChange={e => setAgent(prev => ({ ...prev, outboundSettings: { ...prev.outboundSettings, retryIntervalMinutes: parseInt(e.target.value) } }))}
                className={`w-full px-3 py-2.5 rounded-xl border text-sm ${isDark ? 'bg-[#0a0a0b] border-[#1f1f23] text-white' : 'bg-gray-50 border-gray-200'}`}
              >
                <option value={15}>١٥ دقيقة</option>
                <option value={30}>٣٠ دقيقة</option>
                <option value={60}>ساعة</option>
                <option value={120}>ساعتين</option>
                <option value={360}>٦ ساعات</option>
                <option value={1440}>يوم كامل</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// Step 1: Template Selection
// ══════════════════════════════════════════════════════
function TemplateStep({ templates, selectedTemplate, onSelect, isDark }) {
  return (
    <div>
      <div className="text-center mb-6">
        <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>اختر قالباً للبدء</h2>
        <p className={`text-sm mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          القوالب الجاهزة تسهّل البداية — تقدر تعدّل كل شيء لاحقاً
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {templates.map(tmpl => (
          <button
            key={tmpl.id}
            onClick={() => onSelect(tmpl)}
            className={`text-right p-4 rounded-2xl border transition-all ${
              selectedTemplate?.id === tmpl.id
                ? 'bg-teal-500/10 border-teal-500/30 shadow-lg shadow-teal-500/5'
                : isDark ? 'bg-[#111113] border-[#1f1f23] hover:border-[#2a2a2e]' : 'bg-white border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-3xl">{tmpl.icon}</span>
              <div className="flex-1">
                <h3 className={`font-bold text-sm ${
                  selectedTemplate?.id === tmpl.id ? 'text-teal-400' : isDark ? 'text-white' : 'text-gray-900'
                }`}>
                  {tmpl.name}
                </h3>
                <p className={`text-xs mt-1 line-clamp-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  {tmpl.description}
                </p>
              </div>
              {selectedTemplate?.id === tmpl.id && (
                <CheckCircle className="w-5 h-5 text-teal-400 flex-shrink-0" />
              )}
            </div>
          </button>
        ))}

        {/* Start from scratch */}
        <button
          onClick={() => onSelect(null)}
          className={`text-right p-4 rounded-2xl border-2 border-dashed transition-all ${
            selectedTemplate === null
              ? 'bg-teal-500/10 border-teal-500/30'
              : isDark ? 'border-[#2a2a2e] hover:border-[#3a3a3e]' : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-start gap-3">
            <span className="text-3xl">✨</span>
            <div>
              <h3 className={`font-bold text-sm ${
                selectedTemplate === null ? 'text-teal-400' : isDark ? 'text-white' : 'text-gray-900'
              }`}>
                ابدأ من الصفر
              </h3>
              <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                أنشئ مساعد مخصص بإعداداتك الخاصة
              </p>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// Step 2: Personality
// ══════════════════════════════════════════════════════
function PersonalityStep({ agent, setAgent, isDark }) {
  const updatePersonality = (key, value) => {
    setAgent(p => ({ ...p, personality: { ...p.personality, [key]: value } }));
  };

  return (
    <div>
      <div className="text-center mb-6">
        <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>شخصية المساعد</h2>
        <p className={`text-sm mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          عرّف المساعد على شركتك وحدد أسلوبه
        </p>
      </div>

      <div className="max-w-lg mx-auto space-y-5">
        {/* Agent Name */}
        <div>
          <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            اسم المساعد <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={agent.name || ''}
            onChange={(e) => setAgent(p => ({ ...p, name: e.target.value }))}
            placeholder="مثال: سارة، مساعد الحجوزات..."
            className={`w-full px-4 py-2.5 rounded-xl border text-sm ${
              isDark ? 'bg-[#0a0a0b] border-[#1f1f23] text-white placeholder:text-gray-600 focus:border-teal-500/50' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-teal-500'
            } focus:outline-none focus:ring-1 focus:ring-teal-500/30`}
          />
        </div>

        {/* Company Name */}
        <div>
          <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            اسم الشركة / المؤسسة
          </label>
          <input
            type="text"
            value={agent.personality?.companyName || ''}
            onChange={(e) => updatePersonality('companyName', e.target.value)}
            placeholder="مثال: شركة الابتكار، عيادة الصحة..."
            className={`w-full px-4 py-2.5 rounded-xl border text-sm ${
              isDark ? 'bg-[#0a0a0b] border-[#1f1f23] text-white placeholder:text-gray-600 focus:border-teal-500/50' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-teal-500'
            } focus:outline-none focus:ring-1 focus:ring-teal-500/30`}
          />
        </div>

        {/* Language */}
        <div>
          <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            اللغة <span className="text-red-400">*</span>
          </label>
          <div className="flex gap-2">
            {LANGUAGES.map(lang => (
              <button
                key={lang.value}
                onClick={() => setAgent(p => ({ ...p, language: lang.value }))}
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all ${
                  agent.language === lang.value
                    ? 'bg-teal-500/10 border-teal-500/30 text-teal-400'
                    : isDark ? 'border-[#1f1f23] text-gray-400 hover:border-[#2a2a2e]' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                <span>{lang.icon}</span>
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        {/* Speaking Style */}
        <div>
          <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            أسلوب الكلام
          </label>
          <div className="space-y-2">
            {SPEAKING_STYLES.map(style => (
              <button
                key={style.value}
                onClick={() => updatePersonality('speakingStyle', style.value)}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-sm transition-all ${
                  agent.personality?.speakingStyle === style.value
                    ? 'bg-teal-500/10 border-teal-500/30'
                    : isDark ? 'border-[#1f1f23] hover:border-[#2a2a2e]' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-right">
                  <span className={`font-medium ${agent.personality?.speakingStyle === style.value ? 'text-teal-400' : isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {style.label}
                  </span>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{style.desc}</p>
                </div>
                {agent.personality?.speakingStyle === style.value && <Check className="w-4 h-4 text-teal-400" />}
              </button>
            ))}
          </div>
        </div>

        {/* Greeting */}
        <div>
          <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            رسالة الترحيب
          </label>
          <textarea
            value={agent.greeting || ''}
            onChange={(e) => setAgent(p => ({ ...p, greeting: e.target.value }))}
            placeholder="أهلاً وسهلاً، كيف أقدر أساعدك؟"
            rows={2}
            className={`w-full px-4 py-2.5 rounded-xl border text-sm resize-none ${
              isDark ? 'bg-[#0a0a0b] border-[#1f1f23] text-white placeholder:text-gray-600 focus:border-teal-500/50' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-teal-500'
            } focus:outline-none focus:ring-1 focus:ring-teal-500/30`}
          />
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// Step 3: Voice
// ══════════════════════════════════════════════════════
function VoiceStep({ agent, setAgent, isDark }) {
  const updateVoice = (key, value) => {
    setAgent(p => ({ ...p, voice: { ...p.voice, [key]: value } }));
  };

  return (
    <div>
      <div className="text-center mb-6">
        <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>صوت المساعد</h2>
        <p className={`text-sm mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          اختر الصوت اللي يناسب شخصية مساعدك
        </p>
      </div>

      <div className="max-w-lg mx-auto space-y-5">
        {/* Provider info */}
        <div className={`p-3 rounded-xl text-center ${isDark ? 'bg-[#111113] border border-[#1f1f23]' : 'bg-gray-50 border border-gray-200'}`}>
          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            🔊 مزوّد الصوت: <strong className={isDark ? 'text-gray-300' : 'text-gray-700'}>OpenAI TTS</strong> — مستقر وسريع
          </p>
        </div>

        {/* Voice Grid */}
        <div className="grid grid-cols-2 gap-3">
          {OPENAI_VOICES.map(v => (
            <button
              key={v.id}
              onClick={() => {
                updateVoice('voiceId', v.id);
                updateVoice('voiceName', `${v.name} (${v.gender})`);
                updateVoice('provider', 'openai');
                updateVoice('model', 'tts-1');
              }}
              className={`p-4 rounded-xl border text-center transition-all ${
                agent.voice?.voiceId === v.id
                  ? 'bg-teal-500/10 border-teal-500/30 shadow-lg shadow-teal-500/5'
                  : isDark ? 'bg-[#111113] border-[#1f1f23] hover:border-[#2a2a2e]' : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-3xl mb-2">
                {v.gender === 'أنثى' ? '👩' : v.gender === 'ذكر' ? '👨' : '🧑'}
              </div>
              <p className={`font-bold text-sm ${agent.voice?.voiceId === v.id ? 'text-teal-400' : isDark ? 'text-white' : 'text-gray-900'}`}>
                {v.name}
              </p>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                {v.gender} — {v.desc}
              </p>
              {agent.voice?.voiceId === v.id && (
                <div className="mt-2">
                  <CheckCircle className="w-5 h-5 text-teal-400 mx-auto" />
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Note about ElevenLabs */}
        <div className={`p-3 rounded-xl text-center ${isDark ? 'bg-[#0a0a0b] border border-[#1f1f23]' : 'bg-gray-50 border border-gray-200'}`}>
          <p className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
            💡 تقدر تغيّر لـ ElevenLabs لاحقاً من إعدادات المساعد (يحتاج باقة مدفوعة)
          </p>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// Step 5: Phone Number
// ══════════════════════════════════════════════════════
function PhoneStep({ selectedPhoneId, setSelectedPhoneId, callDirection, isDark }) {
  const [phones, setPhones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ phoneNumber: '', friendlyName: '', country: 'SA', sipServer: '', sipUsername: '', sipPassword: '' });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await phoneAPI.list();
        // Show only unlinked phones (no agent) or the currently selected one
        const available = (res.phones || []).filter(p => !p.agentId || p.id === selectedPhoneId);
        setPhones(available);
      } catch (e) {
        console.error('Failed to load phones:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedPhoneId]);

  const handleAddCustom = async () => {
    if (!addForm.phoneNumber) return;
    setAdding(true);
    setAddError(null);
    try {
      const res = await phoneAPI.addCustom({
        phoneNumber: addForm.phoneNumber.startsWith('+') ? addForm.phoneNumber : `+${addForm.phoneNumber}`,
        friendlyName: addForm.friendlyName,
        country: addForm.country,
        customSip: {
          sipServer: addForm.sipServer,
          sipUsername: addForm.sipUsername,
          sipPassword: addForm.sipPassword,
        },
      });
      if (res.phone) {
        setPhones(prev => [...prev, res.phone]);
        setSelectedPhoneId(res.phone.id);
        setShowAddForm(false);
        setAddForm({ phoneNumber: '', friendlyName: '', country: 'SA', sipServer: '', sipUsername: '', sipPassword: '' });
      }
    } catch (e) {
      setAddError(e.message || 'فشل إضافة الرقم');
    } finally {
      setAdding(false);
    }
  };

  const needsOutbound = callDirection === 'outbound' || callDirection === 'both';

  return (
    <div>
      <div className="text-center mb-6">
        <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          رقم الهاتف
        </h2>
        <p className={`text-sm mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          اختر رقم هاتف لربطه بالمساعد — أو أضف واحد جديد
        </p>
      </div>

      <div className="max-w-lg mx-auto space-y-3">
        {/* Skip option */}
        <button
          onClick={() => setSelectedPhoneId(null)}
          className={`w-full p-4 rounded-xl border text-right transition-all ${
            selectedPhoneId === null
              ? isDark ? 'border-teal-500/40 bg-teal-500/5 ring-2 ring-teal-500/20' : 'border-teal-400 bg-teal-50 ring-2 ring-teal-200'
              : isDark ? 'border-[#1f1f23] hover:border-[#2a2a2e] bg-[#111113]' : 'border-gray-200 hover:border-gray-300 bg-white'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-[#1a1a1d]' : 'bg-gray-50'}`}>
              ⏭️
            </div>
            <div>
              <p className={`font-bold text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>بدون رقم — أربط لاحقاً</p>
              <p className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>تقدر تربط رقم من صفحة أرقام الهاتف بعد الإنشاء</p>
            </div>
            {selectedPhoneId === null && <Check className="w-5 h-5 text-teal-400 shrink-0" />}
          </div>
        </button>

        {/* Existing phones */}
        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-500" /></div>
        ) : phones.length > 0 ? (
          phones.map(phone => (
            <button
              key={phone.id}
              onClick={() => setSelectedPhoneId(phone.id)}
              className={`w-full p-4 rounded-xl border text-right transition-all ${
                selectedPhoneId === phone.id
                  ? isDark ? 'border-teal-500/40 bg-teal-500/5 ring-2 ring-teal-500/20' : 'border-teal-400 bg-teal-50 ring-2 ring-teal-200'
                  : isDark ? 'border-[#1f1f23] hover:border-[#2a2a2e] bg-[#111113]' : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-[#1a1a1d]' : 'bg-gray-50'}`}>
                  <Phone className={`w-5 h-5 ${selectedPhoneId === phone.id ? 'text-teal-400' : isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                </div>
                <div className="flex-1">
                  <p className={`font-mono font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`} dir="ltr">
                    {phone.phoneNumber}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {phone.friendlyName && <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{phone.friendlyName}</span>}
                    <span className={`text-xs px-1.5 py-0.5 rounded ${isDark ? 'bg-[#1a1a1d] text-gray-600' : 'bg-gray-100 text-gray-400'}`}>
                      {phone.provider === 'custom' ? 'SIP' : phone.provider}
                    </span>
                    {phone.customSip?.sipServer && (
                      <span className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                        <Wifi className="w-3 h-3 inline" /> {phone.customSip.sipServer}
                      </span>
                    )}
                  </div>
                </div>
                {selectedPhoneId === phone.id && <Check className="w-5 h-5 text-teal-400 shrink-0" />}
              </div>
            </button>
          ))
        ) : (
          <p className={`text-center text-sm py-3 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
            لا توجد أرقام متاحة
          </p>
        )}

        {/* Outbound SIP warning */}
        {needsOutbound && selectedPhoneId && (
          <div className={`flex items-start gap-2 p-3 rounded-xl text-xs ${isDark ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-200'}`}>
            <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
            <p className={isDark ? 'text-amber-300' : 'text-amber-700'}>
              المكالمات الصادرة تحتاج بيانات SIP مكتملة (SIP Server + Username + Password). تأكد أن الرقم المختار يحتوي هذه البيانات.
            </p>
          </div>
        )}

        {/* Add new phone */}
        {!showAddForm ? (
          <button
            onClick={() => setShowAddForm(true)}
            className={`w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed text-sm font-medium transition-all ${
              isDark ? 'border-[#2a2a2e] text-gray-500 hover:border-teal-500/30 hover:text-teal-400' : 'border-gray-300 text-gray-400 hover:border-teal-400 hover:text-teal-600'
            }`}
          >
            <Plus className="w-4 h-4" /> إضافة رقم جديد (SIP مخصص)
          </button>
        ) : (
          <div className={`rounded-xl border p-4 space-y-3 ${isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>إضافة رقم SIP مخصص</p>
              <button onClick={() => setShowAddForm(false)} className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>✕</button>
            </div>
            <input
              type="tel" dir="ltr" placeholder="+966115205416"
              value={addForm.phoneNumber} onChange={e => setAddForm(p => ({ ...p, phoneNumber: e.target.value }))}
              className={`w-full px-3 py-2 rounded-lg border text-sm ${isDark ? 'bg-[#0a0a0b] border-[#1f1f23] text-white' : 'bg-gray-50 border-gray-200'}`}
            />
            <input
              type="text" placeholder="اسم مميز (اختياري)"
              value={addForm.friendlyName} onChange={e => setAddForm(p => ({ ...p, friendlyName: e.target.value }))}
              className={`w-full px-3 py-2 rounded-lg border text-sm ${isDark ? 'bg-[#0a0a0b] border-[#1f1f23] text-white' : 'bg-gray-50 border-gray-200'}`}
            />
            <div className={`p-3 rounded-lg space-y-2 ${isDark ? 'bg-[#0a0a0b] border border-[#1f1f23]' : 'bg-gray-50 border border-gray-200'}`}>
              <p className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>🔧 بيانات SIP Trunk</p>
              <input
                type="text" dir="ltr" placeholder="sip.provider.com:5060"
                value={addForm.sipServer} onChange={e => setAddForm(p => ({ ...p, sipServer: e.target.value }))}
                className={`w-full px-3 py-2 rounded-lg border text-sm ${isDark ? 'bg-[#111113] border-[#1f1f23] text-white' : 'bg-white border-gray-200'}`}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text" dir="ltr" placeholder="Username"
                  value={addForm.sipUsername} onChange={e => setAddForm(p => ({ ...p, sipUsername: e.target.value }))}
                  className={`px-3 py-2 rounded-lg border text-sm ${isDark ? 'bg-[#111113] border-[#1f1f23] text-white' : 'bg-white border-gray-200'}`}
                />
                <input
                  type="password" dir="ltr" placeholder="Password"
                  value={addForm.sipPassword} onChange={e => setAddForm(p => ({ ...p, sipPassword: e.target.value }))}
                  className={`px-3 py-2 rounded-lg border text-sm ${isDark ? 'bg-[#111113] border-[#1f1f23] text-white' : 'bg-white border-gray-200'}`}
                />
              </div>
            </div>
            {addError && (
              <p className="text-xs text-red-400">{addError}</p>
            )}
            <button
              onClick={handleAddCustom}
              disabled={!addForm.phoneNumber || adding}
              className="w-full py-2.5 rounded-lg text-sm font-bold bg-teal-500 hover:bg-teal-400 text-white disabled:opacity-50 transition-colors"
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'إضافة الرقم'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// Step 6: Review
// ══════════════════════════════════════════════════════
function ReviewStep({ agent, selectedPhoneId, isDark }) {
  const role = ROLES.find(r => r.value === agent.personality?.role);
  const style = SPEAKING_STYLES.find(s => s.value === agent.personality?.speakingStyle);
  const voice = OPENAI_VOICES.find(v => v.id === agent.voice?.voiceId);
  const lang = LANGUAGES.find(l => l.value === agent.language);
  const callDir = CALL_DIRECTIONS.find(d => d.value === agent.callDirection);

  const items = [
    { label: 'الاسم', value: agent.name },
    { label: 'نوع المكالمات', value: callDir ? `${callDir.label}` : '—' },
    { label: 'الدور', value: role ? `${role.icon} ${role.label}` : '—' },
    { label: 'الشركة', value: agent.personality?.companyName || '—' },
    { label: 'اللغة', value: lang ? `${lang.icon} ${lang.label}` : '—' },
    { label: 'الأسلوب', value: style?.label || '—' },
    { label: 'الصوت', value: voice ? `${voice.name} (${voice.gender})` : '—' },
    { label: 'رقم الهاتف', value: selectedPhoneId ? '✅ تم اختيار رقم' : '⏭️ بدون رقم' },
    { label: 'الترحيب', value: agent.greeting || '—' },
  ];

  const isOutbound = agent.callDirection === 'outbound' || agent.callDirection === 'both';
  if (isOutbound) {
    items.push(
      { label: 'هدف المكالمة', value: agent.outboundSettings?.objective || '—' },
      { label: 'رسالة الافتتاح', value: agent.outboundSettings?.openingMessage || '(يستخدم الترحيب)' },
      { label: 'المحاولات', value: `${agent.outboundSettings?.maxRetries ?? 2} محاولات / كل ${agent.outboundSettings?.retryIntervalMinutes ?? 60} دقيقة` },
    );
  }

  return (
    <div>
      <div className="text-center mb-6">
        <div className="text-5xl mb-3">{agent.avatar || '🤖'}</div>
        <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          مراجعة قبل الإنشاء
        </h2>
        <p className={`text-sm mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          تأكد من الإعدادات — تقدر تعدّل أي شيء لاحقاً
        </p>
      </div>

      <div className={`max-w-lg mx-auto rounded-2xl border p-5 ${isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200'}`}>
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.label} className="flex items-center justify-between">
              <span className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{item.label}</span>
              <span className={`text-sm font-medium text-left max-w-[60%] truncate ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className={`max-w-lg mx-auto mt-4 p-3 rounded-xl text-center ${isDark ? 'bg-teal-500/5 border border-teal-500/20' : 'bg-teal-50 border border-teal-200'}`}>
        <p className={`text-xs ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>
          ✨ المساعد سيُنشأ كمسودة — فعّله من صفحة الإعدادات عندما تكون جاهز
        </p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// Main Wizard Page
// ══════════════════════════════════════════════════════
export default function CreateAgentPage() {
  const { isDark } = useTheme();
  const { t, isAr } = useLanguage();
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState('template');
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(undefined); // undefined = not chosen, null = from scratch
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [selectedPhoneId, setSelectedPhoneId] = useState(null);

  // Agent form data
  const [agent, setAgent] = useState({
    name: '',
    description: '',
    avatar: '🤖',
    language: 'ar',
    callDirection: 'inbound',
    greeting: 'أهلاً وسهلاً، كيف أقدر أساعدك؟',
    outboundSettings: {
      objective: '',
      openingMessage: '',
      maxRetries: 2,
      retryIntervalMinutes: 60,
    },
    personality: {
      role: 'receptionist',
      companyName: '',
      companyDescription: '',
      speakingStyle: 'professional',
      additionalInstructions: '',
    },
    voice: {
      provider: 'openai',
      model: 'tts-1',
      voiceId: 'nova',
      voiceName: 'Nova (أنثى)',
    },
    llm: {
      intelligenceLevel: 'balanced',
      temperature: 0.7,
    },
  });

  // ── Load templates ──
  useEffect(() => {
    const load = async () => {
      try {
        const res = await getAgentTemplates();
        setTemplates(res.templates || []);
      } catch (err) {
        console.error('Failed to load templates:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ── Apply template ──
  const handleSelectTemplate = (tmpl) => {
    setSelectedTemplate(tmpl);
    if (tmpl) {
      setAgent(prev => ({
        ...prev,
        name: '',
        personality: { ...tmpl.personality },
        language: tmpl.language || 'ar',
        greeting: tmpl.greeting || prev.greeting,
        voice: { ...tmpl.voice },
        llm: { ...tmpl.llm },
      }));
    } else {
      // From scratch — reset to defaults
      setAgent({
        name: '',
        description: '',
        avatar: '🤖',
        language: 'ar',
        greeting: 'أهلاً وسهلاً، كيف أقدر أساعدك؟',
        personality: {
          role: 'custom',
          companyName: '',
          companyDescription: '',
          speakingStyle: 'professional',
          additionalInstructions: '',
        },
        voice: { provider: 'openai', model: 'tts-1', voiceId: 'nova', voiceName: 'Nova (أنثى)' },
        llm: { intelligenceLevel: 'balanced', temperature: 0.7 },
      });
    }
  };

  // ── Navigation ──
  const stepOrder = ['template', 'callType', 'personality', 'voice', 'phone', 'review'];
  const currentIndex = stepOrder.indexOf(currentStep);

  const goNext = () => {
    if (currentIndex < stepOrder.length - 1) {
      setCurrentStep(stepOrder[currentIndex + 1]);
    }
  };
  const goBack = () => {
    if (currentIndex > 0) {
      setCurrentStep(stepOrder[currentIndex - 1]);
    }
  };

  const canGoNext = () => {
    if (currentStep === 'template') return selectedTemplate !== undefined;
    if (currentStep === 'callType') return !!agent.callDirection;
    if (currentStep === 'personality') return agent.name?.trim().length > 0;
    if (currentStep === 'voice') return agent.voice?.voiceId;
    if (currentStep === 'phone') return true; // phone is optional
    return true;
  };

  // ── Create agent ──
  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      const payload = {
        ...agent,
        templateId: selectedTemplate?.id || null,
        phoneNumberId: selectedPhoneId || undefined,
        status: 'draft',
      };
      const res = await createAgent(payload);
      if (res.success) {
        navigate(`/agents/${res.agent.id}`, { replace: true });
      } else {
        setError(res.message || 'فشل إنشاء المساعد');
      }
    } catch (err) {
      setError(err.message || 'فشل إنشاء المساعد');
    } finally {
      setCreating(false);
    }
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-teal-500' : 'text-teal-600'}`} />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6" dir="rtl">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/agents')}
          className={`p-2 rounded-xl border transition-colors ${isDark ? 'border-[#1f1f23] text-gray-400 hover:text-white' : 'border-gray-200 text-gray-400 hover:text-gray-700'}`}
        >
          <ArrowRight className="w-4 h-4" />
        </button>
        <div>
          <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            ✨ إنشاء مساعد جديد
          </h1>
          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            {STEPS.find(s => s.key === currentStep)?.label} — الخطوة {currentIndex + 1} من {stepOrder.length}
          </p>
        </div>
      </div>

      {/* Step Indicator */}
      <StepIndicator currentStep={currentStep} isDark={isDark} />

      {/* Error */}
      {error && (
        <div className={`flex items-center gap-3 p-4 rounded-xl mb-4 max-w-lg mx-auto ${isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <span className={`text-sm ${isDark ? 'text-red-400' : 'text-red-600'}`}>{error}</span>
        </div>
      )}

      {/* Step Content */}
      <div className="mb-8">
        {currentStep === 'template' && (
          <TemplateStep
            templates={templates}
            selectedTemplate={selectedTemplate}
            onSelect={handleSelectTemplate}
            isDark={isDark}
          />
        )}
        {currentStep === 'callType' && (
          <CallTypeStep agent={agent} setAgent={setAgent} isDark={isDark} />
        )}
        {currentStep === 'personality' && (
          <PersonalityStep agent={agent} setAgent={setAgent} isDark={isDark} />
        )}
        {currentStep === 'voice' && (
          <VoiceStep agent={agent} setAgent={setAgent} isDark={isDark} />
        )}
        {currentStep === 'phone' && (
          <PhoneStep
            selectedPhoneId={selectedPhoneId}
            setSelectedPhoneId={setSelectedPhoneId}
            callDirection={agent.callDirection}
            isDark={isDark}
          />
        )}
        {currentStep === 'review' && (
          <ReviewStep agent={agent} selectedPhoneId={selectedPhoneId} isDark={isDark} />
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between max-w-lg mx-auto">
        <button
          onClick={currentIndex === 0 ? () => navigate('/agents') : goBack}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium border transition-all ${
            isDark ? 'border-[#1f1f23] text-gray-400 hover:text-white hover:bg-[#1a1a1d]' : 'border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <ArrowLeft className="w-4 h-4" />
          {currentIndex === 0 ? 'إلغاء' : 'السابق'}
        </button>

        {currentStep === 'review' ? (
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-l from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white transition-all disabled:opacity-50"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            إنشاء المساعد
          </button>
        ) : (
          <button
            onClick={goNext}
            disabled={!canGoNext()}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-l from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white transition-all disabled:opacity-50"
          >
            التالي
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}