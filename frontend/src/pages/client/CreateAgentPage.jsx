// =====================================================
// Create Agent Page — معالج إنشاء مساعد جديد
// ─────────────────────────────────────────────────────
// 4-step wizard: القالب ← الشخصية ← الصوت ← المراجعة
// =====================================================
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bot, ArrowRight, ArrowLeft, Loader2, AlertCircle, CheckCircle,
  Sparkles, Volume2, Check, ChevronLeft,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { createAgent, getAgentTemplates } from "@/services/api/agentAPI";

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
  { key: 'template',    label: 'القالب',    num: 1 },
  { key: 'personality', label: 'الشخصية',  num: 2 },
  { key: 'voice',       label: 'الصوت',    num: 3 },
  { key: 'review',      label: 'المراجعة', num: 4 },
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
// Step 4: Review
// ══════════════════════════════════════════════════════
function ReviewStep({ agent, isDark }) {
  const role = ROLES.find(r => r.value === agent.personality?.role);
  const style = SPEAKING_STYLES.find(s => s.value === agent.personality?.speakingStyle);
  const voice = OPENAI_VOICES.find(v => v.id === agent.voice?.voiceId);
  const lang = LANGUAGES.find(l => l.value === agent.language);

  const items = [
    { label: 'الاسم', value: agent.name },
    { label: 'الدور', value: role ? `${role.icon} ${role.label}` : '—' },
    { label: 'الشركة', value: agent.personality?.companyName || '—' },
    { label: 'اللغة', value: lang ? `${lang.icon} ${lang.label}` : '—' },
    { label: 'الأسلوب', value: style?.label || '—' },
    { label: 'الصوت', value: voice ? `${voice.name} (${voice.gender})` : '—' },
    { label: 'الترحيب', value: agent.greeting || '—' },
  ];

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

  // Agent form data
  const [agent, setAgent] = useState({
    name: '',
    description: '',
    avatar: '🤖',
    language: 'ar',
    greeting: 'أهلاً وسهلاً، كيف أقدر أساعدك؟',
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
  const stepOrder = ['template', 'personality', 'voice', 'review'];
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
    if (currentStep === 'personality') return agent.name?.trim().length > 0;
    if (currentStep === 'voice') return agent.voice?.voiceId;
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
        {currentStep === 'personality' && (
          <PersonalityStep agent={agent} setAgent={setAgent} isDark={isDark} />
        )}
        {currentStep === 'voice' && (
          <VoiceStep agent={agent} setAgent={setAgent} isDark={isDark} />
        )}
        {currentStep === 'review' && (
          <ReviewStep agent={agent} isDark={isDark} />
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
