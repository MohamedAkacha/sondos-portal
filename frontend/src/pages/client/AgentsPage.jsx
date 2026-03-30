// =====================================================
// Agents Page — قائمة المساعدين الأذكياء
// ─────────────────────────────────────────────────────
// Shows agent cards with status, stats, and actions
// =====================================================
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bot, Plus, Search, Loader2, AlertCircle, RefreshCw,
  Phone, Clock, MoreVertical, Trash2, Edit, Power,
  PowerOff, Copy, Mic, MessageSquare, ChevronRight,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { listAgents, deleteAgent, updateAgent } from "@/services/api/agentAPI";

// ── Role Labels ──
const ROLE_LABELS = {
  receptionist: { ar: 'موظف استقبال', en: 'Receptionist', icon: '📞' },
  sales:        { ar: 'مبيعات',       en: 'Sales',        icon: '💰' },
  support:      { ar: 'دعم فني',      en: 'Support',      icon: '🔧' },
  collections:  { ar: 'تحصيل',        en: 'Collections',  icon: '📋' },
  booking:      { ar: 'حجوزات',       en: 'Booking',      icon: '📅' },
  medical:      { ar: 'استقبال عيادة', en: 'Medical',      icon: '🏥' },
  custom:       { ar: 'مخصص',         en: 'Custom',       icon: '⚙️' },
};

// ── Status Config ──
const STATUS_CONFIG = {
  active:   { label: 'مفعّل',  labelEn: 'Active',   color: 'emerald' },
  inactive: { label: 'معطّل',  labelEn: 'Inactive', color: 'gray' },
  draft:    { label: 'مسودة',  labelEn: 'Draft',    color: 'amber' },
};

// ── Format duration ──
function fmtDuration(secs) {
  if (!secs) return '0 د';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h} س ${m} د`;
  return `${m} د`;
}

// ── Format date ──
function fmtDate(str) {
  if (!str) return '—';
  try {
    return new Date(str).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return str; }
}

// ── Status Badge ──
function StatusBadge({ status, isDark }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  const colors = {
    emerald: isDark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border-emerald-200',
    gray:    isDark ? 'bg-gray-500/10 text-gray-400 border-gray-500/20'       : 'bg-gray-100 text-gray-600 border-gray-200',
    amber:   isDark ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'    : 'bg-amber-50 text-amber-600 border-amber-200',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${colors[cfg.color]}`}>
      {status === 'active' && <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />}
      {cfg.label}
    </span>
  );
}

// ══════════════════════════════════════════════════════
// Agent Card Component
// ══════════════════════════════════════════════════════
function AgentCard({ agent, isDark, onEdit, onDelete, onToggleStatus, onTestVoice, onTestChat }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const role = ROLE_LABELS[agent.personality?.role] || ROLE_LABELS.custom;

  return (
    <div className={`group relative rounded-2xl border p-5 transition-all duration-200 hover:shadow-lg ${
      isDark
        ? 'bg-[#111113]/80 border-[#1f1f23] hover:border-teal-500/20 hover:shadow-teal-500/5'
        : 'bg-white border-gray-200 hover:border-gray-300'
    }`}>

      {/* Top: Avatar + Name + Menu */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
            isDark ? 'bg-[#1a1a1d]' : 'bg-gray-50'
          }`}>
            {agent.avatar || '🤖'}
          </div>
          <div>
            <h3 className={`font-bold text-base ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {agent.name}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                {role.icon} {role.ar}
              </span>
            </div>
          </div>
        </div>

        {/* Status + Menu */}
        <div className="flex items-center gap-2">
          <StatusBadge status={agent.status} isDark={isDark} />
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className={`p-1.5 rounded-lg transition-colors ${
                isDark ? 'hover:bg-[#1f1f23] text-gray-500' : 'hover:bg-gray-100 text-gray-400'
              }`}
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {/* Dropdown menu */}
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className={`absolute left-0 top-8 z-20 w-48 rounded-xl border shadow-xl py-1.5 ${
                  isDark ? 'bg-[#1a1a1d] border-[#2a2a2e]' : 'bg-white border-gray-200'
                }`} dir="rtl">
                  <button onClick={() => { onEdit(agent); setMenuOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm ${isDark ? 'text-gray-300 hover:bg-[#1f1f23]' : 'text-gray-700 hover:bg-gray-50'}`}>
                    <Edit className="w-4 h-4" /> تعديل الإعدادات
                  </button>
                  <button onClick={() => { onToggleStatus(agent); setMenuOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm ${isDark ? 'text-gray-300 hover:bg-[#1f1f23]' : 'text-gray-700 hover:bg-gray-50'}`}>
                    {agent.status === 'active'
                      ? <><PowerOff className="w-4 h-4" /> تعطيل المساعد</>
                      : <><Power className="w-4 h-4" /> تفعيل المساعد</>
                    }
                  </button>
                  <div className={`my-1.5 border-t ${isDark ? 'border-[#2a2a2e]' : 'border-gray-100'}`} />
                  <button onClick={() => { onDelete(agent); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10">
                    <Trash2 className="w-4 h-4" /> حذف المساعد
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      {agent.description && (
        <p className={`text-sm mb-4 line-clamp-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          {agent.description}
        </p>
      )}

      {/* Stats row */}
      <div className={`flex items-center gap-4 mb-4 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
        <div className="flex items-center gap-1.5">
          <Phone className="w-3.5 h-3.5" />
          <span>{agent.stats?.totalCalls || 0} مكالمة</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          <span>{fmtDuration(agent.stats?.totalDurationSeconds)}</span>
        </div>
      </div>

      {/* Voice info */}
      <div className={`text-xs mb-4 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
        🔊 {agent.voice?.voiceName || agent.voice?.voiceId || 'Nova'}
        <span className="mx-1.5">•</span>
        🧠 {agent.llm?.intelligenceLevel === 'fast' ? 'سريع' : agent.llm?.intelligenceLevel === 'smart' ? 'ذكي جداً' : 'متوازن'}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onTestChat(agent)}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
            isDark
              ? 'bg-[#1a1a1d] border border-[#2a2a2e] text-gray-300 hover:bg-[#1f1f23] hover:text-white'
              : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          محادثة
        </button>
        <button
          onClick={() => onTestVoice(agent)}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-l from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white transition-all shadow-md shadow-teal-500/15"
        >
          <Mic className="w-4 h-4" />
          اختبار صوتي
        </button>
      </div>

      {/* Last activity */}
      {agent.stats?.lastCallAt && (
        <p className={`text-[11px] mt-3 text-center ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
          آخر مكالمة: {fmtDate(agent.stats.lastCallAt)}
        </p>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// Empty State
// ══════════════════════════════════════════════════════
function EmptyState({ isDark, onCreate }) {
  return (
    <div className={`rounded-2xl border-2 border-dashed p-12 text-center ${
      isDark ? 'border-[#1f1f23]' : 'border-gray-200'
    }`}>
      <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-3xl ${
        isDark ? 'bg-[#1a1a1d]' : 'bg-gray-50'
      }`}>
        🤖
      </div>
      <h3 className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
        لا يوجد مساعدين بعد
      </h3>
      <p className={`text-sm mb-6 max-w-md mx-auto ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
        أنشئ مساعدك الذكي الأول واختر من القوالب الجاهزة أو ابدأ من الصفر
      </p>
      <button
        onClick={onCreate}
        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-l from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white font-bold rounded-xl transition-all"
      >
        <Plus className="w-5 h-5" />
        إنشاء مساعد جديد
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// Delete Confirmation Modal
// ══════════════════════════════════════════════════════
function DeleteModal({ agent, isDark, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`w-full max-w-md rounded-2xl p-6 ${isDark ? 'bg-[#111113] border border-[#1f1f23]' : 'bg-white border border-gray-200'}`}>
        <div className="text-center">
          <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center bg-red-500/10">
            <Trash2 className="w-7 h-7 text-red-400" />
          </div>
          <h3 className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            حذف المساعد
          </h3>
          <p className={`text-sm mb-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            هل أنت متأكد من حذف "{agent.name}"؟ سيتم حذف كل الإعدادات وسجل المكالمات. هذا الإجراء لا يمكن التراجع عنه.
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
              className="flex-1 px-4 py-2.5 rounded-xl font-medium text-sm bg-red-500 hover:bg-red-600 text-white transition-colors"
            >
              نعم، احذف
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
export default function AgentsPage() {
  const { isDark } = useTheme();
  const { t, isAr } = useLanguage();
  const navigate = useNavigate();

  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deleteTarget, setDeleteTarget] = useState(null);

  // ── Load agents ──
  const loadAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listAgents();
      setAgents(res.agents || []);
    } catch (err) {
      setError(err.message || 'فشل تحميل المساعدين');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAgents(); }, [loadAgents]);

  // ── Filter agents ──
  const filteredAgents = agents.filter(a => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return a.name.toLowerCase().includes(q) || (a.description || '').toLowerCase().includes(q);
    }
    return true;
  });

  // ── Handlers ──
  const handleEdit = (agent) => navigate(`/agents/${agent.id}`);
  const handleTestVoice = (agent) => navigate(`/test-agent?agentId=${agent.id}`);
  const handleTestChat = (agent) => navigate(`/agents/${agent.id}?tab=chat`);
  const handleCreate = () => navigate('/agents/new');

  const handleToggleStatus = async (agent) => {
    try {
      const newStatus = agent.status === 'active' ? 'inactive' : 'active';
      await updateAgent(agent.id, { status: newStatus });
      setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, status: newStatus } : a));
    } catch (err) {
      setError(err.message || 'فشل تحديث الحالة');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteAgent(deleteTarget.id);
      setAgents(prev => prev.filter(a => a.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(err.message || 'فشل حذف المساعد');
    }
  };

  // ── Count by status ──
  const counts = {
    all: agents.length,
    active: agents.filter(a => a.status === 'active').length,
    inactive: agents.filter(a => a.status === 'inactive').length,
    draft: agents.filter(a => a.status === 'draft').length,
  };

  // ══════════════════════════════════════════════════════
  // Render
  // ══════════════════════════════════════════════════════
  return (
    <div className="min-h-screen p-4 md:p-6" dir="rtl">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            المساعدين الأذكياء
          </h1>
          <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            إنشاء وإدارة المساعدين الأذكياء لمكالماتك
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadAgents}
            className={`p-2.5 rounded-xl border transition-colors ${
              isDark ? 'border-[#1f1f23] text-gray-400 hover:text-white hover:bg-[#1a1a1d]' : 'border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-50'
            }`}
            title="تحديث"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-l from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white font-semibold rounded-xl transition-all shadow-lg shadow-teal-500/20 hover:shadow-teal-500/30"
          >
            <Plus className="w-4 h-4" />
            مساعد جديد
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
      ) : agents.length === 0 ? (
        <EmptyState isDark={isDark} onCreate={handleCreate} />
      ) : (
        <>
          {/* Search + Filter bar */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            {/* Search */}
            <div className="relative flex-1">
              <Search className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
              <input
                type="text"
                placeholder="ابحث عن مساعد..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pr-10 pl-4 py-2.5 rounded-xl border text-sm ${
                  isDark
                    ? 'bg-[#111113] border-[#1f1f23] text-white placeholder:text-gray-600 focus:border-teal-500/50'
                    : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-teal-500'
                } focus:outline-none focus:ring-1 focus:ring-teal-500/30`}
              />
            </div>

            {/* Status filter tabs */}
            <div className={`flex items-center rounded-xl border p-1 ${isDark ? 'border-[#1f1f23] bg-[#111113]' : 'border-gray-200 bg-gray-50'}`}>
              {[
                { key: 'all', label: 'الكل' },
                { key: 'active', label: 'مفعّل' },
                { key: 'inactive', label: 'معطّل' },
                { key: 'draft', label: 'مسودة' },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    statusFilter === tab.key
                      ? isDark ? 'bg-[#1f1f23] text-white' : 'bg-white text-gray-900 shadow-sm'
                      : isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label} ({counts[tab.key]})
                </button>
              ))}
            </div>
          </div>

          {/* Agent Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredAgents.map(agent => (
              <AgentCard
                key={agent.id}
                agent={agent}
                isDark={isDark}
                onEdit={handleEdit}
                onDelete={(a) => setDeleteTarget(a)}
                onToggleStatus={handleToggleStatus}
                onTestVoice={handleTestVoice}
                onTestChat={handleTestChat}
              />
            ))}
          </div>

          {/* No results */}
          {filteredAgents.length === 0 && (
            <div className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              <Search className="w-8 h-8 mx-auto mb-3 opacity-50" />
              <p>لا توجد نتائج مطابقة</p>
            </div>
          )}
        </>
      )}

      {/* Delete Modal */}
      {deleteTarget && (
        <DeleteModal
          agent={deleteTarget}
          isDark={isDark}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
