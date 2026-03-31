// =====================================================
// Campaign Model — حملات المكالمات الصادرة
// ─────────────────────────────────────────────────────
// Each campaign dials a list of contacts using an agent
// Tracks per-contact results and overall progress
// =====================================================
const mongoose = require('mongoose');

// ── Single Contact ──
const contactSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    trim: true,
  },
  name: {
    type: String,
    default: '',
    trim: true,
  },
  // ── Per-contact state ──
  status: {
    type: String,
    enum: ['pending', 'calling', 'completed', 'failed', 'skipped'],
    default: 'pending',
  },
  callResult: {
    type: String,
    enum: ['succeeded', 'refused', 'callback_requested', 'no_answer', 'error', null],
    default: null,
  },
  attempts: {
    type: Number,
    default: 0,
  },
  lastAttemptAt: {
    type: Date,
    default: null,
  },
  nextRetryAt: {
    type: Date,
    default: null,
  },
  durationSeconds: {
    type: Number,
    default: 0,
  },
  roomName: {
    type: String,
    default: '',
  },
  notes: {
    type: String,
    default: '',
  },
}, { _id: true });

// ── Campaign ──
const campaignSchema = new mongoose.Schema({
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
    required: true,
    index: true,
  },

  // ── Linked Phone Number (caller ID) ──
  phoneNumberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PhoneNumber',
    required: true,
  },

  // ── Campaign Info ──
  name: {
    type: String,
    required: [true, 'اسم الحملة مطلوب'],
    trim: true,
    maxlength: [200, 'اسم الحملة يجب أن يكون أقل من 200 حرف'],
  },
  description: {
    type: String,
    default: '',
    trim: true,
  },

  // ── Status ──
  status: {
    type: String,
    enum: ['draft', 'active', 'paused', 'completed', 'cancelled'],
    default: 'draft',
    index: true,
  },

  // ── Contacts ──
  contacts: [contactSchema],

  // ── Schedule ──
  schedule: {
    startAt: { type: Date, default: null },
    endAt: { type: Date, default: null },
    // Allowed calling hours (respect customer timezone)
    dailyStartHour: { type: Number, default: 9, min: 0, max: 23 },
    dailyEndHour: { type: Number, default: 18, min: 1, max: 24 },
    timezone: { type: String, default: 'Asia/Riyadh' },
    // Days of week (0=Sun, 6=Sat)
    activeDays: {
      type: [Number],
      default: [0, 1, 2, 3, 4], // Sun–Thu
    },
  },

  // ── Call Settings (inherited from agent but overridable) ──
  settings: {
    maxRetries: { type: Number, default: 2, min: 0, max: 10 },
    retryIntervalMinutes: { type: Number, default: 60, min: 5, max: 1440 },
    concurrentCalls: { type: Number, default: 1, min: 1, max: 5 },
    delayBetweenCallsSeconds: { type: Number, default: 10, min: 5, max: 300 },
  },

  // ── Aggregate Results (updated as calls complete) ──
  results: {
    totalContacts: { type: Number, default: 0 },
    called: { type: Number, default: 0 },
    answered: { type: Number, default: 0 },
    succeeded: { type: Number, default: 0 },
    refused: { type: Number, default: 0 },
    callbackRequested: { type: Number, default: 0 },
    noAnswer: { type: Number, default: 0 },
    errors: { type: Number, default: 0 },
    totalDurationSeconds: { type: Number, default: 0 },
  },

  // ── Execution Tracking ──
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  pausedAt: { type: Date, default: null },
  currentContactIndex: { type: Number, default: 0 },

}, {
  timestamps: true,
});

// ── Indexes ──
campaignSchema.index({ userId: 1, status: 1 });
campaignSchema.index({ userId: 1, createdAt: -1 });
campaignSchema.index({ status: 1, 'schedule.startAt': 1 });

// ── Virtual: progress percentage ──
campaignSchema.virtual('progress').get(function () {
  if (!this.results.totalContacts) return 0;
  return Math.round(this.results.called / this.results.totalContacts * 100);
});

// ── Virtual: is within schedule ──
campaignSchema.virtual('isWithinSchedule').get(function () {
  if (this.status !== 'active') return false;
  const now = new Date();
  if (this.schedule.startAt && now < this.schedule.startAt) return false;
  if (this.schedule.endAt && now > this.schedule.endAt) return false;

  try {
    const tz = this.schedule.timezone || 'Asia/Riyadh';
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit',
      weekday: 'short',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
    const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const weekday = parts.find(p => p.type === 'weekday')?.value;
    const dayNum = dayMap[weekday] ?? 0;

    if (!this.schedule.activeDays.includes(dayNum)) return false;
    if (hour < this.schedule.dailyStartHour || hour >= this.schedule.dailyEndHour) return false;
    return true;
  } catch {
    return true;
  }
});

// ── Pre-save: sync totalContacts ──
campaignSchema.pre('save', function (next) {
  if (this.isModified('contacts')) {
    this.results.totalContacts = this.contacts.length;
  }
  next();
});

// ── Public JSON ──
campaignSchema.methods.toPublicJSON = function () {
  return {
    id: this._id,
    userId: this.userId,
    agentId: this.agentId,
    phoneNumberId: this.phoneNumberId,
    name: this.name,
    description: this.description,
    status: this.status,
    contactsCount: this.contacts.length,
    schedule: this.schedule,
    settings: this.settings,
    results: this.results,
    progress: this.progress,
    startedAt: this.startedAt,
    completedAt: this.completedAt,
    pausedAt: this.pausedAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

// ── Ensure virtuals in JSON ──
campaignSchema.set('toJSON', { virtuals: true });
campaignSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Campaign', campaignSchema);
