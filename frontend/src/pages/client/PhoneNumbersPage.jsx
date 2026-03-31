// =====================================================
// Phone Numbers Page — إدارة أرقام الهاتف
// ─────────────────────────────────────────────────────
// 3 modes: Buy from Twilio/Telnyx, Add custom SIP
// Link numbers to agents, manage SIP settings
// =====================================================
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Phone, Plus, Search, Loader2, AlertCircle, RefreshCw,
  MoreVertical, Trash2, Edit, Link2, Unlink, Settings,
  Globe, Bot, CheckCircle, XCircle, Clock, Wifi,
  PhoneIncoming, PhoneOutgoing, ShoppingCart, Server, AlertTriangle, Activity, Power, PowerOff, Eye,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { listAgents } from "@/services/api/agentAPI";
import { phoneAPI } from "@/services/api/phoneAPI";
import { useToast } from "@/components/ui/Toast";

// ── Country options ──
const COUNTRIES = [
  { code: 'SA', name: 'السعودية', flag: '🇸🇦', prefix: '+966' },
  { code: 'AE', name: 'الإمارات', flag: '🇦🇪', prefix: '+971' },
  { code: 'EG', name: 'مصر',     flag: '🇪🇬', prefix: '+20' },
  { code: 'US', name: 'أمريكا',   flag: '🇺🇸', prefix: '+1' },
  { code: 'GB', name: 'بريطانيا', flag: '🇬🇧', prefix: '+44' },
  { code: 'TR', name: 'تركيا',   flag: '🇹🇷', prefix: '+90' },
  { code: 'JO', name: 'الأردن',  flag: '🇯🇴', prefix: '+962' },
  { code: 'KW', name: 'الكويت',  flag: '🇰🇼', prefix: '+965' },
  { code: 'BH', name: 'البحرين', flag: '🇧🇭', prefix: '+973' },
  { code: 'QA', name: 'قطر',     flag: '🇶🇦', prefix: '+974' },
  { code: 'OM', name: 'عُمان',   flag: '🇴🇲', prefix: '+968' },
  { code: 'TN', name: 'تونس',   flag: '🇹🇳', prefix: '+216' },
];

// ── Status Config ──
const STATUS_CONFIG = {
  active:   { label: 'نشط',     color: 'emerald', icon: CheckCircle },
  inactive: { label: 'معطّل',   color: 'gray',    icon: XCircle },
  pending:  { label: 'قيد الإعداد', color: 'amber', icon: Clock },
  error:    { label: 'خطأ',     color: 'red',     icon: AlertCircle },
// ── Provider labels ──
const PROVIDER_LABELS = {
  twilio: { name: 'Twilio', icon: '📞', color: 'red' },
  telnyx: { name: 'Telnyx', icon: '🌐', color: 'blue' },
  custom: { name: 'SIP مخصص', icon: '🔧', color: 'purple' },
// ══════════════════════════════════════════════════════
// Status Badge
// ══════════════════════════════════════════════════════
function StatusBadge({ status, isDark }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  const colors = {
    emerald: isDark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border-emerald-200',
    gray:    isDark ? 'bg-gray-500/10 text-gray-400 border-gray-500/20'       : 'bg-gray-100 text-gray-600 border-gray-200',
    amber:   isDark ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'    : 'bg-amber-50 text-amber-600 border-amber-200',
    red:     isDark ? 'bg-red-500/10 text-red-400 border-red-500/20'          : 'bg-red-50 text-red-600 border-red-200',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${colors[cfg.color]}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

// ══════════════════════════════════════════════════════
// Inactive Agent Warning
// ══════════════════════════════════════════════════════
function InactiveAgentWarning({ agentId, agents, isDark }) {
  if (!agentId) return null;
  const agent = agents.find(a => a.id === agentId);
  if (!agent || agent.status === 'active') return null;
  return (
    <div className={`flex items-start gap-2 mt-2 p-2.5 rounded-lg text-xs ${
      isDark ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-200'
    }`}>
      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
      <div>
        <p className={isDark ? 'text-amber-300' : 'text-amber-700'}>
          هذا المساعد <strong>{agent.status === 'inactive' ? 'معطّل' : 'مسودة'}</strong> — المكالمات الواردة لن تُرد عليها.
        </p>
        <p className={`mt-0.5 ${isDark ? 'text-amber-400/70' : 'text-amber-600'}`}>
          فعّل المساعد أولاً من صفحة المساعدين.
        </p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// Phone Card
// ══════════════════════════════════════════════════════
function PhoneCard({ phone, isDark, agents, onUpdate, onDelete, onSetupSip, onToggle, onOutbound }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [changingAgent, setChangingAgent] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(phone.agent?.id || '');
  const [health, setHealth] = useState(null); // null = not checked, object = result
  const [checking, setChecking] = useState(false);
  const providerCfg = PROVIDER_LABELS[phone.provider] || PROVIDER_LABELS.custom;
  const country = COUNTRIES.find(c => c.code === phone.country);

  const handleAgentChange = async () => {
    setChangingAgent(true);
    try {
      await onUpdate(phone.id, { agentId: selectedAgent || null });
    } finally {
      setChangingAgent(false);
    }
  };

  const handleHealthCheck = async () => {
    setChecking(true);
    try {
      const res = await phoneAPI.healthCheck(phone.id);
      setHealth(res.health);
    } catch (err) {
      setHealth({ overall: 'error' });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className={`rounded-2xl border p-5 transition-all ${
      isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200'
    }`}>

      {/* Top row: Number + Status + Menu */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">{country?.flag || '📱'}</span>
            <h3 className={`font-bold text-lg font-mono tracking-wide ${isDark ? 'text-white' : 'text-gray-900'}`} dir="ltr">
              {phone.phoneNumber}
            </h3>
          </div>
          {phone.friendlyName && phone.friendlyName !== phone.phoneNumber && (
            <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              {phone.friendlyName}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={phone.status} isDark={isDark} />
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-[#1f1f23] text-gray-500' : 'hover:bg-gray-100 text-gray-400'}`}
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className={`absolute left-0 top-8 z-20 w-48 rounded-xl border shadow-xl py-1.5 ${
                  isDark ? 'bg-[#1a1a1d] border-[#2a2a2e]' : 'bg-white border-gray-200'
                }`} dir="rtl">
                  {phone.status === 'pending' && (
                    <button onClick={() => { onSetupSip(phone); setMenuOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm ${isDark ? 'text-gray-300 hover:bg-[#1f1f23]' : 'text-gray-700 hover:bg-gray-50'}`}>
                      <Wifi className="w-4 h-4" /> إعادة إعداد SIP
                    </button>
                  )}
                  {phone.sipTrunkId && (
                    <button onClick={() => { handleHealthCheck(); setMenuOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm ${isDark ? 'text-gray-300 hover:bg-[#1f1f23]' : 'text-gray-700 hover:bg-gray-50'}`}>
                      <Activity className="w-4 h-4" /> فحص الاتصال
                    </button>
                  )}
                  {(phone.status === 'active' || phone.status === 'inactive') && phone.sipTrunkId && (
                    <button onClick={() => { onToggle(phone); setMenuOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm ${
                        phone.status === 'active'
                          ? 'text-amber-400 hover:bg-amber-500/10'
                          : isDark ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-emerald-600 hover:bg-emerald-50'
                      }`}>
                      {phone.status === 'active'
                        ? <><PowerOff className="w-4 h-4" /> تعطيل الرقم مؤقتاً</>
                        : <><Power className="w-4 h-4" /> تفعيل الرقم</>
                      }
                    </button>
                  )}
                  {phone.status === 'active' && phone.agentId && (
                    <button onClick={() => { onOutbound(phone); setMenuOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm ${isDark ? 'text-teal-400 hover:bg-teal-500/10' : 'text-teal-600 hover:bg-teal-50'}`}>
                      <PhoneOutgoing className="w-4 h-4" /> مكالمة صادرة
                    </button>
                  )}
                  <div className={`my-1.5 border-t ${isDark ? 'border-[#2a2a2e]' : 'border-gray-100'}`} />
                  <button onClick={() => { onDelete(phone); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10">
                    <Trash2 className="w-4 h-4" /> حذف الرقم
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Provider badge */}
      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs mb-3 ${
        isDark ? 'bg-[#1a1a1d] text-gray-400' : 'bg-gray-50 text-gray-500'
      }`}>
        <span>{providerCfg.icon}</span>
        {providerCfg.name}
      </div>

      {/* Agent link */}
      <div className={`rounded-xl border p-3 mb-3 ${isDark ? 'bg-[#0a0a0b] border-[#1f1f23]' : 'bg-gray-50 border-gray-200'}`}>
        <label className={`block text-xs font-medium mb-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          المساعد المربوط
        </label>
        <div className="flex items-center gap-2">
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            className={`flex-1 px-3 py-2 rounded-lg border text-sm ${
              isDark ? 'bg-[#111113] border-[#1f1f23] text-white' : 'bg-white border-gray-200 text-gray-900'
            }`}
          >
            <option value="">— بدون مساعد —</option>
            {agents.map(a => (
              <option key={a.id} value={a.id}>{a.avatar} {a.name}{a.status !== 'active' ? ` (${a.status === 'inactive' ? 'معطّل' : 'مسودة'})` : ''}</option>
            ))}
          </select>
          {selectedAgent !== (phone.agent?.id || '') && (
            <button
              onClick={handleAgentChange}
              disabled={changingAgent}
              className="px-3 py-2 rounded-lg text-xs font-medium bg-teal-500 hover:bg-teal-400 text-white transition-colors disabled:opacity-50"
            >
              {changingAgent ? <Loader2 className="w-3 h-3 animate-spin" /> : 'ربط'}
            </button>
          )}
        </div>
        <InactiveAgentWarning agentId={selectedAgent} agents={agents} isDark={isDark} />
        {phone.agent && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm">{phone.agent.avatar}</span>
            <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{phone.agent.name}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              phone.agent.status === 'active'
                ? 'bg-emerald-500/10 text-emerald-400'
                : isDark ? 'bg-gray-500/10 text-gray-500' : 'bg-gray-100 text-gray-400'
            }`}>
              {phone.agent.status === 'active' ? 'مفعّل' : 'معطّل'}
            </span>
          </div>
        )}
      </div>

      {/* Stats + View Calls */}
      <div className={`flex items-center gap-4 text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
        <div className="flex items-center gap-1.5">
          <PhoneIncoming className="w-3.5 h-3.5" />
          <span>{phone.stats?.totalCalls || 0} مكالمة</span>
        </div>
        {phone.stats?.totalCalls > 0 && (
          <button
            onClick={() => navigate(`/calls?phoneNumber=${encodeURIComponent(phone.phoneNumber)}`)}
            className={`flex items-center gap-1 hover:underline ${isDark ? 'text-teal-500 hover:text-teal-400' : 'text-teal-600 hover:text-teal-500'}`}
          >
            <Eye className="w-3 h-3" /> عرض المكالمات
          </button>
        )}
        {phone.statusMessage && (
          <span className="text-amber-400 truncate max-w-[200px]" title={phone.statusMessage}>
            ⚠️ {phone.statusMessage}
          </span>
        )}
      </div>

      {/* Health Check Result */}
      {(checking || health) && (
        <div className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
          checking ? (isDark ? 'bg-[#1a1a1d] text-gray-400' : 'bg-gray-50 text-gray-500')
          : health?.overall === 'healthy' ? (isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600')
          : health?.overall === 'no_agent' ? (isDark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-600')
          : (isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600')
        }`}>
          {checking ? (
            <><Loader2 className="w-3 h-3 animate-spin" /> جاري الفحص...</>
          ) : health?.overall === 'healthy' ? (
            <><CheckCircle className="w-3.5 h-3.5" /> SIP Trunk + Dispatch Rule يعملان بشكل سليم</>
          ) : health?.overall === 'no_agent' ? (
            <><AlertTriangle className="w-3.5 h-3.5" /> SIP يعمل لكن لا يوجد مساعد مربوط</>
          ) : health?.overall === 'rule_missing' ? (
            <><XCircle className="w-3.5 h-3.5" /> Dispatch Rule مفقود — أعد إعداد SIP</>
          ) : health?.overall === 'trunk_missing' ? (
            <><XCircle className="w-3.5 h-3.5" /> SIP Trunk مفقود — أعد إعداد SIP</>
          ) : health?.overall === 'not_configured' ? (
            <><XCircle className="w-3.5 h-3.5" /> SIP غير مُعد — اربط مساعد أولاً</>
          ) : health?.overall === 'livekit_unavailable' ? (
            <><XCircle className="w-3.5 h-3.5" /> LiveKit غير متاح</>
          ) : (
            <><XCircle className="w-3.5 h-3.5" /> فشل الفحص</>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// Add Number Modal
// ══════════════════════════════════════════════════════
function AddNumberModal({ isDark, agents, providers, onClose, onSuccess }) {
  const [mode, setMode] = useState(null); // 'buy' | 'custom'
  const [provider, setProvider] = useState('twilio');
  const [country, setCountry] = useState('SA');
  const [searchQuery, setSearchQuery] = useState('');
  const [availableNumbers, setAvailableNumbers] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  // Custom SIP fields
  const [customPhone, setCustomPhone] = useState('');
  const [customName, setCustomName] = useState('');
  const [sipServer, setSipServer] = useState('');
  const [sipUsername, setSipUsername] = useState('');
  const [sipPassword, setSipPassword] = useState('');

  // Search available numbers
  const handleSearch = async () => {
    setSearching(true);
    setError(null);
    try {
      const res = await phoneAPI.searchAvailable(provider, country, searchQuery);
      setAvailableNumbers(res.numbers || []);
      if (res.numbers?.length === 0) setError('لا توجد أرقام متاحة لهذا البلد');
    } catch (err) {
      setError(err.message || 'فشل البحث');
    } finally {
      setSearching(false);
    }
  };

  // Purchase number
  const handlePurchase = async () => {
    if (!selectedNumber) return;
    setCreating(true);
    setError(null);
    try {
      await phoneAPI.purchase({
        provider,
        phoneNumber: selectedNumber,
        agentId: selectedAgent || undefined,
        country,
      });
      onSuccess();
    } catch (err) {
      setError(err.message || 'فشل شراء الرقم');
    } finally {
      setCreating(false);
    }
  };

  // Add custom SIP
  const handleAddCustom = async () => {
    if (!customPhone) return;
    setCreating(true);
    setError(null);
    try {
      await phoneAPI.addCustom({
        phoneNumber: customPhone,
        friendlyName: customName || customPhone,
        agentId: selectedAgent || undefined,
        country,
        sipServer,
        sipUsername,
        sipPassword,
      });
      onSuccess();
    } catch (err) {
      setError(err.message || 'فشل إضافة الرقم');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto ${
        isDark ? 'bg-[#111113] border border-[#1f1f23]' : 'bg-white border border-gray-200'
      }`} dir="rtl">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            📱 إضافة رقم هاتف
          </h2>
          <button onClick={onClose} className={`text-sm ${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}>
            ✕
          </button>
        </div>

        {/* Mode Selection */}
        {!mode && (
          <div className="space-y-3">
            {/* Buy from provider — or show why it's unavailable */}
            {(providers?.twilio?.available || providers?.telnyx?.available) ? (
              <button
                onClick={() => setMode('buy')}
                className={`w-full p-4 rounded-xl border text-right transition-all ${
                  isDark ? 'border-[#1f1f23] hover:border-teal-500/30 hover:bg-teal-500/5' : 'border-gray-200 hover:border-teal-300 hover:bg-teal-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${isDark ? 'bg-[#1a1a1d]' : 'bg-gray-50'}`}>
                    🛒
                  </div>
                  <div>
                    <p className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>شراء رقم جديد</p>
                    <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      اشترِ رقم من {providers?.twilio?.available && providers?.telnyx?.available ? 'Twilio أو Telnyx' : providers?.twilio?.available ? 'Twilio' : 'Telnyx'} وربطه بمساعدك
                    </p>
                  </div>
                </div>
              </button>
            ) : (
              <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#0a0a0b] border-[#1f1f23]' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl opacity-40 ${isDark ? 'bg-[#1a1a1d]' : 'bg-gray-100'}`}>
                    🛒
                  </div>
                  <div className="flex-1">
                    <p className={`font-bold text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>شراء رقم جديد</p>
                    {!providers ? (
                      <p className={`text-xs mt-1 ${isDark ? 'text-amber-400/80' : 'text-amber-600'}`}>
                        ⚠️ فشل تحميل المزوّدين — تحقق من اتصالك وأعد المحاولة
                      </p>
                    ) : (
                      <div className={`text-xs mt-1.5 space-y-1`}>
                        {!providers?.twilio?.available && (
                          <p className="flex items-center gap-1.5">
                            <XCircle className={`w-3 h-3 ${isDark ? 'text-red-500/60' : 'text-red-400'}`} />
                            <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>Twilio: {providers?.twilio?.reason || 'مفاتيح API غير مُعدّة'}</span>
                          </p>
                        )}
                        {!providers?.telnyx?.available && (
                          <p className="flex items-center gap-1.5">
                            <XCircle className={`w-3 h-3 ${isDark ? 'text-red-500/60' : 'text-red-400'}`} />
                            <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>Telnyx: {providers?.telnyx?.reason || 'مفاتيح API غير مُعدّة'}</span>
                          </p>
                        )}
                        <p className={`mt-1.5 ${isDark ? 'text-teal-400/60' : 'text-teal-600'}`}>
                          أضف مفاتيح API في الإعدادات، أو استخدم "ربط رقم موجود" أدناه
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Custom SIP */}
            <button
              onClick={() => setMode('custom')}
              className={`w-full p-4 rounded-xl border text-right transition-all ${
                isDark ? 'border-[#1f1f23] hover:border-teal-500/30 hover:bg-teal-500/5' : 'border-gray-200 hover:border-teal-300 hover:bg-teal-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${isDark ? 'bg-[#1a1a1d]' : 'bg-gray-50'}`}>
                  🔧
                </div>
                <div>
                  <p className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>ربط رقم موجود (SIP)</p>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    عندك رقم مسبق؟ أدخل بيانات SIP Trunk وربطه بمساعدك
                  </p>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Buy Mode */}
        {mode === 'buy' && (
          <div className="space-y-4">
            <button onClick={() => setMode(null)} className={`text-xs ${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}>
              ← رجوع
            </button>

            {/* Provider */}
            <div>
              <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>المزوّد</label>
              <div className="flex gap-2">
                {providers?.twilio?.available && (
                  <button
                    onClick={() => setProvider('twilio')}
                    className={`flex-1 p-3 rounded-xl border text-sm text-center transition-all ${
                      provider === 'twilio' ? 'bg-teal-500/10 border-teal-500/30 text-teal-400' : isDark ? 'border-[#1f1f23] text-gray-400' : 'border-gray-200 text-gray-500'
                    }`}
                  >
                    📞 Twilio
                  </button>
                )}
                {providers?.telnyx?.available && (
                  <button
                    onClick={() => setProvider('telnyx')}
                    className={`flex-1 p-3 rounded-xl border text-sm text-center transition-all ${
                      provider === 'telnyx' ? 'bg-teal-500/10 border-teal-500/30 text-teal-400' : isDark ? 'border-[#1f1f23] text-gray-400' : 'border-gray-200 text-gray-500'
                    }`}
                  >
                    🌐 Telnyx
                  </button>
                )}
              </div>
            </div>

            {/* Country */}
            <div>
              <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>البلد</label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className={`w-full px-4 py-2.5 rounded-xl border text-sm ${
                  isDark ? 'bg-[#0a0a0b] border-[#1f1f23] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                }`}
              >
                {COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>{c.flag} {c.name} ({c.prefix})</option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن رقم محدد (اختياري)..."
                className={`flex-1 px-4 py-2.5 rounded-xl border text-sm ${
                  isDark ? 'bg-[#0a0a0b] border-[#1f1f23] text-white placeholder:text-gray-600' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400'
                }`}
              />
              <button
                onClick={handleSearch}
                disabled={searching}
                className="px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-white text-sm font-medium disabled:opacity-50"
              >
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </button>
            </div>

            {/* Available numbers */}
            {availableNumbers.length > 0 && (
              <div className={`rounded-xl border max-h-48 overflow-y-auto ${isDark ? 'border-[#1f1f23]' : 'border-gray-200'}`}>
                {availableNumbers.map((n, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedNumber(n.phoneNumber)}
                    className={`w-full flex items-center justify-between px-4 py-3 text-sm border-b last:border-b-0 transition-colors ${
                      selectedNumber === n.phoneNumber
                        ? isDark ? 'bg-teal-500/10 border-teal-500/20' : 'bg-teal-50 border-teal-200'
                        : isDark ? 'border-[#1f1f23] hover:bg-[#1a1a1d]' : 'border-gray-100 hover:bg-gray-50'
                    }`}
                  >
                    <span className={`font-mono ${selectedNumber === n.phoneNumber ? 'text-teal-400' : isDark ? 'text-white' : 'text-gray-900'}`} dir="ltr">
                      {n.phoneNumber}
                    </span>
                    {selectedNumber === n.phoneNumber && <CheckCircle className="w-4 h-4 text-teal-400" />}
                  </button>
                ))}
              </div>
            )}

            {/* Agent selector */}
            <div>
              <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>ربط بمساعد (اختياري)</label>
              <select
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className={`w-full px-4 py-2.5 rounded-xl border text-sm ${
                  isDark ? 'bg-[#0a0a0b] border-[#1f1f23] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                }`}
              >
                <option value="">— بدون مساعد (ربط لاحقاً) —</option>
                {agents.map(a => (
                  <option key={a.id} value={a.id}>{a.avatar} {a.name}{a.status !== 'active' ? ` (${a.status === 'inactive' ? 'معطّل' : 'مسودة'})` : ''}</option>
                ))}
              </select>
              <InactiveAgentWarning agentId={selectedAgent} agents={agents} isDark={isDark} />
            </div>

            {/* Purchase button */}
            <button
              onClick={handlePurchase}
              disabled={!selectedNumber || creating}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-l from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white font-bold text-sm disabled:opacity-50"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
              شراء الرقم
            </button>
          </div>
        )}

        {/* Custom SIP Mode */}
        {mode === 'custom' && (
          <div className="space-y-4">
            <button onClick={() => setMode(null)} className={`text-xs ${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}>
              ← رجوع
            </button>

            {/* Phone number */}
            <div>
              <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                رقم الهاتف <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={customPhone}
                onChange={(e) => setCustomPhone(e.target.value)}
                placeholder="+966501234567"
                dir="ltr"
                className={`w-full px-4 py-2.5 rounded-xl border text-sm font-mono ${
                  isDark ? 'bg-[#0a0a0b] border-[#1f1f23] text-white placeholder:text-gray-600' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400'
                }`}
              />
            </div>

            {/* Friendly name */}
            <div>
              <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>اسم مميز</label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="مثال: خط الاستقبال الرئيسي"
                className={`w-full px-4 py-2.5 rounded-xl border text-sm ${
                  isDark ? 'bg-[#0a0a0b] border-[#1f1f23] text-white placeholder:text-gray-600' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400'
                }`}
              />
            </div>

            {/* Country */}
            <div>
              <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>البلد</label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className={`w-full px-4 py-2.5 rounded-xl border text-sm ${
                  isDark ? 'bg-[#0a0a0b] border-[#1f1f23] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                }`}
              >
                {COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
                ))}
              </select>
            </div>

            {/* SIP Settings */}
            <div className={`rounded-xl border p-4 space-y-3 ${isDark ? 'bg-[#0a0a0b] border-[#1f1f23]' : 'bg-gray-50 border-gray-200'}`}>
              <p className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                🔧 بيانات SIP Trunk (اختياري — للمزوّدين اللي يدعمون SIP)
              </p>
              <input
                type="text"
                value={sipServer}
                onChange={(e) => setSipServer(e.target.value)}
                placeholder="SIP Server (مثال: sip.provider.com)"
                dir="ltr"
                className={`w-full px-3 py-2 rounded-lg border text-xs ${
                  isDark ? 'bg-[#111113] border-[#1f1f23] text-gray-300 placeholder:text-gray-600' : 'bg-white border-gray-200 text-gray-700 placeholder:text-gray-400'
                }`}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={sipUsername}
                  onChange={(e) => setSipUsername(e.target.value)}
                  placeholder="Username"
                  dir="ltr"
                  className={`px-3 py-2 rounded-lg border text-xs ${
                    isDark ? 'bg-[#111113] border-[#1f1f23] text-gray-300 placeholder:text-gray-600' : 'bg-white border-gray-200 text-gray-700 placeholder:text-gray-400'
                  }`}
                />
                <input
                  type="password"
                  value={sipPassword}
                  onChange={(e) => setSipPassword(e.target.value)}
                  placeholder="Password"
                  dir="ltr"
                  className={`px-3 py-2 rounded-lg border text-xs ${
                    isDark ? 'bg-[#111113] border-[#1f1f23] text-gray-300 placeholder:text-gray-600' : 'bg-white border-gray-200 text-gray-700 placeholder:text-gray-400'
                  }`}
                />
              </div>
            </div>

            {/* Agent */}
            <div>
              <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>ربط بمساعد</label>
              <select
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className={`w-full px-4 py-2.5 rounded-xl border text-sm ${
                  isDark ? 'bg-[#0a0a0b] border-[#1f1f23] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                }`}
              >
                <option value="">— بدون مساعد —</option>
                {agents.map(a => (
                  <option key={a.id} value={a.id}>{a.avatar} {a.name}{a.status !== 'active' ? ` (${a.status === 'inactive' ? 'معطّل' : 'مسودة'})` : ''}</option>
                ))}
              </select>
              <InactiveAgentWarning agentId={selectedAgent} agents={agents} isDark={isDark} />
            </div>

            {/* Add button */}
            <button
              onClick={handleAddCustom}
              disabled={!customPhone || creating}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-l from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white font-bold text-sm disabled:opacity-50"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              إضافة الرقم
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className={`mt-4 flex items-center gap-2 p-3 rounded-xl ${isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span className={`text-xs ${isDark ? 'text-red-400' : 'text-red-600'}`}>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// Outbound Call Modal
// ══════════════════════════════════════════════════════
function OutboundCallModal({ phone, isDark, onClose, onCall }) {
  const [destination, setDestination] = useState('');
  const [calling, setCalling] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const handleCall = async () => {
    if (!destination.startsWith('+')) {
      setError('أدخل الرقم بصيغة دولية (مثال: +966501234567)');
      return;
    }
    setCalling(true);
    setError(null);
    try {
      const res = await onCall(phone.id, destination);
      setResult(res);
    } catch (err) {
      setError(err.message || 'فشل إجراء المكالمة');
    } finally {
      setCalling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`w-full max-w-md rounded-2xl p-6 ${isDark ? 'bg-[#111113] border border-[#1f1f23]' : 'bg-white border border-gray-200'}`} dir="rtl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-teal-500/10">
              <PhoneOutgoing className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <h2 className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>مكالمة صادرة</h2>
              <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>من {phone.phoneNumber}</p>
            </div>
          </div>
          <button onClick={onClose} className={`text-sm ${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}>✕</button>
        </div>

        {!result ? (
          <div className="space-y-4">
            <div>
              <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                رقم المتصَل عليه
              </label>
              <input
                type="tel"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="+966501234567"
                dir="ltr"
                className={`w-full px-4 py-3 rounded-xl border text-base font-mono text-center tracking-wider ${
                  isDark ? 'bg-[#0a0a0b] border-[#1f1f23] text-white placeholder:text-gray-600' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400'
                } focus:outline-none focus:ring-2 focus:ring-teal-500/30`}
                autoFocus
              />
            </div>

            <div className={`flex items-start gap-2 p-3 rounded-xl text-xs ${isDark ? 'bg-[#0a0a0b] border border-[#1f1f23]' : 'bg-gray-50 border border-gray-200'}`}>
              <Bot className={`w-4 h-4 shrink-0 mt-0.5 ${isDark ? 'text-teal-400' : 'text-teal-500'}`} />
              <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                المساعد <strong className={isDark ? 'text-white' : 'text-gray-900'}>{phone.agent?.name || 'المربوط'}</strong> سيتحدث مع الشخص اللي يرد على المكالمة.
              </p>
            </div>

            {error && (
              <div className={`flex items-center gap-2 p-3 rounded-xl text-xs ${isDark ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-red-50 border border-red-200 text-red-600'}`}>
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
              </div>
            )}

            <button
              onClick={handleCall}
              disabled={!destination || calling}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-l from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white font-bold text-sm disabled:opacity-50 transition-all"
            >
              {calling ? <Loader2 className="w-4 h-4 animate-spin" /> : <PhoneOutgoing className="w-4 h-4" />}
              {calling ? 'جاري الاتصال...' : 'اتصل الآن'}
            </button>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center bg-emerald-500/10">
              <PhoneOutgoing className="w-7 h-7 text-emerald-400" />
            </div>
            <div>
              <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>جاري الاتصال</p>
              <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {phone.phoneNumber} → {destination}
              </p>
              <p className={`text-xs mt-2 font-mono ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                Room: {result.roomName}
              </p>
            </div>
            <button onClick={onClose}
              className={`w-full py-2.5 rounded-xl font-medium text-sm ${isDark ? 'bg-[#1a1a1d] text-white hover:bg-[#222225]' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`}>
              إغلاق
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// Delete Confirmation Modal
// ══════════════════════════════════════════════════════
function DeleteModal({ phone, isDark, onConfirm, onCancel, deleting }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`w-full max-w-md rounded-2xl p-6 ${isDark ? 'bg-[#111113] border border-[#1f1f23]' : 'bg-white border border-gray-200'}`}>
        <div className="text-center">
          <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center bg-red-500/10">
            <Trash2 className="w-7 h-7 text-red-400" />
          </div>
          <h3 className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>حذف الرقم</h3>
          <p className={`text-sm mb-2 font-mono ${isDark ? 'text-gray-300' : 'text-gray-700'}`} dir="ltr">
            {phone.phoneNumber}
          </p>
          <p className={`text-xs mb-6 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            {phone.provider !== 'custom'
              ? 'سيتم إلغاء الرقم من المزوّد وحذف إعدادات SIP. هذا الإجراء لا يمكن التراجع عنه.'
              : 'سيتم حذف إعدادات SIP. الرقم نفسه يبقى عند المزوّد الأصلي.'
            }
          </p>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className={`flex-1 px-4 py-2.5 rounded-xl font-medium text-sm border ${
                isDark ? 'border-[#2a2a2e] text-gray-300 hover:bg-[#1a1a1d]' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              إلغاء
            </button>
            <button
              onClick={onConfirm}
              disabled={deleting}
              className="flex-1 px-4 py-2.5 rounded-xl font-medium text-sm bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-50"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'نعم، احذف'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// Main Page
// ══════════════════════════════════════════════════════
export default function PhoneNumbersPage() {
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [phones, setPhones] = useState([]);
  const [agents, setAgents] = useState([]);
  const [providers, setProviders] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [outboundTarget, setOutboundTarget] = useState(null);

  // ── Load data ──
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [phonesRes, agentsRes, providersRes] = await Promise.allSettled([
        phoneAPI.list(),
        listAgents(),
        phoneAPI.getProviders(),
      ]);

      if (phonesRes.status === 'fulfilled') setPhones(phonesRes.value.phones || []);
      if (agentsRes.status === 'fulfilled') setAgents(agentsRes.value.agents || []);
      if (providersRes.status === 'fulfilled') setProviders(providersRes.value.providers || null);
    } catch (err) {
      setError(err.message || 'فشل تحميل البيانات');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Handlers ──
  const handleUpdate = async (phoneId, data) => {
    try {
      await phoneAPI.update(phoneId, data);
      await loadData();
      toast.success(data.agentId ? 'تم ربط المساعد بالرقم' : data.agentId === null ? 'تم فصل المساعد عن الرقم' : 'تم تحديث الرقم');
    } catch (err) {
      toast.error(err.message || 'فشل التحديث');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await phoneAPI.delete(deleteTarget.id);
      setPhones(prev => prev.filter(p => p.id !== deleteTarget.id));
      toast.success(`تم حذف الرقم ${deleteTarget.phoneNumber}`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err.message || 'فشل حذف الرقم');
    } finally {
      setDeleting(false);
    }
  };

  const handleSetupSip = async (phone) => {
    try {
      await phoneAPI.setupSip(phone.id);
      await loadData();
      toast.success('تم إعداد SIP بنجاح');
    } catch (err) {
      toast.error(err.message || 'فشل إعداد SIP');
    }
  };

  const handleToggle = async (phone) => {
    try {
      const res = await phoneAPI.toggle(phone.id);
      await loadData();
      toast.success(res.message || (res.status === 'active' ? 'تم تفعيل الرقم' : 'تم تعطيل الرقم'));
    } catch (err) {
      toast.error(err.message || 'فشل تغيير حالة الرقم');
    }
  };

  const handleOutbound = async (phoneId, destination) => {
    const res = await phoneAPI.outbound(phoneId, destination);
    toast.success(res.message || 'جاري الاتصال');
    return res;
  };

  return (
    <div className="min-h-screen p-4 md:p-6" dir="rtl">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            📱 أرقام الهاتف
          </h1>
          <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            اربط أرقام هاتف حقيقية بمساعديك لاستقبال المكالمات
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className={`p-2.5 rounded-xl border transition-colors ${
              isDark ? 'border-[#1f1f23] text-gray-400 hover:text-white hover:bg-[#1a1a1d]' : 'border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-l from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white font-bold rounded-xl transition-all"
          >
            <Plus className="w-4 h-4" />
            إضافة رقم
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className={`flex items-center gap-3 p-4 rounded-xl mb-6 ${isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <span className={`text-sm ${isDark ? 'text-red-400' : 'text-red-600'}`}>{error}</span>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-teal-500' : 'text-teal-600'}`} />
        </div>
      ) : phones.length === 0 ? (
        /* Empty State */
        <div className={`rounded-2xl border-2 border-dashed p-12 text-center ${isDark ? 'border-[#2a2a2e]' : 'border-gray-200'}`}>
          <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-3xl ${isDark ? 'bg-[#1a1a1d]' : 'bg-gray-50'}`}>
            📱
          </div>
          <h3 className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            لا توجد أرقام هاتف
          </h3>
          <p className={`text-sm mb-6 max-w-md mx-auto ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            أضف رقم هاتف واربطه بمساعدك لاستقبال مكالمات حقيقية
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-l from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white font-bold rounded-xl transition-all"
          >
            <Plus className="w-5 h-5" />
            إضافة رقم هاتف
          </button>
        </div>
      ) : (
        /* Phone Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {phones.map(phone => (
            <PhoneCard
              key={phone.id}
              phone={phone}
              isDark={isDark}
              agents={agents}
              onUpdate={handleUpdate}
              onDelete={setDeleteTarget}
              onSetupSip={handleSetupSip}
              onToggle={handleToggle}
              onOutbound={(p) => setOutboundTarget(p)}
            />
          ))}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <AddNumberModal
          isDark={isDark}
          agents={agents}
          providers={providers}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); loadData(); toast.success('تم إضافة الرقم بنجاح'); }}
        />
      )}

      {/* Outbound Call Modal */}
      {outboundTarget && (
        <OutboundCallModal
          phone={outboundTarget}
          isDark={isDark}
          onClose={() => setOutboundTarget(null)}
          onCall={handleOutbound}
        />
      )}

      {/* Delete Modal */}
      {deleteTarget && (
        <DeleteModal
          phone={deleteTarget}
          isDark={isDark}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}
    </div>
  );
}
