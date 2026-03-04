import { useState, useEffect, useCallback } from "react";
import {
  Phone, PhoneIncoming, PhoneOutgoing, PhoneOff,
  Check, X, Search, RefreshCw, Eye,
  FileText, Clock, ChevronLeft, ChevronRight,
  Loader2, AlertCircle, Globe, TrendingUp,
  Play, Pause, Volume2
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { callsAPI } from "@/services/api/sondosAPI";

// ─── Helpers ──────────────────────────────────────────────────
const isAnswered = (s) =>
  ["completed", "ended", "ended_by_customer", "ended_by_assistant"].includes(s);
const isMissed = (s) => ["no-answer", "failed", "busy"].includes(s);
const isLive   = (s) => ["initiated", "ringing", "in-progress"].includes(s);

const fmtDuration = (secs) => {
  if (!secs || secs === 0) return "—";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const fmtDate = (str) => {
  if (!str) return "—";
  try {
    return new Date(str).toLocaleDateString("ar-SA", {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch { return str; }
};

const fmtTime = (str) => {
  if (!str) return "";
  try {
    return new Date(str).toLocaleTimeString("ar-SA", {
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return ""; }
};

// ─── Status Badge ─────────────────────────────────────────────
function StatusBadge({ status }) {
  if (isAnswered(status))
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <Check className="w-3 h-3" /> {status}
      </span>
    );
  if (isMissed(status))
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
        <PhoneOff className="w-3 h-3" /> {status}
      </span>
    );
  if (isLive(status))
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
        <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse" />
        {status}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20">
      {status}
    </span>
  );
}

// ─── Type Badge ───────────────────────────────────────────────
function TypeBadge({ type }) {
  if (type === "outbound")
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400">
        <PhoneOutgoing className="w-3 h-3" /> صادرة
      </span>
    );
  if (type === "inbound")
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400">
        <PhoneIncoming className="w-3 h-3" /> واردة
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-cyan-500/10 text-cyan-400">
      <Globe className="w-3 h-3" /> ويب
    </span>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────
function KPICard({ icon: Icon, label, value, sub, color, isDark }) {
  const cfg = {
    cyan:    { bg: "bg-cyan-500/10",    text: "text-cyan-500",    border: "border-cyan-500/20"    },
    emerald: { bg: "bg-emerald-500/10", text: "text-emerald-500", border: "border-emerald-500/20" },
    red:     { bg: "bg-red-500/10",     text: "text-red-500",     border: "border-red-500/20"     },
    purple:  { bg: "bg-purple-500/10",  text: "text-purple-500",  border: "border-purple-500/20"  },
    blue:    { bg: "bg-blue-500/10",    text: "text-blue-500",    border: "border-blue-500/20"    },
    teal:    { bg: "bg-teal-500/10",    text: "text-teal-500",    border: "border-teal-500/20"    },
  }[color] || { bg: "bg-gray-500/10", text: "text-gray-500", border: "border-gray-500/20" };

  return (
    <div className={`rounded-2xl p-5 border ${isDark ? "bg-[#111113] border-[#1f1f23]" : "bg-white border-gray-200"}`}>
      <div className={`w-10 h-10 ${cfg.bg} ${cfg.border} border rounded-xl flex items-center justify-center mb-3`}>
        <Icon className={`w-5 h-5 ${cfg.text}`} />
      </div>
      <p className={`text-sm mb-1 ${isDark ? "text-gray-400" : "text-gray-500"}`}>{label}</p>
      <p className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>{value}</p>
      {sub && <p className={`text-xs mt-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}>{sub}</p>}
    </div>
  );
}

// ─── Call Details Modal ───────────────────────────────────────
function CallModal({ call, onClose, isDark }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audio] = useState(() => call.recording_url ? new Audio(call.recording_url) : null);

  useEffect(() => {
    return () => { if (audio) { audio.pause(); audio.src = ""; } };
  }, [audio]);

  const togglePlay = () => {
    if (!audio) return;
    if (isPlaying) { audio.pause(); setIsPlaying(false); }
    else { audio.play(); setIsPlaying(true); audio.onended = () => setIsPlaying(false); }
  };

  if (!call) return null;
  const phone  = call.client_phone_number || "—";
  const type   = call.type   || "unknown";
  const status = call.status || "unknown";

  const infoRows = [
    { label: "النوع",          value: <TypeBadge type={type} /> },
    { label: "الحالة",         value: <StatusBadge status={status} /> },
    { label: "المدة",          value: fmtDuration(call.duration) },
    { label: "التاريخ",        value: `${fmtDate(call.created_at)} ${fmtTime(call.created_at)}` },
    call.assistant_name           && { label: "المساعد",      value: call.assistant_name },
    call.campaign_name            && { label: "الحملة",       value: call.campaign_name },
    call.assistant_phone_number   && { label: "رقم المساعد", value: call.assistant_phone_number },
    call.answered_by              && { label: "أجاب عليها",  value: call.answered_by },
    call.total_cost   !== undefined && { label: "التكلفة الكلية", value: `$${Number(call.total_cost).toFixed(4)}` },
    call.carrier_cost !== undefined && { label: "تكلفة الناقل",   value: `$${Number(call.carrier_cost).toFixed(4)}` },
  ].filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className={`w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl border ${
        isDark ? "bg-[#111113] border-[#1f1f23]" : "bg-white border-gray-200"
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b shrink-0 ${isDark ? "border-[#1f1f23]" : "border-gray-200"}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              type === "outbound" ? "bg-purple-500/10" : type === "inbound" ? "bg-blue-500/10" : "bg-cyan-500/10"
            }`}>
              {type === "outbound" ? <PhoneOutgoing className="w-5 h-5 text-purple-500" /> :
               type === "inbound"  ? <PhoneIncoming className="w-5 h-5 text-blue-500"  /> :
               <Globe className="w-5 h-5 text-cyan-500" />}
            </div>
            <div>
              <p className={`font-bold ${isDark ? "text-white" : "text-gray-900"}`} dir="ltr">{phone}</p>
              <p className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>{`${t('calls.callId')} #${call.id}`}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-xl transition-colors ${isDark ? "hover:bg-[#1f1f23] text-gray-400" : "hover:bg-gray-100 text-gray-500"}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-3">
            {infoRows.map((row, i) => (
              <div key={i} className={`p-3 rounded-xl ${isDark ? "bg-[#0a0a0b]" : "bg-gray-50"}`}>
                <p className={`text-xs mb-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}>{row.label}</p>
                <div className={`font-medium text-sm ${isDark ? "text-white" : "text-gray-900"}`}>{row.value}</div>
              </div>
            ))}
          </div>

          {/* Recording */}
          {call.recording_url && (
            <div className={`rounded-xl p-4 border ${isDark ? "bg-[#0a0a0b] border-[#1f1f23]" : "bg-gray-50 border-gray-200"}`}>
              <p className={`text-sm font-medium mb-3 flex items-center gap-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                <Volume2 className="w-4 h-4 text-teal-500" /> {t('calls.recording')}
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={togglePlay}
                  className="w-10 h-10 bg-teal-500 hover:bg-teal-400 rounded-full flex items-center justify-center transition-colors shrink-0"
                >
                  {isPlaying ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white ml-0.5" />}
                </button>
                <audio controls className="flex-1 h-10" src={call.recording_url} />
              </div>
            </div>
          )}

          {/* Variables */}
          {call.variables && Object.keys(call.variables).length > 0 && (
            <div className={`rounded-xl p-4 border ${isDark ? "bg-[#0a0a0b] border-[#1f1f23]" : "bg-gray-50 border-gray-200"}`}>
              <p className={`text-sm font-medium mb-3 ${isDark ? "text-gray-300" : "text-gray-700"}`}>{t('calls.variables')}</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(call.variables).map(([k, v]) => (
                  <div key={k} className={`p-2 rounded-lg ${isDark ? "bg-[#111113]" : "bg-white"}`}>
                    <p className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>{k}</p>
                    <p className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>{String(v)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Evaluation */}
          {call.evaluation && Object.keys(call.evaluation).filter(k => call.evaluation[k] != null).length > 0 && (
            <div className={`rounded-xl p-4 border ${isDark ? "bg-[#0a0a0b] border-[#1f1f23]" : "bg-gray-50 border-gray-200"}`}>
              <p className={`text-sm font-medium mb-3 ${isDark ? "text-gray-300" : "text-gray-700"}`}>{t('calls.evaluation')}</p>
              <div className="grid grid-cols-3 gap-2">
                {call.evaluation.sentiment && (
                  <div className={`p-2 rounded-lg text-center ${isDark ? "bg-[#111113]" : "bg-white"}`}>
                    <p className={`text-xs mb-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}>{t('calls.sentiment')}</p>
                    <p className={`text-sm font-medium ${
                      call.evaluation.sentiment === "positive" ? "text-emerald-500" :
                      call.evaluation.sentiment === "negative" ? "text-red-500" : isDark ? "text-white" : "text-gray-900"
                    }`}>{call.evaluation.sentiment}</p>
                  </div>
                )}
                {call.evaluation.outcome && (
                  <div className={`p-2 rounded-lg text-center ${isDark ? "bg-[#111113]" : "bg-white"}`}>
                    <p className={`text-xs mb-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}>{t('calls.outcome')}</p>
                    <p className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>{call.evaluation.outcome}</p>
                  </div>
                )}
                {call.evaluation.score != null && (
                  <div className={`p-2 rounded-lg text-center ${isDark ? "bg-[#111113]" : "bg-white"}`}>
                    <p className={`text-xs mb-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}>{t('calls.score')}</p>
                    <p className="text-sm font-bold text-teal-500">{call.evaluation.score}/10</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Transcript */}
          {call.transcript && (
            <div className={`rounded-xl p-4 border ${isDark ? "bg-[#0a0a0b] border-[#1f1f23]" : "bg-gray-50 border-gray-200"}`}>
              <p className={`text-sm font-medium mb-3 flex items-center gap-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                <FileText className="w-4 h-4 text-teal-500" /> t('calls.transcript')
              </p>
              <p className={`text-sm whitespace-pre-wrap leading-relaxed ${isDark ? "text-gray-300" : "text-gray-600"}`} dir="auto">
                {call.transcript}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 border-t shrink-0 ${isDark ? "border-[#1f1f23]" : "border-gray-200"}`}>
          <button
            onClick={onClose}
            className={`w-full py-2.5 rounded-xl font-medium transition-colors ${
              isDark ? "bg-[#1a1a1d] text-white hover:bg-[#222225]" : "bg-gray-100 text-gray-900 hover:bg-gray-200"
            }`}
            >{t('calls.close')}</button>

        </div>
      </div>
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────
function Pagination({ currentPage, lastPage, onPageChange, isDark }) {
  if (lastPage <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 pt-2">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className={`p-2 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
          isDark ? "hover:bg-[#1a1a1d] text-gray-400" : "hover:bg-gray-100 text-gray-600"
        }`}
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      {Array.from({ length: Math.min(lastPage, 7) }, (_, i) => {
        let page;
        if (lastPage <= 7) {
          page = i + 1;
        } else if (currentPage <= 4) {
          page = i + 1;
        } else if (currentPage >= lastPage - 3) {
          page = lastPage - 6 + i;
        } else {
          page = currentPage - 3 + i;
        }
        return (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
              page === currentPage
                ? "bg-teal-500 text-white"
                : isDark
                ? "hover:bg-[#1a1a1d] text-gray-400"
                : "hover:bg-gray-100 text-gray-600"
            }`}
          >
            {page}
          </button>
        );
      })}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === lastPage}
        className={`p-2 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
          isDark ? "hover:bg-[#1a1a1d] text-gray-400" : "hover:bg-gray-100 text-gray-600"
        }`}
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function CallsPage() {
  const { isDark } = useTheme();
  const { t, isAr } = useLanguage();

  const [calls, setCalls]           = useState([]);
  const [stats, setStats]           = useState({ total: 0, answered: 0, missed: 0, avgDuration: 0, answerRate: 0, inbound: 0, outbound: 0 });
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [selectedCall, setSelectedCall] = useState(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [lastPage, setLastPage]       = useState(1);
  const [total, setTotal]             = useState(0);
  const PER_PAGE = 20;

  // Filters
  const [search, setSearch]           = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType]     = useState("all");
  const [dateFrom, setDateFrom]         = useState("");
  const [dateTo, setDateTo]             = useState("");

  const loadCalls = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, per_page: PER_PAGE };
      if (filterStatus !== "all") params.status       = filterStatus;
      if (filterType   !== "all") params.type         = filterType;
      if (dateFrom)               params.date_from    = dateFrom;
      if (dateTo)                 params.date_to      = dateTo;
      if (search)                 params.phone_number = search;

      const res = await callsAPI.getAll(params);
      const data = res.data || [];
      const tot  = res.total || data.length;

      setCalls(data);
      setTotal(tot);
      setCurrentPage(res.current_page || page);
      setLastPage(res.last_page || 1);

      // Calculate stats from current page + totals from API
      const answered    = data.filter(c => isAnswered(c.status)).length;
      const missed      = data.filter(c => isMissed(c.status)).length;
      const inbound     = data.filter(c => c.type === "inbound").length;
      const outbound    = data.filter(c => c.type === "outbound").length;
      const withDur     = data.filter(c => c.duration > 0);
      const avgDuration = withDur.length > 0
        ? Math.round(withDur.reduce((a, c) => a + c.duration, 0) / withDur.length)
        : 0;
      const answerRate  = data.length > 0 ? Math.round((answered / data.length) * 100) : 0;

      setStats({ total: tot, answered, missed, avgDuration, answerRate, inbound, outbound });
    } catch (err) {
      setError(err.message || "فشل تحميل المكالمات");
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterType, dateFrom, dateTo, search]);

  useEffect(() => {
    loadCalls(1);
  }, [filterStatus, filterType, dateFrom, dateTo]);

  const handleSearch = (e) => {
    e.preventDefault();
    loadCalls(1);
  };

  const handlePageChange = (page) => {
    loadCalls(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleReset = () => {
    setSearch("");
    setFilterStatus("all");
    setFilterType("all");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
            {t('calls.title')}
          </h1>
          <p className={`mt-1 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            {t('calls.subtitle')}
          </p>
        </div>
        <button
            onClick={() => loadCalls(currentPage)}
            disabled={loading}
            className={`px-4 py-2.5 rounded-xl border flex items-center gap-2 transition-colors ${
              isDark
                ? "bg-[#1a1a1d] border-[#1f1f23] text-gray-400 hover:text-white"
                : "bg-white border-gray-200 text-gray-600 hover:text-gray-900"
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            {t('calls.refresh') || "تحديث"}
          </button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard icon={Phone}       label={t('calls.totalCalls')} value={stats.total.toLocaleString()} color="cyan"    isDark={isDark} />
        <KPICard icon={Check}       label={t('calls.answered')}          value={stats.answered}                color="emerald" isDark={isDark} />
        <KPICard icon={PhoneOff}    label={t('calls.missed')}            value={stats.missed}                  color="red"     isDark={isDark} />
        <KPICard icon={TrendingUp}  label={t('calls.answerRate')}        value={`${stats.answerRate}%`}        color="teal"    isDark={isDark} />
        <KPICard icon={Clock}       label={t('calls.avgDuration')}      value={fmtDuration(stats.avgDuration)} color="blue"   isDark={isDark} />
        <KPICard
          icon={PhoneIncoming}
          label={t('calls.inOutbound')}
          value={`${stats.inbound} / ${stats.outbound}`}
          color="purple"
          isDark={isDark}
        />
      </div>

      {/* ── Filters ── */}
      <div className={`rounded-2xl p-5 border space-y-4 ${isDark ? "bg-[#111113] border-[#1f1f23]" : "bg-white border-gray-200"}`}>
        {/* Search row */}
        <form onSubmit={handleSearch} className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
            <input
              type="text"
              placeholder={t('calls.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full pl-4 pr-10 py-2.5 rounded-xl border text-sm ${
                isDark
                  ? "bg-[#0a0a0b] border-[#1f1f23] text-white placeholder-gray-600"
                  : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400"
              }`}
            />
          </div>
          <button
              type="submit"
            >
              {t('calls.search') || "بحث"}
            </button>

            <button
              type="button"
              onClick={handleReset}
              className={`px-4 py-2.5 rounded-xl text-sm border transition-colors ${
                isDark
                  ? "border-[#1f1f23] text-gray-400 hover:text-white hover:bg-[#1a1a1d]"
                  : "border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              {t('calls.reset') || "إعادة تعيين"}
            </button>
        </form>

        {/* Filter row */}
        <div className="flex gap-3 flex-wrap items-center">
          {/* Status */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className={`px-4 py-2.5 rounded-xl border text-sm ${
              isDark ? "bg-[#0a0a0b] border-[#1f1f23] text-white" : "bg-gray-50 border-gray-200 text-gray-900"
            }`}
          >
            <option value="all">{t('calls.allStatuses')}</option>
            <option value="completed">{t('calls.completed')}</option>
            <option value="ended">{t('calls.ended')}</option>
            <option value="ended_by_customer">{t('calls.endedByCustomer')}</option>
            <option value="ended_by_assistant">{t('calls.endedByAssistant')}</option>
            <option value="no-answer">{t('calls.noAnswer')}</option>
            <option value="failed">{t('calls.failed')}</option>
            <option value="busy">{t('calls.busy')}</option>
            <option value="in-progress">{t('calls.inProgress')}</option>
            <option value="ringing">{t('calls.ringing')}</option>
            <option value="initiated">{t('calls.initiated')}</option>
          </select>

          {/* Type */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className={`px-4 py-2.5 rounded-xl border text-sm ${
              isDark ? "bg-[#0a0a0b] border-[#1f1f23] text-white" : "bg-gray-50 border-gray-200 text-gray-900"
            }`}
          >
            <option value="all">{t('calls.allTypes')}</option>
            <option value="inbound">{t('calls.inbound')}</option>
            <option value="outbound">{t('calls.outbound')}</option>
            <option value="web">{t('calls.web')}</option>
          </select>

          {/* Date From */}
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            placeholder="من تاريخ"
            className={`px-4 py-2.5 rounded-xl border text-sm ${
              isDark ? "bg-[#0a0a0b] border-[#1f1f23] text-white" : "bg-gray-50 border-gray-200 text-gray-900"
            }`}
          />

          {/* Date To */}
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            placeholder="إلى تاريخ"
            className={`px-4 py-2.5 rounded-xl border text-sm ${
              isDark ? "bg-[#0a0a0b] border-[#1f1f23] text-white" : "bg-gray-50 border-gray-200 text-gray-900"
            }`}
          />

          <span className={`text-sm mr-auto ${isDark ? "text-gray-500" : "text-gray-400"}`}>
            {total.toLocaleString()} {t('calls.totalLabel')}
          </span>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className={`flex items-center gap-3 p-4 rounded-xl border ${
          isDark ? "bg-red-500/10 border-red-500/20" : "bg-red-50 border-red-200"
        }`}>
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <span className={isDark ? "text-red-400" : "text-red-600"}>{error}</span>
        </div>
      )}

      {/* ── Table ── */}
      <div className={`rounded-2xl border overflow-hidden ${isDark ? "bg-[#111113] border-[#1f1f23]" : "bg-white border-gray-200"}`}>
  {loading ? (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
    </div>
  ) : calls.length === 0 ? (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <Phone className={`w-14 h-14 ${isDark ? "text-gray-700" : "text-gray-300"}`} />

      <p className={`text-lg font-medium ${isDark ? "text-gray-500" : "text-gray-400"}`}>
        {t('calls.noCalls') || "لا توجد مكالمات"}
      </p>

      <p className={`text-sm ${isDark ? "text-gray-600" : "text-gray-400"}`}>
        {t('calls.noCallsHint') || "جرّب تغيير الفلاتر أو التاريخ"}
      </p>
    </div>
  ) : (
    <>
      <div className="overflow-x-auto">
        <table className="w-full">
                <thead>
                  <tr className={`border-b ${isDark ? "border-[#1f1f23]" : "border-gray-200"}`}>
                    {[t('calls.phone'), t('calls.type'), t('calls.status'), t('calls.assistant'), t('calls.duration'), t('calls.date'), ''].map((h, i) => (
                      <th
                        key={i}
                        className={`text-right px-5 py-4 text-xs font-semibold uppercase tracking-wider ${
                          isDark ? "text-gray-500" : "text-gray-400"
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-opacity-50">
                  {calls.map((call, i) => {
                    const type = call.type || "unknown";
                    return (
                      <tr
                        key={call.id || i}
                        className={`transition-colors ${
                          isDark ? "border-[#1f1f23]/40 hover:bg-[#1a1a1d]" : "border-gray-100 hover:bg-gray-50"
                        }`}
                        style={{ borderBottomWidth: "1px", borderBottomStyle: "solid" }}
                      >
                        {/* Phone */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                              type === "outbound" ? "bg-purple-500/10" :
                              type === "inbound"  ? "bg-blue-500/10"   : "bg-cyan-500/10"
                            }`}>
                              {type === "outbound" ? <PhoneOutgoing className="w-4 h-4 text-purple-500" /> :
                               type === "inbound"  ? <PhoneIncoming className="w-4 h-4 text-blue-500"  /> :
                               <Globe className="w-4 h-4 text-cyan-500" />}
                            </div>
                            <div>
                              <p className={`font-medium text-sm ${isDark ? "text-white" : "text-gray-900"}`} dir="ltr">
                                {call.client_phone_number || "—"}
                              </p>
                              <p className={`text-xs ${isDark ? "text-gray-600" : "text-gray-400"}`}>
                                {fmtTime(call.created_at)}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Type */}
                        <td className="px-5 py-4"><TypeBadge type={type} /></td>

                        {/* Status */}
                        <td className="px-5 py-4"><StatusBadge status={call.status || "unknown"} /></td>

                        {/* Assistant */}
                        <td className={`px-5 py-4 text-sm ${isDark ? "text-gray-300" : "text-gray-600"}`}>
                          {call.assistant_name || "—"}
                        </td>

                        {/* Duration */}
                        <td className={`px-5 py-4 text-sm font-mono ${isDark ? "text-gray-300" : "text-gray-600"}`}>
                          {fmtDuration(call.duration)}
                        </td>

                        {/* Date */}
                        <td className={`px-5 py-4 text-sm ${isDark ? "text-gray-300" : "text-gray-600"}`}>
                          {fmtDate(call.created_at)}
                        </td>

                        {/* Action */}
                        <td className="px-5 py-4">
                          <button
                            onClick={() => setSelectedCall(call)}
                            className={`p-2 rounded-lg transition-colors ${
                              isDark ? "hover:bg-[#222225] text-gray-400 hover:text-white" : "hover:bg-gray-100 text-gray-500 hover:text-gray-900"
                            }`}
                            title="{t('calls.viewDetails')}"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {/* Pagination */}
            <div className={`px-5 py-4 border-t ${isDark ? "border-[#1f1f23]" : "border-gray-200"}`}>
              <p className={`text-sm ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                {t('calls.page')} {currentPage} {t('calls.of')} {lastPage} — {total.toLocaleString()} {t('calls.callsCount')}
              </p>

              <Pagination
                currentPage={currentPage}
                lastPage={lastPage}
                onPageChange={handlePageChange}
                isDark={isDark}
              />
            </div>
          </>
        )}
      </div>

      {/* ── Modal ── */}
      {selectedCall && (
        <CallModal call={selectedCall} onClose={() => setSelectedCall(null)} isDark={isDark} />
      )}
    </div>
  );
}