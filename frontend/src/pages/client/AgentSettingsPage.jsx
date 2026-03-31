// =====================================================
// Agent Settings Page — إعدادات المساعد الذكي
// ─────────────────────────────────────────────────────
// Tabs: أساسي | الشخصية | الصوت | متقدم | رقم الهاتف | المحادثة
// 3-layer approach: simple → advanced → technical
// =====================================================
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  Bot, ArrowRight, Save, Loader2, AlertCircle, CheckCircle,
  User, Mic, Brain, Settings, MessageSquare, Sparkles,
  Volume2, Globe, Clock, ChevronDown, ChevronUp, Info,
  Play, RotateCcw, Send, Trash2,
  Phone, PhoneIncoming, PhoneOutgoing, Activity, Wifi, XCircle,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { getAgent, updateAgent, chatWithAgent, suggestContent } from "@/services/api/agentAPI";
import { phoneAPI } from "@/services/api/phoneAPI";
import { listLivekitCalls } from "@/services/api/livekitAPI";

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
  { value: 'ar',   label: 'العربية' },
  { value: 'en',   label: 'English' },
  { value: 'both', label: 'عربي + إنجليزي' },
];

const INTELLIGENCE_LEVELS = [
  { value: 'fast',     label: 'سريع ⚡',      desc: 'استجابة فورية — مناسب للأسئلة البسيطة', model: 'gpt-5.4-nano' },
  { value: 'balanced', label: 'متوازن ⭐',     desc: 'ذكي وسريع — الخيار الافتراضي',          model: 'gpt-5.4-mini' },
  { value: 'smart',    label: 'ذكي جداً 🧠',  desc: 'أفضل فهم — أبطأ قليلاً',               model: 'gpt-5.4' },
];

const OPENAI_VOICES = [
  { id: 'nova',    name: 'Nova (أنثى)',    desc: 'صوت أنثوي دافئ ومهني' },
  { id: 'alloy',   name: 'Alloy (محايد)',   desc: 'صوت متوازن ومحايد' },
  { id: 'echo',    name: 'Echo (ذكر)',      desc: 'صوت ذكوري واضح' },
  { id: 'fable',   name: 'Fable (ذكر)',     desc: 'صوت ذكوري دافئ' },
  { id: 'onyx',    name: 'Onyx (ذكر)',      desc: 'صوت ذكوري عميق' },
  { id: 'shimmer', name: 'Shimmer (أنثى)',  desc: 'صوت أنثوي حيوي' },
];

const AVATARS = ['🤖', '👩‍💼', '👨‍💼', '🧑‍💻', '👩‍⚕️', '👨‍⚕️', '📞', '🎧', '💼', '🏢', '🏥', '📋'];

const DAYS = [
  { key: 'sunday',    label: 'الأحد' },
  { key: 'monday',    label: 'الاثنين' },
  { key: 'tuesday',   label: 'الثلاثاء' },
  { key: 'wednesday', label: 'الأربعاء' },
  { key: 'thursday',  label: 'الخميس' },
  { key: 'friday',    label: 'الجمعة' },
  { key: 'saturday',  label: 'السبت' },
];

// ══════════════════════════════════════════════════════
// Section Wrapper
// ══════════════════════════════════════════════════════
function Section({ title, description, isDark, children }) {
  return (
    <div className={`rounded-2xl border p-5 mb-4 ${isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200'}`}>
      {title && (
        <div className="mb-4">
          <h3 className={`font-bold text-base ${isDark ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
          {description && <p className={`text-sm mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{description}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// Field Components
// ══════════════════════════════════════════════════════
function FieldLabel({ label, required, isDark }) {
  return (
    <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
      {label} {required && <span className="text-red-400">*</span>}
    </label>
  );
}

function TextInput({ value, onChange, placeholder, isDark, maxLength, disabled }) {
  return (
    <input
      type="text"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      disabled={disabled}
      className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-colors ${
        isDark
          ? 'bg-[#0a0a0b] border-[#1f1f23] text-white placeholder:text-gray-600 focus:border-teal-500/50'
          : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-teal-500'
      } focus:outline-none focus:ring-1 focus:ring-teal-500/30 disabled:opacity-50`}
    />
  );
}

function TextArea({ value, onChange, placeholder, isDark, rows = 3, maxLength }) {
  return (
    <textarea
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      maxLength={maxLength}
      className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-colors resize-none ${
        isDark
          ? 'bg-[#0a0a0b] border-[#1f1f23] text-white placeholder:text-gray-600 focus:border-teal-500/50'
          : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-teal-500'
      } focus:outline-none focus:ring-1 focus:ring-teal-500/30`}
    />
  );
}

function SelectInput({ value, onChange, options, isDark }) {
  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-colors appearance-none ${
        isDark
          ? 'bg-[#0a0a0b] border-[#1f1f23] text-white focus:border-teal-500/50'
          : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-teal-500'
      } focus:outline-none focus:ring-1 focus:ring-teal-500/30`}
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}

// ══════════════════════════════════════════════════════
// Tab: Basic Settings
// ══════════════════════════════════════════════════════
function BasicTab({ agent, setAgent, isDark }) {
  return (
    <>
      <Section title="المعلومات الأساسية" isDark={isDark}>
        <div className="space-y-4">
          {/* Name */}
          <div>
            <FieldLabel label="اسم المساعد" required isDark={isDark} />
            <TextInput
              value={agent.name}
              onChange={(v) => setAgent(p => ({ ...p, name: v }))}
              placeholder="مثال: سارة، محمد، مساعد الحجوزات..."
              isDark={isDark}
              maxLength={100}
            />
          </div>

          {/* Description */}
          <div>
            <FieldLabel label="وصف مختصر" isDark={isDark} />
            <TextInput
              value={agent.description}
              onChange={(v) => setAgent(p => ({ ...p, description: v }))}
              placeholder="وصف بسيط لمهمة المساعد..."
              isDark={isDark}
              maxLength={500}
            />
          </div>

          {/* Avatar */}
          <div>
            <FieldLabel label="الأيقونة" isDark={isDark} />
            <div className="flex flex-wrap gap-2">
              {AVATARS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => setAgent(p => ({ ...p, avatar: emoji }))}
                  className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all ${
                    agent.avatar === emoji
                      ? 'bg-teal-500/20 border-2 border-teal-500 scale-110'
                      : isDark ? 'bg-[#0a0a0b] border border-[#1f1f23] hover:border-[#2a2a2e]' : 'bg-gray-50 border border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Language */}
          <div>
            <FieldLabel label="اللغة" required isDark={isDark} />
            <SelectInput
              value={agent.language}
              onChange={(v) => setAgent(p => ({ ...p, language: v }))}
              options={LANGUAGES}
              isDark={isDark}
            />
          </div>

          {/* Status */}
          <div>
            <FieldLabel label="الحالة" isDark={isDark} />
            <div className="flex gap-2">
              {[
                { value: 'active', label: 'مفعّل', color: 'emerald' },
                { value: 'inactive', label: 'معطّل', color: 'gray' },
                { value: 'draft', label: 'مسودة', color: 'amber' },
              ].map(s => (
                <button
                  key={s.value}
                  onClick={() => setAgent(p => ({ ...p, status: s.value }))}
                  className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
                    agent.status === s.value
                      ? s.value === 'active'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : s.value === 'inactive'
                        ? isDark ? 'bg-gray-500/10 border-gray-500/30 text-gray-400' : 'bg-gray-100 border-gray-300 text-gray-600'
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                      : isDark ? 'border-[#1f1f23] text-gray-500 hover:border-[#2a2a2e]' : 'border-gray-200 text-gray-400 hover:border-gray-300'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* Greeting */}
      <Section title="رسالة الترحيب" description="أول جملة يقولها المساعد عند بدء المكالمة" isDark={isDark}>
        <TextArea
          value={agent.greeting}
          onChange={(v) => setAgent(p => ({ ...p, greeting: v }))}
          placeholder="أهلاً وسهلاً، كيف أقدر أساعدك؟"
          isDark={isDark}
          rows={2}
          maxLength={500}
        />
      </Section>
    </>
  );
}

// ══════════════════════════════════════════════════════
// Tab: Personality Settings
// ══════════════════════════════════════════════════════
function PersonalityTab({ agent, setAgent, isDark, onSuggest, suggesting }) {
  const updatePersonality = (key, value) => {
    setAgent(p => ({ ...p, personality: { ...p.personality, [key]: value } }));
  };

  return (
    <>
      {/* Role */}
      <Section title="الدور" description="ما هو دور المساعد؟ هذا يحدد سلوكه الأساسي" isDark={isDark}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {ROLES.map(role => (
            <button
              key={role.value}
              onClick={() => updatePersonality('role', role.value)}
              className={`flex items-center gap-2.5 p-3 rounded-xl text-sm font-medium border transition-all ${
                agent.personality?.role === role.value
                  ? 'bg-teal-500/10 border-teal-500/30 text-teal-400'
                  : isDark ? 'border-[#1f1f23] text-gray-400 hover:border-[#2a2a2e] hover:text-gray-300' : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              <span className="text-lg">{role.icon}</span>
              {role.label}
            </button>
          ))}
        </div>
      </Section>

      {/* Company info */}
      <Section title="معلومات الشركة" description="ساعد المساعد يعرف عن شركتك" isDark={isDark}>
        <div className="space-y-4">
          <div>
            <FieldLabel label="اسم الشركة / المؤسسة" isDark={isDark} />
            <TextInput
              value={agent.personality?.companyName}
              onChange={(v) => updatePersonality('companyName', v)}
              placeholder="مثال: شركة الابتكار، عيادة الصحة..."
              isDark={isDark}
            />
          </div>
          <div>
            <FieldLabel label="وصف مختصر للشركة" isDark={isDark} />
            <TextInput
              value={agent.personality?.companyDescription}
              onChange={(v) => updatePersonality('companyDescription', v)}
              placeholder="مثال: شركة تقنية متخصصة في حلول الذكاء الاصطناعي"
              isDark={isDark}
            />
          </div>
        </div>
      </Section>

      {/* Speaking style */}
      <Section title="أسلوب الكلام" isDark={isDark}>
        <div className="space-y-2">
          {SPEAKING_STYLES.map(style => (
            <button
              key={style.value}
              onClick={() => updatePersonality('speakingStyle', style.value)}
              className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-sm transition-all ${
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
              {agent.personality?.speakingStyle === style.value && (
                <CheckCircle className="w-5 h-5 text-teal-400 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      </Section>

      {/* Additional instructions */}
      <Section title="تعليمات إضافية" description="أي تعليمات خاصة تريد إضافتها لسلوك المساعد" isDark={isDark}>
        <TextArea
          value={agent.personality?.additionalInstructions}
          onChange={(v) => updatePersonality('additionalInstructions', v)}
          placeholder="مثال: لا تناقش الأسعار، حوّل العميل لفريق المبيعات..."
          isDark={isDark}
          rows={4}
        />
        <button
          onClick={() => onSuggest('instructions')}
          disabled={suggesting}
          className={`mt-3 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            isDark ? 'bg-[#1a1a1d] border border-[#2a2a2e] text-gray-300 hover:text-white' : 'bg-gray-50 border border-gray-200 text-gray-600 hover:text-gray-900'
          } disabled:opacity-50`}
        >
          {suggesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          اقترح لي تعليمات
        </button>
      </Section>
    </>
  );
}

// ══════════════════════════════════════════════════════
// Tab: Voice Settings
// ══════════════════════════════════════════════════════
function VoiceTab({ agent, setAgent, isDark }) {
  const updateVoice = (key, value) => {
    setAgent(p => ({ ...p, voice: { ...p.voice, [key]: value } }));
  };

  return (
    <>
      {/* Provider */}
      <Section title="مزوّد الصوت" isDark={isDark}>
        <div className="flex gap-3">
          {[
            { value: 'openai', label: 'OpenAI TTS', desc: 'مستقر وسريع', icon: '🔊' },
            { value: 'elevenlabs', label: 'ElevenLabs', desc: 'جودة عربية أعلى (يحتاج باقة مدفوعة)', icon: '🎙️' },
          ].map(p => (
            <button
              key={p.value}
              onClick={() => {
                updateVoice('provider', p.value);
                if (p.value === 'openai') {
                  updateVoice('model', 'tts-1');
                  updateVoice('voiceId', 'nova');
                  updateVoice('voiceName', 'Nova (أنثى)');
                } else {
                  updateVoice('model', 'eleven_turbo_v2_5');
                  updateVoice('voiceId', '21m00Tcm4TlvDq8ikWAM');
                  updateVoice('voiceName', 'Rachel (أنثى — إنجليزي)');
                }
              }}
              className={`flex-1 p-4 rounded-xl border text-center transition-all ${
                agent.voice?.provider === p.value
                  ? 'bg-teal-500/10 border-teal-500/30'
                  : isDark ? 'border-[#1f1f23] hover:border-[#2a2a2e]' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="text-2xl">{p.icon}</span>
              <p className={`text-sm font-medium mt-2 ${agent.voice?.provider === p.value ? 'text-teal-400' : isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {p.label}
              </p>
              <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{p.desc}</p>
            </button>
          ))}
        </div>
      </Section>

      {/* Voice selection — OpenAI */}
      {agent.voice?.provider === 'openai' && (
        <Section title="اختيار الصوت" isDark={isDark}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {OPENAI_VOICES.map(v => (
              <button
                key={v.id}
                onClick={() => {
                  updateVoice('voiceId', v.id);
                  updateVoice('voiceName', v.name);
                }}
                className={`p-3 rounded-xl border text-sm transition-all text-right ${
                  agent.voice?.voiceId === v.id
                    ? 'bg-teal-500/10 border-teal-500/30'
                    : isDark ? 'border-[#1f1f23] hover:border-[#2a2a2e]' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className={`font-medium ${agent.voice?.voiceId === v.id ? 'text-teal-400' : isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {v.name}
                </p>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{v.desc}</p>
              </button>
            ))}
          </div>
        </Section>
      )}

      {/* Voice selection — ElevenLabs */}
      {agent.voice?.provider === 'elevenlabs' && (
        <Section title="اختيار الصوت" description="ElevenLabs يحتاج باقة Starter ($5/شهر) على الأقل" isDark={isDark}>
          <div className={`p-4 rounded-xl border ${isDark ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50 border-amber-200'}`}>
            <p className={`text-sm ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
              ⚠️ ElevenLabs يحتاج باقة مدفوعة للعمل مع المكالمات الصوتية. الباقة المجانية لا تدعم البث المباشر (WebSocket Streaming).
            </p>
          </div>
          <div className="mt-3">
            <FieldLabel label="معرّف الصوت (Voice ID)" isDark={isDark} />
            <TextInput
              value={agent.voice?.voiceId}
              onChange={(v) => updateVoice('voiceId', v)}
              placeholder="21m00Tcm4TlvDq8ikWAM"
              isDark={isDark}
            />
            <p className={`text-xs mt-1 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
              تحصل على معرّف الصوت من لوحة ElevenLabs
            </p>
          </div>
        </Section>
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════
// Tab: Advanced Settings
// ══════════════════════════════════════════════════════
function AdvancedTab({ agent, setAgent, isDark }) {
  const [showTechnical, setShowTechnical] = useState(false);
  const [showWorkingHours, setShowWorkingHours] = useState(agent.workingHours?.enabled || false);

  const updateLlm = (key, value) => {
    setAgent(p => ({ ...p, llm: { ...p.llm, [key]: value } }));
  };
  const updateStt = (key, value) => {
    setAgent(p => ({ ...p, stt: { ...p.stt, [key]: value } }));
  };
  const updateWH = (path, value) => {
    setAgent(p => {
      const wh = { ...p.workingHours };
      if (path === 'enabled') { wh.enabled = value; setShowWorkingHours(value); }
      else if (path === 'offHoursMessage') { wh.offHoursMessage = value; }
      else {
        const [, day, field] = path.match(/schedule\.(\w+)\.(\w+)/);
        wh.schedule = { ...wh.schedule, [day]: { ...wh.schedule?.[day], [field]: value } };
      }
      return { ...p, workingHours: wh };
    });
  };

  return (
    <>
      {/* Intelligence Level */}
      <Section title="مستوى الذكاء" description="يحدد سرعة ودقة ردود المساعد" isDark={isDark}>
        <div className="space-y-2">
          {INTELLIGENCE_LEVELS.map(level => (
            <button
              key={level.value}
              onClick={() => updateLlm('intelligenceLevel', level.value)}
              className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-sm transition-all ${
                agent.llm?.intelligenceLevel === level.value
                  ? 'bg-teal-500/10 border-teal-500/30'
                  : isDark ? 'border-[#1f1f23] hover:border-[#2a2a2e]' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-right">
                <span className={`font-medium ${agent.llm?.intelligenceLevel === level.value ? 'text-teal-400' : isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {level.label}
                </span>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{level.desc}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-lg ${isDark ? 'bg-[#1a1a1d] text-gray-500' : 'bg-gray-100 text-gray-400'}`}>
                {level.model}
              </span>
            </button>
          ))}
        </div>
      </Section>

      {/* Creativity slider */}
      <Section title="درجة الإبداع" description="منضبط = يلتزم بالتعليمات بدقة، إبداعي = يتصرف بمرونة أكبر" isDark={isDark}>
        <div className="px-2">
          <input
            type="range"
            min="0" max="1" step="0.1"
            value={agent.llm?.temperature || 0.7}
            onChange={(e) => updateLlm('temperature', parseFloat(e.target.value))}
            className="w-full accent-teal-500"
          />
          <div className={`flex justify-between text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            <span>منضبط</span>
            <span>{agent.llm?.temperature || 0.7}</span>
            <span>إبداعي</span>
          </div>
        </div>
      </Section>

      {/* Max Call Duration */}
      <Section title="الحد الأقصى للمكالمة" isDark={isDark}>
        <SelectInput
          value={agent.maxCallDuration || 300}
          onChange={(v) => setAgent(p => ({ ...p, maxCallDuration: parseInt(v) }))}
          options={[
            { value: 60, label: 'دقيقة واحدة' },
            { value: 180, label: '3 دقائق' },
            { value: 300, label: '5 دقائق (افتراضي)' },
            { value: 600, label: '10 دقائق' },
            { value: 900, label: '15 دقيقة' },
            { value: 1800, label: '30 دقيقة' },
          ]}
          isDark={isDark}
        />
      </Section>

      {/* Working Hours */}
      <Section title="ساعات العمل" description="حدد متى المساعد يرد على المكالمات" isDark={isDark}>
        <div className="space-y-3">
          {/* Toggle */}
          <button
            onClick={() => updateWH('enabled', !showWorkingHours)}
            className={`flex items-center gap-3 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}
          >
            <div className={`w-10 h-6 rounded-full p-0.5 transition-colors ${showWorkingHours ? 'bg-teal-500' : isDark ? 'bg-[#2a2a2e]' : 'bg-gray-300'}`}>
              <div className={`w-5 h-5 rounded-full bg-white transition-transform ${showWorkingHours ? '-translate-x-4' : 'translate-x-0'}`} />
            </div>
            <span>{showWorkingHours ? 'مفعّل' : 'معطّل — يرد على مدار الساعة'}</span>
          </button>

          {/* Schedule */}
          {showWorkingHours && (
            <div className="space-y-2 mt-3">
              {DAYS.map(day => {
                const dayData = agent.workingHours?.schedule?.[day.key] || { active: false, start: '09:00', end: '17:00' };
                return (
                  <div key={day.key} className={`flex items-center gap-3 p-2.5 rounded-xl ${isDark ? 'bg-[#0a0a0b]' : 'bg-gray-50'}`}>
                    <button
                      onClick={() => updateWH(`schedule.${day.key}.active`, !dayData.active)}
                      className={`w-5 h-5 rounded flex items-center justify-center border text-xs ${
                        dayData.active ? 'bg-teal-500 border-teal-500 text-white' : isDark ? 'border-[#2a2a2e]' : 'border-gray-300'
                      }`}
                    >
                      {dayData.active && '✓'}
                    </button>
                    <span className={`w-16 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{day.label}</span>
                    {dayData.active ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="time" value={dayData.start || '09:00'}
                          onChange={(e) => updateWH(`schedule.${day.key}.start`, e.target.value)}
                          className={`px-2 py-1 rounded-lg border text-xs ${isDark ? 'bg-[#111113] border-[#1f1f23] text-gray-300' : 'bg-white border-gray-200 text-gray-700'}`}
                        />
                        <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>—</span>
                        <input
                          type="time" value={dayData.end || '17:00'}
                          onChange={(e) => updateWH(`schedule.${day.key}.end`, e.target.value)}
                          className={`px-2 py-1 rounded-lg border text-xs ${isDark ? 'bg-[#111113] border-[#1f1f23] text-gray-300' : 'bg-white border-gray-200 text-gray-700'}`}
                        />
                      </div>
                    ) : (
                      <span className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>مغلق</span>
                    )}
                  </div>
                );
              })}

              {/* Off-hours message */}
              <div className="mt-3">
                <FieldLabel label="رسالة خارج الدوام" isDark={isDark} />
                <TextArea
                  value={agent.workingHours?.offHoursMessage}
                  onChange={(v) => updateWH('offHoursMessage', v)}
                  placeholder="شكراً لاتصالك، نحن خارج ساعات العمل حالياً..."
                  isDark={isDark}
                  rows={2}
                />
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* Custom System Prompt — Technical */}
      <Section title="إعدادات المطور" description="للمستخدمين المتقدمين — كتابة System Prompt مخصص" isDark={isDark}>
        <button
          onClick={() => setShowTechnical(!showTechnical)}
          className={`flex items-center gap-2 text-sm ${isDark ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`}
        >
          {showTechnical ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {showTechnical ? 'إخفاء' : 'عرض الإعدادات التقنية'}
        </button>

        {showTechnical && (
          <div className="mt-4 space-y-4">
            {/* Use custom prompt toggle */}
            <button
              onClick={() => setAgent(p => ({ ...p, useCustomPrompt: !p.useCustomPrompt }))}
              className={`flex items-center gap-3 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}
            >
              <div className={`w-10 h-6 rounded-full p-0.5 transition-colors ${agent.useCustomPrompt ? 'bg-teal-500' : isDark ? 'bg-[#2a2a2e]' : 'bg-gray-300'}`}>
                <div className={`w-5 h-5 rounded-full bg-white transition-transform ${agent.useCustomPrompt ? '-translate-x-4' : 'translate-x-0'}`} />
              </div>
              <span>استخدام System Prompt مخصص (يتجاوز حقول الشخصية)</span>
            </button>

            {agent.useCustomPrompt && (
              <div>
                <FieldLabel label="System Prompt" isDark={isDark} />
                <TextArea
                  value={agent.systemPrompt}
                  onChange={(v) => setAgent(p => ({ ...p, systemPrompt: v }))}
                  placeholder="أنت مساعد ذكي..."
                  isDark={isDark}
                  rows={8}
                />
              </div>
            )}

            {/* STT Provider */}
            <div>
              <FieldLabel label="مزوّد تحويل الكلام لنص (STT)" isDark={isDark} />
              <SelectInput
                value={agent.stt?.provider}
                onChange={(v) => {
                  updateStt('provider', v);
                  updateStt('model', v === 'openai' ? 'whisper-1' : 'nova-2');
                }}
                options={[
                  { value: 'deepgram', label: 'Deepgram Nova-2' },
                  { value: 'openai', label: 'OpenAI Whisper' },
                ]}
                isDark={isDark}
              />
            </div>
          </div>
        )}
      </Section>
    </>
  );
}

// ══════════════════════════════════════════════════════
// Tab: Phone Number
// ══════════════════════════════════════════════════════
function PhoneTab({ agent, setAgent, isDark, onSave }) {
  const [phones, setPhones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState(null);
  const [checking, setChecking] = useState(false);
  const [changing, setChanging] = useState(false);
  const [selectedPhoneId, setSelectedPhoneId] = useState(agent.phoneNumberId || '');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await phoneAPI.list();
        setPhones(res.phones || []);
      } catch (e) {
        console.error('Failed to load phones:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const linkedPhone = phones.find(p => p.id === agent.phoneNumberId || p.agentId === agent.id);

  const handleChangePhone = async () => {
    if (selectedPhoneId === (agent.phoneNumberId || '')) return;
    setChanging(true);
    try {
      setAgent(prev => ({ ...prev, phoneNumberId: selectedPhoneId || null }));
      if (onSave) await onSave({ phoneNumberId: selectedPhoneId || null });
    } finally {
      setChanging(false);
    }
  };

  const handleHealthCheck = async () => {
    if (!linkedPhone) return;
    setChecking(true);
    try {
      const res = await phoneAPI.healthCheck(linkedPhone.id);
      setHealth(res.health);
    } catch (e) {
      setHealth({ overall: 'error' });
    } finally {
      setChecking(false);
    }
  };

  const direction = agent.callDirection || 'inbound';
  const availablePhones = phones.filter(p => !p.agentId || p.id === linkedPhone?.id);

  return (
    <div className="space-y-6">
      {/* ── Current Phone ── */}
      <div className={`rounded-2xl border p-5 ${isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200'}`}>
        <h3 className={`text-sm font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          <Phone className="w-4 h-4 inline ml-2" /> الرقم المربوط
        </h3>

        {linkedPhone ? (
          <div className="space-y-4">
            {/* Phone info */}
            <div className={`flex items-center justify-between p-4 rounded-xl ${isDark ? 'bg-[#0a0a0b] border border-[#1f1f23]' : 'bg-gray-50 border border-gray-200'}`}>
              <div>
                <p className={`font-mono font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`} dir="ltr">
                  {linkedPhone.phoneNumber}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {linkedPhone.friendlyName && <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{linkedPhone.friendlyName}</span>}
                  <span className={`text-xs px-1.5 py-0.5 rounded ${isDark ? 'bg-[#1a1a1d] text-gray-500' : 'bg-gray-100 text-gray-500'}`}>
                    {linkedPhone.provider === 'custom' ? 'SIP مخصص' : linkedPhone.provider}
                  </span>
                </div>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                linkedPhone.status === 'active' ? (isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600')
                : isDark ? 'bg-gray-500/10 text-gray-400' : 'bg-gray-100 text-gray-500'
              }`}>
                {linkedPhone.status === 'active' ? 'نشط' : linkedPhone.status === 'inactive' ? 'معطّل' : linkedPhone.status}
              </span>
            </div>

            {/* SIP Status */}
            <div className={`grid grid-cols-2 gap-3`}>
              <div className={`flex items-center gap-2 p-3 rounded-xl text-xs ${
                linkedPhone.sipTrunkId
                  ? (isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600')
                  : (isDark ? 'bg-gray-500/10 text-gray-500' : 'bg-gray-50 text-gray-400')
              }`}>
                <PhoneIncoming className="w-4 h-4" />
                <span>{linkedPhone.sipTrunkId ? 'Inbound SIP ✓' : 'Inbound —'}</span>
              </div>
              <div className={`flex items-center gap-2 p-3 rounded-xl text-xs ${
                linkedPhone.sipOutboundTrunkId
                  ? (isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600')
                  : (isDark ? 'bg-gray-500/10 text-gray-500' : 'bg-gray-50 text-gray-400')
              }`}>
                <PhoneOutgoing className="w-4 h-4" />
                <span>{linkedPhone.sipOutboundTrunkId ? 'Outbound SIP ✓' : 'Outbound —'}</span>
              </div>
            </div>

            {/* Direction mismatch warning */}
            {direction !== 'inbound' && !linkedPhone.sipOutboundTrunkId && (
              <div className={`flex items-start gap-2 p-3 rounded-xl text-xs ${isDark ? 'bg-amber-500/10 border border-amber-500/20 text-amber-300' : 'bg-amber-50 border border-amber-200 text-amber-700'}`}>
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>الوكيل يدعم مكالمات صادرة لكن الرقم لا يحتوي Outbound SIP Trunk. أعد إعداد SIP أو غيّر نوع المكالمات.</p>
              </div>
            )}

            {/* Health Check */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleHealthCheck}
                disabled={checking}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium border transition-all ${
                  isDark ? 'border-[#1f1f23] text-gray-400 hover:text-white hover:bg-[#1a1a1d]' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                } disabled:opacity-50`}
              >
                {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                فحص الاتصال
              </button>

              {health && !checking && (
                <span className={`text-xs px-3 py-1.5 rounded-lg ${
                  health.overall === 'healthy' ? (isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600')
                  : health.overall === 'no_agent' ? (isDark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-600')
                  : (isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600')
                }`}>
                  {health.overall === 'healthy' ? '✓ سليم' : health.overall === 'no_agent' ? '⚠ بدون وكيل' : `✕ ${health.overall}`}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className={`text-center py-6 rounded-xl border border-dashed ${isDark ? 'border-[#2a2a2e] text-gray-600' : 'border-gray-300 text-gray-400'}`}>
            <Phone className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">لا يوجد رقم مربوط</p>
            <p className="text-xs mt-1">اختر رقم من القائمة أدناه</p>
          </div>
        )}
      </div>

      {/* ── Change / Assign Phone ── */}
      <div className={`rounded-2xl border p-5 ${isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200'}`}>
        <h3 className={`text-sm font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {linkedPhone ? 'تغيير الرقم' : 'ربط رقم'}
        </h3>

        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-500" /></div>
        ) : (
          <div className="space-y-3">
            <select
              value={selectedPhoneId}
              onChange={e => setSelectedPhoneId(e.target.value)}
              className={`w-full px-4 py-3 rounded-xl border text-sm ${isDark ? 'bg-[#0a0a0b] border-[#1f1f23] text-white' : 'bg-gray-50 border-gray-200'}`}
            >
              <option value="">— بدون رقم —</option>
              {availablePhones.map(p => (
                <option key={p.id} value={p.id}>
                  {p.phoneNumber} {p.friendlyName ? `(${p.friendlyName})` : ''} — {p.provider === 'custom' ? 'SIP' : p.provider}
                </option>
              ))}
            </select>

            {selectedPhoneId !== (agent.phoneNumberId || '') && (
              <button
                onClick={handleChangePhone}
                disabled={changing}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-teal-500 hover:bg-teal-400 text-white disabled:opacity-50 transition-colors"
              >
                {changing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {linkedPhone ? 'تغيير الرقم' : 'ربط الرقم'}
              </button>
            )}

            {availablePhones.length === 0 && (
              <p className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                لا توجد أرقام متاحة — أضف رقم من <a href="/phones" className="text-teal-400 hover:underline">صفحة أرقام الهاتف</a>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// Tab: Outbound Calls
// ══════════════════════════════════════════════════════
function OutboundTab({ agent, isDark }) {
  const [calls, setCalls] = useState([]);
  const [stats, setStats] = useState({ total: 0, answered: 0, succeeded: 0 });
  const [loading, setLoading] = useState(true);
  const [showDialer, setShowDialer] = useState(false);
  const [destination, setDestination] = useState('');
  const [calling, setCalling] = useState(false);
  const [callResult, setCallResult] = useState(null);
  const [callError, setCallError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await listLivekitCalls({ direction: 'outbound', limit: 20 });
        const agentCalls = (res.calls || []).filter(c => c.agentId === agent.id);
        setCalls(agentCalls);

        // Calculate stats
        const total = agentCalls.length;
        const answered = agentCalls.filter(c => c.durationSeconds > 0).length;
        const succeeded = agentCalls.filter(c => c.callResult === 'succeeded').length;
        setStats({ total, answered, succeeded });
      } catch (e) {
        console.error('Failed to load outbound calls:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [agent.id]);

  const handleDial = async () => {
    if (!destination.startsWith('+') || !agent.phoneNumberId) return;
    setCalling(true);
    setCallError(null);
    setCallResult(null);
    try {
      // Find linked phone to make the call
      const phonesRes = await phoneAPI.list();
      const linkedPhone = (phonesRes.phones || []).find(p => p.agentId === agent.id);
      if (!linkedPhone) {
        setCallError('لا يوجد رقم مربوط — اربط رقم من تاب الهاتف أولاً');
        return;
      }
      const res = await phoneAPI.outbound(linkedPhone.id, destination);
      setCallResult(res);
    } catch (e) {
      setCallError(e.message || 'فشل إجراء المكالمة');
    } finally {
      setCalling(false);
    }
  };

  const fmtDuration = (secs) => {
    if (!secs) return '—';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const fmtDate = (d) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
    catch { return '—'; }
  };

  const RESULT_LABELS = {
    succeeded: { label: 'نجحت', color: 'emerald' },
    refused: { label: 'رفض', color: 'red' },
    callback_requested: { label: 'طلب معاودة', color: 'amber' },
    no_answer: { label: 'لم يرد', color: 'gray' },
    error: { label: 'خطأ', color: 'red' },
  };

  return (
    <div className="space-y-6">
      {/* ── Stats ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'إجمالي المكالمات', value: stats.total, icon: PhoneOutgoing, color: 'teal' },
          { label: 'نسبة الرد', value: stats.total > 0 ? `${Math.round(stats.answered / stats.total * 100)}%` : '—', icon: Phone, color: 'blue' },
          { label: 'نسبة النجاح', value: stats.total > 0 ? `${Math.round(stats.succeeded / stats.total * 100)}%` : '—', icon: CheckCircle, color: 'emerald' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 ${isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200'}`}>
            <s.icon className={`w-5 h-5 mb-2 text-${s.color}-400`} />
            <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{s.value}</p>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Dialer ── */}
      <div className={`rounded-2xl border p-5 ${isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            <PhoneOutgoing className="w-4 h-4 inline ml-2" /> مكالمة صادرة جديدة
          </h3>
          {!agent.phoneNumberId && (
            <span className={`text-xs ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>⚠ اربط رقم أولاً</span>
          )}
        </div>

        {!callResult ? (
          <div className="space-y-3">
            <input
              type="tel" dir="ltr"
              placeholder="+966501234567"
              value={destination}
              onChange={e => setDestination(e.target.value)}
              className={`w-full px-4 py-3 rounded-xl border text-base font-mono text-center tracking-wider ${
                isDark ? 'bg-[#0a0a0b] border-[#1f1f23] text-white placeholder:text-gray-600' : 'bg-gray-50 border-gray-200 placeholder:text-gray-400'
              } focus:outline-none focus:ring-2 focus:ring-teal-500/30`}
            />

            {agent.outboundSettings?.objective && (
              <div className={`flex items-start gap-2 p-3 rounded-xl text-xs ${isDark ? 'bg-[#0a0a0b] border border-[#1f1f23]' : 'bg-gray-50 border border-gray-200'}`}>
                <Bot className={`w-4 h-4 shrink-0 mt-0.5 ${isDark ? 'text-teal-400' : 'text-teal-500'}`} />
                <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                  الهدف: <strong className={isDark ? 'text-white' : 'text-gray-900'}>{agent.outboundSettings.objective}</strong>
                </p>
              </div>
            )}

            {callError && (
              <div className={`flex items-center gap-2 p-3 rounded-xl text-xs ${isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600'}`}>
                <AlertCircle className="w-3.5 h-3.5" /> {callError}
              </div>
            )}

            <button
              onClick={handleDial}
              disabled={!destination.startsWith('+') || calling || !agent.phoneNumberId}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-gradient-to-l from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white disabled:opacity-50 transition-all"
            >
              {calling ? <Loader2 className="w-4 h-4 animate-spin" /> : <PhoneOutgoing className="w-4 h-4" />}
              {calling ? 'جاري الاتصال...' : 'اتصل الآن'}
            </button>
          </div>
        ) : (
          <div className="text-center space-y-3">
            <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center bg-emerald-500/10">
              <PhoneOutgoing className="w-6 h-6 text-emerald-400" />
            </div>
            <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>جاري الاتصال</p>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`} dir="ltr">{destination}</p>
            <button onClick={() => { setCallResult(null); setDestination(''); }}
              className={`text-xs px-4 py-2 rounded-lg ${isDark ? 'bg-[#1a1a1d] text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
              مكالمة جديدة
            </button>
          </div>
        )}
      </div>

      {/* ── Recent Calls ── */}
      <div className={`rounded-2xl border p-5 ${isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200'}`}>
        <h3 className={`text-sm font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          آخر المكالمات الصادرة
        </h3>

        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-gray-500" /></div>
        ) : calls.length === 0 ? (
          <div className={`text-center py-6 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
            <PhoneOutgoing className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">لا توجد مكالمات صادرة بعد</p>
          </div>
        ) : (
          <div className="space-y-2">
            {calls.slice(0, 10).map(call => {
              const r = RESULT_LABELS[call.callResult] || null;
              return (
                <div key={call._id || call.roomName} className={`flex items-center justify-between p-3 rounded-xl ${isDark ? 'bg-[#0a0a0b]' : 'bg-gray-50'}`}>
                  <div className="flex items-center gap-3">
                    <PhoneOutgoing className={`w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                    <div>
                      <p className={`text-sm font-mono ${isDark ? 'text-white' : 'text-gray-900'}`} dir="ltr">
                        {call.destination || call.metadata?.destination || '—'}
                      </p>
                      <p className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{fmtDate(call.startedAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{fmtDuration(call.durationSeconds)}</span>
                    {r && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        isDark ? `bg-${r.color}-500/10 text-${r.color}-400` : `bg-${r.color}-50 text-${r.color}-600`
                      }`}>{r.label}</span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      call.status === 'completed' ? (isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600')
                      : call.status === 'active' ? (isDark ? 'bg-yellow-500/10 text-yellow-400' : 'bg-yellow-50 text-yellow-600')
                      : (isDark ? 'bg-gray-500/10 text-gray-500' : 'bg-gray-100 text-gray-400')
                    }`}>
                      {call.status === 'completed' ? 'مكتملة' : call.status === 'active' ? 'نشطة' : call.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// Tab: Chat Test
// ══════════════════════════════════════════════════════
function ChatTab({ agent, isDark }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const userMsg = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setSending(true);

    try {
      const res = await chatWithAgent(agent.id, newMessages);
      if (res.success && res.reply) {
        setMessages(prev => [...prev, { role: 'assistant', content: res.reply }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ فشل الاتصال بالمساعد. تأكد من إعداد OPENAI_API_KEY في الباك اند.' }]);
    } finally {
      setSending(false);
    }
  };

  const handleReset = () => {
    setMessages([]);
    setInput('');
  };

  return (
    <Section isDark={isDark}>
      {/* Chat header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${isDark ? 'bg-[#1a1a1d]' : 'bg-gray-50'}`}>
            {agent.avatar || '🤖'}
          </div>
          <div>
            <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
              محادثة مع {agent.name}
            </h3>
            <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              اختبر شخصية المساعد بالكتابة
            </p>
          </div>
        </div>
        <button
          onClick={handleReset}
          className={`p-2 rounded-lg text-sm ${isDark ? 'text-gray-500 hover:text-gray-300 hover:bg-[#1a1a1d]' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
          title="مسح المحادثة"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className={`h-[400px] overflow-y-auto rounded-xl p-4 mb-3 space-y-3 ${
        isDark ? 'bg-[#0a0a0b] border border-[#1f1f23]' : 'bg-gray-50 border border-gray-200'
      }`}>
        {messages.length === 0 && (
          <div className={`text-center py-16 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
            <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">ابدأ بكتابة رسالة لاختبار المساعد</p>
            <p className="text-xs mt-1 opacity-75">المساعد يستخدم نفس الشخصية والإعدادات المحددة</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
              msg.role === 'user'
                ? isDark ? 'bg-teal-500/10 text-teal-100 border border-teal-500/20' : 'bg-teal-50 text-teal-900 border border-teal-200'
                : isDark ? 'bg-[#1a1a1d] text-gray-300 border border-[#2a2a2e]' : 'bg-white text-gray-700 border border-gray-200'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-end">
            <div className={`px-4 py-2.5 rounded-2xl ${isDark ? 'bg-[#1a1a1d] border border-[#2a2a2e]' : 'bg-white border border-gray-200'}`}>
              <Loader2 className={`w-4 h-4 animate-spin ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
            </div>
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="اكتب رسالتك..."
          className={`flex-1 px-4 py-2.5 rounded-xl border text-sm ${
            isDark
              ? 'bg-[#0a0a0b] border-[#1f1f23] text-white placeholder:text-gray-600 focus:border-teal-500/50'
              : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-teal-500'
          } focus:outline-none focus:ring-1 focus:ring-teal-500/30`}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-l from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white transition-all disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </Section>
  );
}

// ══════════════════════════════════════════════════════
// Main Page
// ══════════════════════════════════════════════════════
export default function AgentSettingsPage() {
  const { isDark } = useTheme();
  const { t, isAr } = useLanguage();
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [suggesting, setSuggesting] = useState(false);

  // Tab from URL or default
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabParam || 'basic');

  const isOutbound = agent?.callDirection === 'outbound' || agent?.callDirection === 'both';

  const TABS = [
    { key: 'basic',       label: 'أساسي',    icon: User },
    { key: 'personality', label: 'الشخصية',  icon: Bot },
    { key: 'voice',       label: 'الصوت',    icon: Volume2 },
    { key: 'advanced',    label: 'متقدم',    icon: Settings },
    { key: 'phone',       label: 'الهاتف',   icon: Phone },
    ...(isOutbound ? [{ key: 'outbound', label: 'الصادرة', icon: PhoneOutgoing }] : []),
    { key: 'chat',        label: 'المحادثة', icon: MessageSquare },
  ];

  // ── Load agent ──
  const loadAgent = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAgent(id);
      if (res.success) {
        setAgent(res.agent);
      } else {
        setError('فشل تحميل المساعد');
      }
    } catch (err) {
      setError(err.message || 'فشل تحميل المساعد');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadAgent(); }, [loadAgent]);

  // ── Save agent ──
  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await updateAgent(id, agent);
      if (res.success) {
        setAgent(res.agent);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError(res.message || 'فشل الحفظ');
      }
    } catch (err) {
      setError(err.message || 'فشل الحفظ');
    } finally {
      setSaving(false);
    }
  };

  // ── Suggest content ──
  const handleSuggest = async (type) => {
    setSuggesting(true);
    try {
      const res = await suggestContent({
        role: agent.personality?.role,
        companyName: agent.personality?.companyName,
        type,
      });
      if (res.success && res.suggestions) {
        if (type === 'greeting') {
          const lines = res.suggestions.split('\n').filter(l => l.trim());
          if (lines[0]) setAgent(p => ({ ...p, greeting: lines[0].replace(/^\d+[\.\)]\s*/, '') }));
        } else {
          setAgent(p => ({
            ...p,
            personality: { ...p.personality, additionalInstructions: res.suggestions }
          }));
        }
      }
    } catch (err) {
      setError('فشل توليد الاقتراحات');
    } finally {
      setSuggesting(false);
    }
  };

  // ── Loading / Error ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-teal-500' : 'text-teal-600'}`} />
      </div>
    );
  }
  if (!agent) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 mx-auto mb-3 text-red-400" />
          <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>{error || 'المساعد غير موجود'}</p>
          <button onClick={() => navigate('/agents')} className="mt-4 text-teal-500 text-sm hover:underline">العودة للقائمة</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6" dir="rtl">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/agents')}
            className={`p-2 rounded-xl border transition-colors ${isDark ? 'border-[#1f1f23] text-gray-400 hover:text-white' : 'border-gray-200 text-gray-400 hover:text-gray-700'}`}
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${isDark ? 'bg-[#1a1a1d]' : 'bg-gray-50'}`}>
            {agent.avatar || '🤖'}
          </div>
          <div>
            <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {agent.name}
            </h1>
            <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              آخر تعديل: {new Date(agent.updatedAt).toLocaleDateString('ar-SA')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-400">
              <CheckCircle className="w-4 h-4" /> تم الحفظ
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-l from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white font-bold rounded-xl transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            حفظ
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className={`flex items-center gap-3 p-4 rounded-xl mb-4 ${isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <span className={`text-sm ${isDark ? 'text-red-400' : 'text-red-600'}`}>{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className={`flex gap-1 rounded-xl border p-1 mb-6 overflow-x-auto ${isDark ? 'border-[#1f1f23] bg-[#0a0a0b]' : 'border-gray-200 bg-gray-50'}`}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.key
                  ? isDark ? 'bg-[#1a1a1d] text-white shadow-sm' : 'bg-white text-gray-900 shadow-sm'
                  : isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="max-w-3xl">
        {activeTab === 'basic' && <BasicTab agent={agent} setAgent={setAgent} isDark={isDark} />}
        {activeTab === 'personality' && <PersonalityTab agent={agent} setAgent={setAgent} isDark={isDark} onSuggest={handleSuggest} suggesting={suggesting} />}
        {activeTab === 'voice' && <VoiceTab agent={agent} setAgent={setAgent} isDark={isDark} />}
        {activeTab === 'advanced' && <AdvancedTab agent={agent} setAgent={setAgent} isDark={isDark} />}
        {activeTab === 'phone' && <PhoneTab agent={agent} setAgent={setAgent} isDark={isDark} onSave={async (fields) => {
          try {
            const res = await updateAgent(id, fields);
            if (res.success) setAgent(res.agent);
          } catch (e) {
            console.error('Phone save failed:', e);
          }
        }} />}
        {activeTab === 'outbound' && <OutboundTab agent={agent} isDark={isDark} />}
        {activeTab === 'chat' && <ChatTab agent={agent} isDark={isDark} />}
      </div>
    </div>
  );
}