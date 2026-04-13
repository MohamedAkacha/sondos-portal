// =====================================================
// Agent Model — المساعدين الأذكياء
// ─────────────────────────────────────────────────────
// Each user can create multiple agents
// Each agent has its own personality, voice, and config
// Settings flow: Agent DB → Room Metadata → Python Worker
// =====================================================
const mongoose = require('mongoose');

// ── Working Hours Schema ──
const workingHoursSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },
  timezone: { type: String, default: 'Asia/Riyadh' },
  schedule: {
    sunday:    { active: { type: Boolean, default: false }, start: { type: String, default: '09:00' }, end: { type: String, default: '17:00' } },
    monday:    { active: { type: Boolean, default: true },  start: { type: String, default: '09:00' }, end: { type: String, default: '17:00' } },
    tuesday:   { active: { type: Boolean, default: true },  start: { type: String, default: '09:00' }, end: { type: String, default: '17:00' } },
    wednesday: { active: { type: Boolean, default: true },  start: { type: String, default: '09:00' }, end: { type: String, default: '17:00' } },
    thursday:  { active: { type: Boolean, default: true },  start: { type: String, default: '09:00' }, end: { type: String, default: '17:00' } },
    friday:    { active: { type: Boolean, default: false }, start: { type: String, default: '09:00' }, end: { type: String, default: '17:00' } },
    saturday:  { active: { type: Boolean, default: false }, start: { type: String, default: '09:00' }, end: { type: String, default: '17:00' } },
  },
  offHoursMessage: { type: String, default: 'شكراً لاتصالك، نحن خارج ساعات العمل حالياً. سنعاود الاتصال بك في أقرب وقت.' },
}, { _id: false });

const agentSchema = new mongoose.Schema({
  // ── Owner ──
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  // ── Basic Info ──
  name: {
    type: String,
    required: [true, 'اسم المساعد مطلوب'],
    trim: true,
    maxlength: [100, 'اسم المساعد يجب أن يكون أقل من 100 حرف'],
  },
  description: {
    type: String,
    trim: true,
    default: '',
    maxlength: [500, 'الوصف يجب أن يكون أقل من 500 حرف'],
  },
  avatar: {
    type: String,
    default: '🤖',
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'draft'],
    default: 'draft',
    index: true,
  },

  // ── Call Direction ──
  callDirection: {
    type: String,
    enum: ['inbound', 'outbound', 'both'],
    default: 'inbound',
  },

  // ── Outbound Call Settings (used when callDirection is 'outbound' or 'both') ──
  outboundSettings: {
    objective: { type: String, default: '', trim: true },
    openingMessage: { type: String, default: '', trim: true },
    maxRetries: { type: Number, default: 2, min: 0, max: 10 },
    retryIntervalMinutes: { type: Number, default: 60, min: 5, max: 1440 },
    callResultOptions: {
      type: [String],
      default: ['succeeded', 'refused', 'callback_requested', 'no_answer'],
    },
  },

  // ── Linked Phone Number ──
  phoneNumberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PhoneNumber',
    default: null,
  },

  // ── Personality (Simple fields → auto-build system prompt) ──
  personality: {
    role: {
      type: String,
      enum: ['receptionist', 'sales', 'support', 'collections', 'booking', 'medical', 'custom'],
      default: 'receptionist',
    },
    companyName: { type: String, trim: true, default: '' },
    companyDescription: { type: String, trim: true, default: '' },
    speakingStyle: {
      type: String,
      enum: ['formal', 'friendly', 'professional'],
      default: 'professional',
    },
    additionalInstructions: { type: String, default: '' },
  },

  // ── Language ──
  language: {
    type: String,
    enum: ['ar', 'en', 'both'],
    default: 'ar',
  },

  // ── Greeting ──
  greeting: {
    type: String,
    default: 'أهلاً وسهلاً، كيف أقدر أساعدك؟',
    maxlength: [500, 'رسالة الترحيب يجب أن تكون أقل من 500 حرف'],
  },

  // ── System Prompt (auto-built from personality OR custom) ──
  systemPrompt: {
    type: String,
    default: '',
  },
  useCustomPrompt: {
    type: Boolean,
    default: false,
  },

  // ── Voice Settings ──
  voice: {
    provider: {
      type: String,
      enum: ['openai', 'elevenlabs'],
      default: 'openai',
    },
    model: { type: String, default: 'tts-1' },
    voiceId: { type: String, default: 'nova' },
    voiceName: { type: String, default: 'Nova (أنثى)' },
  },

  // ── AI / LLM Settings ──
  llm: {
    model: {
      type: String,
      default: 'gpt-5.4-mini',
    },
    temperature: {
      type: Number,
      default: 0.7,
      min: 0,
      max: 1,
    },
    intelligenceLevel: {
      type: String,
      enum: ['fast', 'balanced', 'smart'],
      default: 'balanced',
    },
  },

  // ── STT Settings ──
  stt: {
    provider: {
      type: String,
      enum: ['deepgram', 'openai', 'elevenlabs'],
      default: 'deepgram',
    },
    model: { type: String, default: 'nova-2' },
    language: { type: String, default: 'ar' },
  },

  // ── Working Hours ──
  workingHours: {
    type: workingHoursSchema,
    default: () => ({}),
  },

  // ── Limits ──
  maxCallDuration: {
    type: Number,
    default: 300,
    min: 30,
    max: 3600,
  },

  // ── Stats (updated by webhooks) ──
  stats: {
    totalCalls: { type: Number, default: 0 },
    totalDurationSeconds: { type: Number, default: 0 },
    lastCallAt: { type: Date, default: null },
  },

  // ══════════════════════════════════════════
  // v2 Fields — Tools, Knowledge, Extraction, Chat, Handoff
  // ══════════════════════════════════════════

  // ── Linked Tools (which tools this agent can call) ──
  toolIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tool',
  }],

  // ── Linked Knowledge Bases (for RAG search) ──
  knowledgeBaseIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'KnowledgeBase',
  }],

  // ── Chat Config (text chat settings) ──
  chatConfig: {
    enabled: { type: Boolean, default: false },
    widgetEnabled: { type: Boolean, default: false },
    widgetColor: { type: String, default: '#14b8a6' },
    widgetPosition: { type: String, enum: ['bottom-right', 'bottom-left'], default: 'bottom-right' },
    widgetGreeting: { type: String, default: '' },
    maxSessionMessages: { type: Number, default: 100 },
  },

  // ── Extraction Config (post-call variable extraction) ──
  extractionConfig: {
    enabled: { type: Boolean, default: false },
    variables: [{
      name: { type: String, required: true },
      type: { type: String, enum: ['string', 'number', 'boolean', 'date', 'email', 'phone'], default: 'string' },
      description: { type: String, default: '' },
      required: { type: Boolean, default: false },
      enumValues: [String],
    }],
    postExtractionWebhook: {
      enabled: { type: Boolean, default: false },
      url: { type: String, default: '' },
      headers: [{ key: String, value: String }],
    },
  },

  // ── Handoff Config (when to transfer to human) ──
  handoffConfig: {
    enabled: { type: Boolean, default: false },
    triggers: [{
      type: String,
      enum: ['customer_request', 'agent_unsure', 'negative_sentiment', 'max_turns', 'keyword'],
    }],
    maxTurnsBeforeHandoff: { type: Number, default: 10 },
    handoffKeywords: [String],
    handoffMessage: { type: String, default: 'سأحولك الآن لموظف مختص. يرجى الانتظار.' },
  },

  // ── Guardrails (content safety) ──
  guardrails: {
    enabled: { type: Boolean, default: false },
    blockedTopics: [String],
    maxResponseLength: { type: Number, default: 500 },
    requirePoliteness: { type: Boolean, default: true },
  },

  // ── Template used to create this agent ──
  templateId: {
    type: String,
    default: null,
  },

}, {
  timestamps: true,
});

// ── Indexes ──
agentSchema.index({ userId: 1, status: 1 });
agentSchema.index({ userId: 1, createdAt: -1 });

// ── Intelligence level → LLM model mapping ──
const INTELLIGENCE_MAP = {
  fast: 'gpt-5.4-nano',
  balanced: 'gpt-5.4-mini',
  smart: 'gpt-5.4',
};

// ── Role labels (Arabic) ──
const ROLE_LABELS = {
  receptionist: 'موظف استقبال',
  sales: 'مبيعات',
  support: 'دعم فني',
  collections: 'تحصيل',
  booking: 'حجوزات',
  medical: 'استشارات طبية',
  custom: 'مخصص',
};

// ── Style labels (Arabic) ──
const STYLE_LABELS = {
  formal: 'رسمي',
  friendly: 'ودود',
  professional: 'مهني',
};

// ── Auto-build system prompt from personality fields ──
agentSchema.methods.buildSystemPrompt = function () {
  if (this.useCustomPrompt && this.systemPrompt) {
    return this.systemPrompt;
  }

  const p = this.personality;
  const roleLabel = ROLE_LABELS[p.role] || 'مساعد';
  const styleLabel = STYLE_LABELS[p.speakingStyle] || 'مهني';
  const langInstruction = this.language === 'en'
    ? 'تحدث باللغة الإنجليزية فقط.'
    : this.language === 'both'
    ? 'تحدث باللغة التي يستخدمها العميل (عربي أو إنجليزي).'
    : 'تحدث باللغة العربية فقط.';

  let prompt = `أنت ${roleLabel} ذكي`;
  if (p.companyName) prompt += ` تعمل في ${p.companyName}`;
  if (p.companyDescription) prompt += ` — ${p.companyDescription}`;
  prompt += '.\n\n';

  prompt += `أسلوبك في الكلام: ${styleLabel}.\n`;
  prompt += `${langInstruction}\n`;
  prompt += 'استخدم ردود قصيرة ومباشرة مناسبة للمحادثات الصوتية.\n';
  prompt += 'لا تستخدم علامات الترقيم المعقدة أو النجوم أو الأقواس.\n';

  if (p.additionalInstructions) {
    prompt += `\nتعليمات إضافية:\n${p.additionalInstructions}\n`;
  }

  return prompt;
};

// ── Sync intelligence level → LLM model before save ──
agentSchema.pre('save', function (next) {
  if (this.isModified('llm.intelligenceLevel')) {
    this.llm.model = INTELLIGENCE_MAP[this.llm.intelligenceLevel] || 'gpt-5.4-mini';
  }
  // Auto-build system prompt if not using custom
  if (!this.useCustomPrompt) {
    this.systemPrompt = this.buildSystemPrompt();
  }
  next();
});

// ── Get config for LiveKit Room Metadata ──
agentSchema.methods.toLiveKitConfig = function () {
  // Check if currently within working hours
  const wh = this.workingHours;
  let isWithinWorkingHours = true;
  let offHoursMessage = '';

  if (wh?.enabled) {
    try {
      // Get current time in agent's timezone
      const tz = wh.timezone || 'Asia/Riyadh';
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      const parts = formatter.formatToParts(now);
      const weekday = parts.find(p => p.type === 'weekday')?.value?.toLowerCase();
      const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
      const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
      const currentMinutes = hour * 60 + minute;

      const daySchedule = wh.schedule?.[weekday];
      if (daySchedule && daySchedule.active) {
        const [startH, startM] = (daySchedule.start || '09:00').split(':').map(Number);
        const [endH, endM] = (daySchedule.end || '17:00').split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;
        isWithinWorkingHours = currentMinutes >= startMinutes && currentMinutes < endMinutes;
      } else {
        // Day not active
        isWithinWorkingHours = false;
      }
    } catch (e) {
      // If timezone calc fails, default to open
      isWithinWorkingHours = true;
    }
    offHoursMessage = wh.offHoursMessage || 'شكراً لاتصالك، نحن خارج ساعات العمل حالياً.';
  }

  return {
    sttProvider: this.stt.provider,
    sttModel: this.stt.model,
    sttLanguage: this.stt.language,
    llmModel: this.llm.model,
    llmTemperature: this.llm.temperature,
    ttsProvider: this.voice.provider,
    ttsModel: this.voice.model,
    ttsVoice: this.voice.voiceId,
    ttsLanguage: this.language === 'both' ? null : this.language,  // ar, en, or null (auto)
    systemPrompt: this.useCustomPrompt ? this.systemPrompt : this.buildSystemPrompt(),
    greeting: this.greeting,
    // Call direction — Python Worker uses this to adjust behavior
    callDirection: this.callDirection || 'inbound',
    // Outbound settings — Python Worker uses these for outbound calls
    outboundSettings: (this.callDirection === 'outbound' || this.callDirection === 'both') ? {
      objective: this.outboundSettings?.objective || '',
      openingMessage: this.outboundSettings?.openingMessage || this.greeting,
      maxRetries: this.outboundSettings?.maxRetries ?? 2,
      retryIntervalMinutes: this.outboundSettings?.retryIntervalMinutes ?? 60,
      callResultOptions: this.outboundSettings?.callResultOptions || ['succeeded', 'refused', 'callback_requested', 'no_answer'],
    } : null,
    // Working hours — Python Worker reads these to decide behavior
    workingHours: {
      enabled: !!wh?.enabled,
      isWithinWorkingHours,
      offHoursMessage,
      timezone: wh?.timezone || 'Asia/Riyadh',
      schedule: wh?.schedule || {},
    },
    // v2 — Tools, Knowledge, Extraction, Handoff, Guardrails
    toolIds: this.toolIds || [],
    knowledgeBaseIds: this.knowledgeBaseIds || [],
    extractionConfig: this.extractionConfig || { enabled: false },
    handoffConfig: this.handoffConfig || { enabled: false },
    guardrails: this.guardrails || { enabled: false },
    chatConfig: this.chatConfig || { enabled: false },
  };
};

// ── Public JSON (for frontend) ──
agentSchema.methods.toPublicJSON = function () {
  return {
    id: this._id,
    name: this.name,
    description: this.description,
    avatar: this.avatar,
    status: this.status,
    callDirection: this.callDirection,
    outboundSettings: this.outboundSettings,
    phoneNumberId: this.phoneNumberId,
    personality: this.personality,
    language: this.language,
    greeting: this.greeting,
    systemPrompt: this.systemPrompt,
    useCustomPrompt: this.useCustomPrompt,
    voice: this.voice,
    llm: this.llm,
    stt: this.stt,
    workingHours: this.workingHours,
    maxCallDuration: this.maxCallDuration,
    stats: this.stats,
    templateId: this.templateId,
    // v2 fields
    toolIds: this.toolIds,
    knowledgeBaseIds: this.knowledgeBaseIds,
    chatConfig: this.chatConfig,
    extractionConfig: this.extractionConfig,
    handoffConfig: this.handoffConfig,
    guardrails: this.guardrails,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('Agent', agentSchema);
