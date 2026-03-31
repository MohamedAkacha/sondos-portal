// =====================================================
// Campaigns Page — حملات المكالمات الصادرة
// ─────────────────────────────────────────────────────
// List + Create + Monitor + Results
// =====================================================
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  PhoneOutgoing, Plus, Loader2, AlertCircle, RefreshCw,
  Play, Pause, Trash2, BarChart3, Users, CheckCircle,
  XCircle, Clock, ChevronRight, Upload, Bot, Phone,
  Calendar, Target, ArrowLeft,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { campaignAPI } from "@/services/api/campaignAPI";
import { listAgents } from "@/services/api/agentAPI";
import { phoneAPI } from "@/services/api/phoneAPI";

// ── Status Config ──
const STATUS_CONFIG = {
  draft:     { label: 'مسودة',   color: 'gray',    icon: Clock },
  active:    { label: 'نشطة',    color: 'emerald',  icon: Play },
  paused:    { label: 'متوقفة',  color: 'amber',   icon: Pause },
  completed: { label: 'مكتملة',  color: 'blue',    icon: CheckCircle },
  cancelled: { label: 'ملغاة',   color: 'red',     icon: XCircle },
};

const RESULT_COLORS = {
  succeeded: 'emerald',
  refused: 'red',
  callbackRequested: 'amber',
  noAnswer: 'gray',
  errors: 'red',
};

// ══════════════════════════════════════════════════════
// Create Campaign Modal
// ══════════════════════════════════════════════════════
function CreateCampaignModal({ isDark, onClose, onCreate }) {
  const [agents, setAgents] = useState([]);
  const [phones, setPhones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState(1); // 1: basics, 2: contacts, 3: schedule

  const [form, setForm] = useState({
    name: '',
    description: '',
    agentId: '',
    phoneNumberId: '',
    contactsText: '',
    schedule: {
      dailyStartHour: 9,
      dailyEndHour: 18,
      timezone: 'Asia/Riyadh',
      activeDays: [0, 1, 2, 3, 4],
    },
    settings: {
      maxRetries: 2,
      retryIntervalMinutes: 60,
      delayBetweenCallsSeconds: 10,
    },
  });

  useEffect(() => {
    const load = async () => {
      try {
        const [agRes, phRes] = await Promise.all([listAgents(), phoneAPI.list()]);
        const outboundAgents = (agRes.agents || []).filter(a => a.callDirection === 'outbound' || a.callDirection === 'both');
        setAgents(outboundAgents);
        setPhones((phRes.phones || []).filter(p => p.status === 'active'));
      } catch (e) {
        console.error('Load failed:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const parseContacts = (text) => {
    return text.split('\n').map(line => {
      const trimmed = line.trim();
      if (!trimmed) return null;
      // Format: +966501234567,اسم العميل  OR  +966501234567
      const parts = trimmed.split(/[,\t;]/);
      const phone = (parts[0] || '').trim();
      const name = (parts[1] || '').trim();
      if (!phone) return null;
      return { phone: phone.startsWith('+') ? phone : `+${phone}`, name };
    }).filter(Boolean);
  };

  const contacts = parseContacts(form.contactsText);

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await campaignAPI.create({
        ...form,
        contacts,
      });
      if (res.success) {
        onCreate(res.campaign);
      } else {
        setError(res.message);
      }
    } catch (e) {
      setError(e.message || 'فشل إنشاء الحملة');
    } finally {
      setCreating(false);
    }
  };

  const ic = `w-full px-4 py-2.5 rounded-xl border text-sm ${isDark ? 'bg-[#0a0a0b] border-[#1f1f23] text-white' : 'bg-gray-50 border-gray-200'}`;
  const lc = `block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto ${isDark ? 'bg-[#111113] border border-[#1f1f23]' : 'bg-white border border-gray-200'}`} dir="rtl">
        <div className="flex items-center justify-between mb-5">
          <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            📢 حملة جديدة
          </h2>
          <button onClick={onClose} className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>✕</button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2, 3].map(s => (
            <div key={s} className={`flex-1 h-1 rounded-full ${step >= s ? 'bg-teal-500' : isDark ? 'bg-[#1f1f23]' : 'bg-gray-200'}`} />
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-500" /></div>
        ) : (
          <>
            {/* Step 1: Basics */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className={lc}>اسم الحملة *</label>
                  <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="حملة تأكيد المواعيد — مارس 2026" className={ic} />
                </div>
                <div>
                  <label className={lc}>الوصف</label>
                  <input type="text" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="اختياري" className={ic} />
                </div>
                <div>
                  <label className={lc}>المساعد *</label>
                  <select value={form.agentId} onChange={e => setForm(p => ({ ...p, agentId: e.target.value }))} className={ic}>
                    <option value="">— اختر مساعد —</option>
                    {agents.map(a => (
                      <option key={a.id} value={a.id}>{a.avatar} {a.name} ({a.callDirection === 'both' ? 'ثنائي' : 'صادرة'})</option>
                    ))}
                  </select>
                  {agents.length === 0 && (
                    <p className={`text-xs mt-1 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                      ⚠ لا يوجد مساعد يدعم المكالمات الصادرة — أنشئ واحد أولاً
                    </p>
                  )}
                </div>
                <div>
                  <label className={lc}>رقم الهاتف (Caller ID) *</label>
                  <select value={form.phoneNumberId} onChange={e => setForm(p => ({ ...p, phoneNumberId: e.target.value }))} className={ic}>
                    <option value="">— اختر رقم —</option>
                    {phones.map(p => (
                      <option key={p.id} value={p.id}>{p.phoneNumber} {p.friendlyName ? `(${p.friendlyName})` : ''}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Step 2: Contacts */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <label className={lc}>جهات الاتصال *</label>
                  <p className={`text-xs mb-2 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                    رقم واحد في كل سطر — يمكن إضافة الاسم بعد فاصلة
                  </p>
                  <textarea
                    rows={10}
                    value={form.contactsText}
                    onChange={e => setForm(p => ({ ...p, contactsText: e.target.value }))}
                    placeholder={`+966501234567,أحمد محمد\n+966502345678,سارة علي\n+966503456789`}
                    dir="ltr"
                    className={`w-full px-4 py-3 rounded-xl border text-sm font-mono resize-none ${isDark ? 'bg-[#0a0a0b] border-[#1f1f23] text-white placeholder:text-gray-600' : 'bg-gray-50 border-gray-200 placeholder:text-gray-400'}`}
                  />
                  <p className={`text-xs mt-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    {contacts.length > 0 ? (
                      <span className="text-teal-400">✓ {contacts.length} جهة اتصال صالحة</span>
                    ) : (
                      'أدخل أرقام هاتف بصيغة دولية'
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* Step 3: Schedule & Settings */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lc}>بداية الاتصال اليومي</label>
                    <select value={form.schedule.dailyStartHour} onChange={e => setForm(p => ({ ...p, schedule: { ...p.schedule, dailyStartHour: parseInt(e.target.value) } }))} className={ic}>
                      {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{i}:00</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lc}>نهاية الاتصال اليومي</label>
                    <select value={form.schedule.dailyEndHour} onChange={e => setForm(p => ({ ...p, schedule: { ...p.schedule, dailyEndHour: parseInt(e.target.value) } }))} className={ic}>
                      {Array.from({ length: 24 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}:00</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lc}>عدد المحاولات</label>
                    <select value={form.settings.maxRetries} onChange={e => setForm(p => ({ ...p, settings: { ...p.settings, maxRetries: parseInt(e.target.value) } }))} className={ic}>
                      {[0, 1, 2, 3, 5].map(n => <option key={n} value={n}>{n === 0 ? 'بدون' : n}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lc}>الفترة بين المحاولات</label>
                    <select value={form.settings.retryIntervalMinutes} onChange={e => setForm(p => ({ ...p, settings: { ...p.settings, retryIntervalMinutes: parseInt(e.target.value) } }))} className={ic}>
                      <option value={30}>٣٠ دقيقة</option>
                      <option value={60}>ساعة</option>
                      <option value={120}>ساعتين</option>
                      <option value={360}>٦ ساعات</option>
                    </select>
                  </div>
                </div>

                {/* Summary */}
                <div className={`p-4 rounded-xl ${isDark ? 'bg-[#0a0a0b] border border-[#1f1f23]' : 'bg-gray-50 border border-gray-200'}`}>
                  <p className={`text-sm font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>ملخص الحملة</p>
                  <div className={`text-xs space-y-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    <p>الاسم: <strong>{form.name || '—'}</strong></p>
                    <p>جهات الاتصال: <strong>{contacts.length}</strong></p>
                    <p>ساعات الاتصال: <strong>{form.schedule.dailyStartHour}:00 — {form.schedule.dailyEndHour}:00</strong></p>
                    <p>المحاولات: <strong>{form.settings.maxRetries} / كل {form.settings.retryIntervalMinutes} دقيقة</strong></p>
                  </div>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className={`flex items-center gap-2 p-3 rounded-xl mt-4 text-xs ${isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600'}`}>
                <AlertCircle className="w-3.5 h-3.5" /> {error}
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-6">
              <button
                onClick={() => step === 1 ? onClose() : setStep(step - 1)}
                className={`px-4 py-2 rounded-xl text-sm ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {step === 1 ? 'إلغاء' : '← السابق'}
              </button>
              {step < 3 ? (
                <button
                  onClick={() => setStep(step + 1)}
                  disabled={step === 1 ? (!form.name || !form.agentId || !form.phoneNumberId) : contacts.length === 0}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold bg-teal-500 hover:bg-teal-400 text-white disabled:opacity-50"
                >
                  التالي →
                </button>
              ) : (
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-l from-teal-500 to-cyan-500 text-white disabled:opacity-50"
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <PhoneOutgoing className="w-4 h-4" />}
                  إنشاء وبدء الحملة
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// Campaign Card
// ══════════════════════════════════════════════════════
function CampaignCard({ campaign, isDark, onAction, onSelect }) {
  const cfg = STATUS_CONFIG[campaign.status] || STATUS_CONFIG.draft;
  const Icon = cfg.icon;
  const r = campaign.results || {};
  const progress = campaign.progress || 0;

  return (
    <div
      onClick={() => onSelect(campaign)}
      className={`rounded-2xl border p-5 cursor-pointer transition-all hover:shadow-lg ${
        isDark ? 'bg-[#111113] border-[#1f1f23] hover:border-[#2a2a2e]' : 'bg-white border-gray-200 hover:border-gray-300'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{campaign.name}</h3>
          {campaign.agent && (
            <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              {campaign.agent.avatar} {campaign.agent.name}
            </p>
          )}
        </div>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
          isDark ? `bg-${cfg.color}-500/10 text-${cfg.color}-400` : `bg-${cfg.color}-50 text-${cfg.color}-600`
        }`}>
          <Icon className="w-3 h-3" /> {cfg.label}
        </span>
      </div>

      {/* Progress Bar */}
      <div className={`w-full h-2 rounded-full mb-3 ${isDark ? 'bg-[#1a1a1d]' : 'bg-gray-100'}`}>
        <div
          className="h-full rounded-full bg-gradient-to-l from-teal-500 to-cyan-500 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Stats */}
      <div className={`flex items-center justify-between text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
        <div className="flex items-center gap-3">
          <span><Users className="w-3 h-3 inline" /> {campaign.contactsCount || 0}</span>
          <span className="text-emerald-400">{r.succeeded || 0} نجح</span>
          <span className="text-red-400">{r.refused || 0} رفض</span>
          <span>{r.noAnswer || 0} لم يرد</span>
        </div>
        <span>{progress}%</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-4">
        {campaign.status === 'draft' && (
          <button onClick={e => { e.stopPropagation(); onAction('start', campaign.id); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20">
            <Play className="w-3 h-3" /> بدء
          </button>
        )}
        {campaign.status === 'active' && (
          <button onClick={e => { e.stopPropagation(); onAction('pause', campaign.id); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-400 hover:bg-amber-500/20">
            <Pause className="w-3 h-3" /> إيقاف
          </button>
        )}
        {campaign.status === 'paused' && (
          <button onClick={e => { e.stopPropagation(); onAction('start', campaign.id); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20">
            <Play className="w-3 h-3" /> استئناف
          </button>
        )}
        {campaign.status !== 'active' && (
          <button onClick={e => { e.stopPropagation(); onAction('delete', campaign.id); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10">
            <Trash2 className="w-3 h-3" /> حذف
          </button>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// Campaign Detail View
// ══════════════════════════════════════════════════════
function CampaignDetail({ campaignId, isDark, onBack }) {
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await campaignAPI.results(campaignId);
        setCampaign(res);
      } catch (e) {
        console.error('Failed to load campaign:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 15000); // Auto-refresh
    return () => clearInterval(interval);
  }, [campaignId]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-500" /></div>;
  if (!campaign) return <p className="text-center text-gray-500">الحملة غير موجودة</p>;

  const r = campaign.results || {};
  const contacts = campaign.contacts || [];
  const cfg = STATUS_CONFIG[campaign.campaign?.status] || STATUS_CONFIG.draft;

  const RESULT_LABELS = {
    succeeded: { label: 'نجحت', emoji: '✅' },
    refused: { label: 'رفض', emoji: '❌' },
    callback_requested: { label: 'طلب معاودة', emoji: '📞' },
    no_answer: { label: 'لم يرد', emoji: '📵' },
    error: { label: 'خطأ', emoji: '⚠️' },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className={`p-2 rounded-xl ${isDark ? 'hover:bg-[#1a1a1d]' : 'hover:bg-gray-100'}`}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{campaign.campaign?.name}</h2>
          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            {campaign.campaign?.agent?.avatar} {campaign.campaign?.agent?.name} • {campaign.campaign?.phone?.phoneNumber}
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'الإجمالي', value: r.totalContacts || 0, color: 'teal' },
          { label: 'رد', value: r.answered || 0, color: 'blue' },
          { label: 'نجح', value: r.succeeded || 0, color: 'emerald' },
          { label: 'رفض', value: r.refused || 0, color: 'red' },
        ].map(k => (
          <div key={k.label} className={`rounded-xl border p-4 text-center ${isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200'}`}>
            <p className={`text-2xl font-bold text-${k.color}-400`}>{k.value}</p>
            <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{k.label}</p>
          </div>
        ))}
      </div>

      {/* Progress */}
      <div className={`rounded-xl border p-4 ${isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center justify-between mb-2">
          <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>التقدم</span>
          <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{campaign.progress || 0}%</span>
        </div>
        <div className={`w-full h-3 rounded-full ${isDark ? 'bg-[#1a1a1d]' : 'bg-gray-100'}`}>
          <div className="h-full rounded-full bg-gradient-to-l from-teal-500 to-cyan-500 transition-all" style={{ width: `${campaign.progress || 0}%` }} />
        </div>
        <div className={`flex items-center justify-between mt-2 text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
          <span>{r.called || 0} / {r.totalContacts || 0} تم الاتصال</span>
          <span>{r.noAnswer || 0} لم يرد • {r.callbackRequested || 0} طلب معاودة</span>
        </div>
      </div>

      {/* Contacts List */}
      <div className={`rounded-xl border ${isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200'}`}>
        <div className="p-4 border-b ${isDark ? 'border-[#1f1f23]' : 'border-gray-100'}">
          <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            جهات الاتصال ({contacts.length})
          </h3>
        </div>
        <div className="divide-y ${isDark ? 'divide-[#1f1f23]' : 'divide-gray-100'}">
          {contacts.slice(0, 50).map((c, i) => {
            const rl = RESULT_LABELS[c.callResult] || null;
            return (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm">{rl?.emoji || '⏳'}</span>
                  <div>
                    <p className={`text-sm font-mono ${isDark ? 'text-white' : 'text-gray-900'}`} dir="ltr">{c.phone}</p>
                    {c.name && <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{c.name}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {c.attempts > 0 && (
                    <span className={isDark ? 'text-gray-600' : 'text-gray-400'}>
                      {c.attempts} محاولة
                    </span>
                  )}
                  {c.durationSeconds > 0 && (
                    <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>
                      {Math.floor(c.durationSeconds / 60)}:{(c.durationSeconds % 60).toString().padStart(2, '0')}
                    </span>
                  )}
                  <span className={`px-2 py-0.5 rounded-full ${
                    c.status === 'completed' ? (isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600')
                    : c.status === 'calling' ? (isDark ? 'bg-yellow-500/10 text-yellow-400' : 'bg-yellow-50 text-yellow-600')
                    : c.status === 'failed' ? (isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600')
                    : (isDark ? 'bg-gray-500/10 text-gray-500' : 'bg-gray-100 text-gray-400')
                  }`}>
                    {rl?.label || c.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// Main Page
// ══════════════════════════════════════════════════════
export default function CampaignsPage() {
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');

  const loadCampaigns = useCallback(async () => {
    try {
      const res = await campaignAPI.list(filterStatus !== 'all' ? filterStatus : undefined);
      setCampaigns(res.campaigns || []);
    } catch (e) {
      console.error('Failed to load campaigns:', e);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

  const handleAction = async (action, id) => {
    try {
      if (action === 'start') await campaignAPI.start(id);
      else if (action === 'pause') await campaignAPI.pause(id);
      else if (action === 'delete') {
        if (!confirm('هل تريد حذف هذه الحملة؟')) return;
        await campaignAPI.delete(id);
      }
      await loadCampaigns();
    } catch (e) {
      console.error(`Action ${action} failed:`, e);
    }
  };

  // Detail view
  if (selectedCampaign) {
    return (
      <div className="min-h-screen p-4 md:p-6" dir="rtl">
        <CampaignDetail
          campaignId={selectedCampaign.id}
          isDark={isDark}
          onBack={() => { setSelectedCampaign(null); loadCampaigns(); }}
        />
      </div>
    );
  }

  const filtered = filterStatus === 'all' ? campaigns : campaigns.filter(c => c.status === filterStatus);
  const activeCampaigns = campaigns.filter(c => c.status === 'active').length;

  return (
    <div className="min-h-screen p-4 md:p-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            📢 حملات المكالمات
          </h1>
          <p className={`text-sm mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            اتصل بعملائك تلقائياً — إنشاء حملة، رفع أرقام، وابدأ
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadCampaigns} className={`p-2.5 rounded-xl border ${isDark ? 'border-[#1f1f23] text-gray-500 hover:text-white' : 'border-gray-200 text-gray-400 hover:text-gray-700'}`}>
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-l from-teal-500 to-cyan-500 text-white hover:from-teal-400 hover:to-cyan-400">
            <Plus className="w-4 h-4" /> حملة جديدة
          </button>
        </div>
      </div>

      {/* Active campaigns banner */}
      {activeCampaigns > 0 && (
        <div className={`flex items-center gap-3 p-4 rounded-xl mb-6 ${isDark ? 'bg-emerald-500/5 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-200'}`}>
          <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
          <p className={`text-sm ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
            {activeCampaigns} حملة نشطة الآن — المكالمات جارية
          </p>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto">
        {[
          { key: 'all', label: 'الكل' },
          { key: 'active', label: 'نشطة' },
          { key: 'draft', label: 'مسودة' },
          { key: 'paused', label: 'متوقفة' },
          { key: 'completed', label: 'مكتملة' },
        ].map(f => (
          <button key={f.key} onClick={() => setFilterStatus(f.key)}
            className={`px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
              filterStatus === f.key
                ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30'
                : isDark ? 'text-gray-500 hover:text-white border border-[#1f1f23]' : 'text-gray-400 hover:text-gray-700 border border-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Campaign List */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-500" /></div>
      ) : filtered.length === 0 ? (
        <div className={`text-center py-16 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
          <PhoneOutgoing className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-lg font-medium">لا توجد حملات</p>
          <p className="text-sm mt-1">أنشئ حملة جديدة للبدء في الاتصال بعملائك</p>
          <button onClick={() => setShowCreate(true)}
            className="mt-4 px-6 py-2.5 rounded-xl text-sm font-bold bg-teal-500 hover:bg-teal-400 text-white">
            <Plus className="w-4 h-4 inline ml-2" /> إنشاء حملة
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map(c => (
            <CampaignCard
              key={c.id}
              campaign={c}
              isDark={isDark}
              onAction={handleAction}
              onSelect={setSelectedCampaign}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <CreateCampaignModal
          isDark={isDark}
          onClose={() => setShowCreate(false)}
          onCreate={(campaign) => {
            setShowCreate(false);
            loadCampaigns();
          }}
        />
      )}
    </div>
  );
}
