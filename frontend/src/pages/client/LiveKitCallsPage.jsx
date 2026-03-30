// =====================================================
// LiveKit Calls Page — سجل مكالمات الاختبار (LiveKit)
// ─────────────────────────────────────────────────────
// Displays LiveKit test call records from MongoDB
// Separate from AutoCalls — parallel test system
// =====================================================
import { useState, useEffect, useCallback } from "react";
import {
  Phone, PhoneOff, Check, Search, RefreshCw, Eye,
  FileText, Clock, ChevronLeft, ChevronRight,
  Loader2, AlertCircle, TrendingUp, Mic,
  X, Bot, User, Info
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { listLivekitCalls, getLivekitCall, getLivekitCallStats } from "@/services/api/livekitAPI";

// ─── Status Helpers ───────────────────────────────────────────
const STATUS_CONFIG = {
  completed: { label: "مكتملة", color: "emerald", icon: Check },
  active:    { label: "نشطة",   color: "yellow",  icon: null },
  created:   { label: "بُدأت",  color: "blue",    icon: null },
  failed:    { label: "فشلت",   color: "red",     icon: PhoneOff },
  timeout:   { label: "انتهت المهلة", color: "orange", icon: Clock },
};

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
  const cfg = STATUS_CONFIG[status] || { label: status, color: "gray" };
  const colors = {
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    yellow:  "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    blue:    "bg-blue-500/10 text-blue-400 border-blue-500/20",
    red:     "bg-red-500/10 text-red-400 border-red-500/20",
    orange:  "bg-orange-500/10 text-orange-400 border-orange-500/20",
    gray:    "bg-gray-500/10 text-gray-400 border-gray-500/20",
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${colors[cfg.color]}`}>
      {status === "active" && <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse" />}
      {cfg.icon && <cfg.icon className="w-3 h-3" />}
      {cfg.label}
    </span>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────
function KPICard({ icon: Icon, label, value, sub, color, isDark }) {
  const cfg = {
    cyan:    { bg: "bg-cyan-500/10",    text: "text-cyan-500",    border: "border-cyan-500/20"    },
    emerald: { bg: "bg-emerald-500/10", text: "text-emerald-500", border: "border-emerald-500/20" },
    red:     { bg: "bg-red-500/10",     text: "text-red-500",     border: "border-red-500/20"     },
    teal:    { bg: "bg-teal-500/10",    text: "text-teal-500",    border: "border-teal-500/20"    },
    blue:    { bg: "bg-blue-500/10",    text: "text-blue-500",    border: "border-blue-500/20"    },
  }[color] || { bg: "bg-gray-500/10", text: "text-gray-500", border: "border-gray-500/20" };

  return (
    <div className={`rounded-2xl p-5 border transition-all hover:shadow-md ${isDark ? "bg-[#111113]/80 border-[#1f1f23] hover:border-[#2a2a2e]" : "bg-white border-gray-200 hover:shadow-lg"}`}>
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
function CallDetailModal({ callId, onClose, isDark }) {
  const [call, setCall] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!callId) return;
    setLoading(true);
    getLivekitCall(callId)
      .then(res => setCall(res.call))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [callId]);

  if (!callId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className={`w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl border ${
        isDark ? "bg-[#111113] border-[#1f1f23]" : "bg-white border-gray-200"
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b shrink-0 ${isDark ? "border-[#1f1f23]" : "border-gray-200"}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-cyan-500/10">
              <Mic className="w-5 h-5 text-cyan-500" />
            </div>
            <div>
              <p className={`font-bold ${isDark ? "text-white" : "text-gray-900"}`}>تفاصيل مكالمة LiveKit</p>
              <p className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>اختبار صوتي</p>
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
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
            </div>
          ) : !call ? (
            <p className={`text-center py-12 ${isDark ? "text-gray-500" : "text-gray-400"}`}>لم يتم العثور على المكالمة</p>
          ) : (
            <>
              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "الحالة", value: <StatusBadge status={call.status} /> },
                  { label: "المدة", value: fmtDuration(call.durationSeconds) },
                  { label: "التاريخ", value: `${fmtDate(call.createdAt)} ${fmtTime(call.createdAt)}` },
                  { label: "اسم الغرفة", value: <span className="font-mono text-xs break-all">{call.roomName}</span> },
                  { label: "الـ Agent", value: call.agentJoined ? "✅ انضم" : "❌ لم ينضم" },
                  { label: "المشاركين", value: `${call.participants?.length || 0} مشترك` },
                  call.agentConfig?.llmModel && { label: "النموذج", value: call.agentConfig.llmModel },
                  call.agentConfig?.ttsVoice && { label: "الصوت", value: call.agentConfig.ttsVoice },
                ].filter(Boolean).map((row, i) => (
                  <div key={i} className={`p-3 rounded-xl ${isDark ? "bg-[#0a0a0b]" : "bg-gray-50"}`}>
                    <p className={`text-xs mb-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}>{row.label}</p>
                    <div className={`font-medium text-sm ${isDark ? "text-white" : "text-gray-900"}`}>{row.value}</div>
                  </div>
                ))}
              </div>

              {/* Participants */}
              {call.participants && call.participants.length > 0 && (
                <div className={`rounded-xl p-4 border ${isDark ? "bg-[#0a0a0b] border-[#1f1f23]" : "bg-gray-50 border-gray-200"}`}>
                  <p className={`text-sm font-medium mb-3 flex items-center gap-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                    <User className="w-4 h-4 text-teal-500" /> المشاركين
                  </p>
                  <div className="space-y-2">
                    {call.participants.map((p, i) => (
                      <div key={i} className={`flex items-center justify-between p-2 rounded-lg ${isDark ? "bg-[#111113]" : "bg-white"}`}>
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${
                            p.isAgent ? "bg-cyan-500/20 text-cyan-400" : "bg-emerald-500/20 text-emerald-400"
                          }`}>
                            {p.isAgent ? "🤖" : "👤"}
                          </div>
                          <div>
                            <span className={`text-sm ${isDark ? "text-white" : "text-gray-900"}`}>
                              {p.name || p.identity}
                            </span>
                            {p.isAgent && <span className="text-xs text-cyan-400 mr-2">(Agent)</span>}
                          </div>
                        </div>
                        <span className={`text-xs ${isDark ? "text-gray-600" : "text-gray-400"}`}>
                          {p.joinedAt ? fmtTime(p.joinedAt) : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Transcript */}
              {call.transcript && call.transcript.length > 0 && (
                <div className={`rounded-xl p-4 border ${isDark ? "bg-[#0a0a0b] border-[#1f1f23]" : "bg-gray-50 border-gray-200"}`}>
                  <p className={`text-sm font-medium mb-3 flex items-center gap-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                    <FileText className="w-4 h-4 text-teal-500" /> نص المحادثة ({call.transcript.length} رسالة)
                  </p>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {call.transcript.map((entry, i) => (
                      <div key={i} className={`flex gap-3 ${entry.speaker === "user" ? "flex-row-reverse" : ""}`}>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 ${
                          entry.speaker === "agent"
                            ? "bg-cyan-500/20 text-cyan-400"
                            : entry.speaker === "user"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-gray-600/20 text-gray-500"
                        }`}>
                          {entry.speaker === "agent" ? "🤖" : entry.speaker === "user" ? "🎙️" : "ℹ️"}
                        </div>
                        <div className={`max-w-[75%] ${entry.speaker === "user" ? "text-right" : ""}`}>
                          <p className={`text-sm leading-relaxed ${
                            entry.speaker === "agent" ? (isDark ? "text-gray-200" : "text-gray-700") :
                            entry.speaker === "user" ? (isDark ? "text-gray-300" : "text-gray-600") :
                            (isDark ? "text-gray-500 italic" : "text-gray-400 italic")
                          }`}>
                            {entry.text}
                          </p>
                          {entry.timestamp && (
                            <span className={`text-[10px] mt-0.5 block ${isDark ? "text-gray-600" : "text-gray-400"}`}>
                              {fmtTime(entry.timestamp)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No Transcript */}
              {(!call.transcript || call.transcript.length === 0) && (
                <div className={`rounded-xl p-4 border text-center ${isDark ? "bg-[#0a0a0b] border-[#1f1f23]" : "bg-gray-50 border-gray-200"}`}>
                  <FileText className={`w-8 h-8 mx-auto mb-2 ${isDark ? "text-gray-700" : "text-gray-300"}`} />
                  <p className={`text-sm ${isDark ? "text-gray-500" : "text-gray-400"}`}>لا يوجد نص محادثة لهذه المكالمة</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 border-t shrink-0 ${isDark ? "border-[#1f1f23]" : "border-gray-200"}`}>
          <button
            onClick={onClose}
            className={`w-full py-2.5 rounded-xl font-medium transition-colors ${
              isDark ? "bg-[#1a1a1d] text-white hover:bg-[#222225]" : "bg-gray-100 text-gray-900 hover:bg-gray-200"
            }`}
          >إغلاق</button>
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
        if (lastPage <= 7) page = i + 1;
        else if (currentPage <= 4) page = i + 1;
        else if (currentPage >= lastPage - 3) page = lastPage - 6 + i;
        else page = currentPage - 3 + i;
        return (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
              page === currentPage
                ? "bg-teal-500 text-white"
                : isDark ? "hover:bg-[#1a1a1d] text-gray-400" : "hover:bg-gray-100 text-gray-600"
            }`}
          >{page}</button>
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

// ─── Main Component ───────────────────────────────────────────
export default function LiveKitCallsPage() {
  const { isDark } = useTheme();
  const { t } = useLanguage();

  const [calls, setCalls] = useState([]);
  const [stats, setStats] = useState({ totalCalls: 0, completedCalls: 0, activeCalls: 0, avgDurationSeconds: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCallId, setSelectedCallId] = useState(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const PER_PAGE = 20;

  // Filter
  const [filterStatus, setFilterStatus] = useState("all");

  const loadCalls = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit: PER_PAGE };
      if (filterStatus !== "all") params.status = filterStatus;

      const [callsRes, statsRes] = await Promise.all([
        listLivekitCalls(params),
        getLivekitCallStats(),
      ]);

      setCalls(callsRes.calls || []);
      setTotal(callsRes.pagination?.total || 0);
      setCurrentPage(callsRes.pagination?.page || page);
      setLastPage(callsRes.pagination?.pages || 1);
      setStats(statsRes.stats || {});
    } catch (err) {
      setError(err.message || "فشل تحميل مكالمات LiveKit");
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    loadCalls(1);
  }, [filterStatus]);

  const handlePageChange = (page) => {
    loadCalls(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const completionRate = stats.totalCalls > 0
    ? Math.round((stats.completedCalls / stats.totalCalls) * 100)
    : 0;

  return (
    <div className="space-y-6">

      {/* ── Info Banner ── */}
      <div className={`flex items-center gap-3 p-4 rounded-xl border ${
        isDark ? "bg-cyan-500/5 border-cyan-500/20" : "bg-cyan-50 border-cyan-200"
      }`}>
        <Info className="w-5 h-5 text-cyan-500 shrink-0" />
        <p className={`text-sm ${isDark ? "text-cyan-300" : "text-cyan-700"}`}>
          هذه سجلات مكالمات الاختبار عبر LiveKit (من صفحة اختبار المساعد). مكالمات AutoCalls الإنتاجية في التاب الآخر.
        </p>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard icon={Phone}      label="إجمالي المكالمات" value={stats.totalCalls || 0}                          color="cyan"    isDark={isDark} />
        <KPICard icon={Check}      label="مكتملة"          value={stats.completedCalls || 0}                       color="emerald" isDark={isDark} />
        <KPICard icon={Mic}        label="نشطة الآن"       value={stats.activeCalls || 0}                          color="blue"    isDark={isDark} />
        <KPICard icon={Clock}      label="متوسط المدة"     value={fmtDuration(stats.avgDurationSeconds || 0)}      color="teal"    isDark={isDark} />
      </div>

      {/* ── Filter Bar ── */}
      <div className={`rounded-2xl p-4 border flex items-center gap-3 flex-wrap ${
        isDark ? "bg-[#111113] border-[#1f1f23]" : "bg-white border-gray-200"
      }`}>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className={`px-4 py-2.5 rounded-xl border text-sm ${
            isDark ? "bg-[#0a0a0b] border-[#1f1f23] text-white" : "bg-gray-50 border-gray-200 text-gray-900"
          }`}
        >
          <option value="all">جميع الحالات</option>
          <option value="completed">مكتملة</option>
          <option value="active">نشطة</option>
          <option value="created">بُدأت</option>
          <option value="failed">فشلت</option>
        </select>

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
          تحديث
        </button>

        <span className={`text-sm mr-auto ${isDark ? "text-gray-500" : "text-gray-400"}`}>
          {total} مكالمة
        </span>
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
      <div className={`rounded-2xl border overflow-hidden ${isDark ? "bg-[#111113]/80 border-[#1f1f23]" : "bg-white border-gray-200 shadow-sm"}`}>
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
          </div>
        ) : calls.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Mic className={`w-14 h-14 ${isDark ? "text-gray-700" : "text-gray-300"}`} />
            <p className={`text-lg font-medium ${isDark ? "text-gray-500" : "text-gray-400"}`}>
              لا توجد مكالمات اختبار
            </p>
            <p className={`text-sm ${isDark ? "text-gray-600" : "text-gray-400"}`}>
              جرب مكالمة من صفحة "اختبار المساعد" وستظهر هنا
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${isDark ? "border-[#1f1f23]" : "border-gray-200"}`}>
                    {["الغرفة", "الحالة", "الـ Agent", "المدة", "التاريخ", "المحادثة", ""].map((h, i) => (
                      <th
                        key={i}
                        className={`text-right px-5 py-4 text-xs font-semibold uppercase tracking-wider ${
                          isDark ? "text-gray-500" : "text-gray-400"
                        }`}
                      >{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {calls.map((call, i) => (
                    <tr
                      key={call._id || i}
                      className={`transition-colors ${
                        isDark ? "border-[#1f1f23]/40 hover:bg-[#1a1a1d]/60" : "border-gray-100 hover:bg-gray-50"
                      }`}
                      style={{ borderBottomWidth: "1px", borderBottomStyle: "solid" }}
                    >
                      {/* Room */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-cyan-500/10">
                            <Mic className="w-4 h-4 text-cyan-500" />
                          </div>
                          <div>
                            <p className={`font-medium text-sm font-mono ${isDark ? "text-white" : "text-gray-900"}`}>
                              {call.roomName?.replace("sondos-test-", "").slice(0, 16) || "—"}
                            </p>
                            <p className={`text-xs ${isDark ? "text-gray-600" : "text-gray-400"}`}>
                              {fmtTime(call.createdAt)}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4"><StatusBadge status={call.status} /></td>

                      {/* Agent */}
                      <td className="px-5 py-4">
                        {call.agentJoined ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                            <Bot className="w-3.5 h-3.5" /> متصل
                          </span>
                        ) : (
                          <span className={`text-xs ${isDark ? "text-gray-600" : "text-gray-400"}`}>—</span>
                        )}
                      </td>

                      {/* Duration */}
                      <td className={`px-5 py-4 text-sm font-mono ${isDark ? "text-gray-300" : "text-gray-600"}`}>
                        {fmtDuration(call.durationSeconds)}
                      </td>

                      {/* Date */}
                      <td className={`px-5 py-4 text-sm ${isDark ? "text-gray-300" : "text-gray-600"}`}>
                        {fmtDate(call.createdAt)}
                      </td>

                      {/* Transcript count */}
                      <td className="px-5 py-4">
                        {call.transcript && call.transcript.length > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs text-teal-400">
                            <FileText className="w-3.5 h-3.5" /> {call.transcript.length} رسالة
                          </span>
                        ) : (
                          <span className={`text-xs ${isDark ? "text-gray-600" : "text-gray-400"}`}>—</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="px-5 py-4">
                        <button
                          onClick={() => setSelectedCallId(call._id)}
                          className={`p-2 rounded-lg transition-colors ${
                            isDark ? "hover:bg-[#1f1f23] text-gray-400 hover:text-white" : "hover:bg-gray-100 text-gray-500 hover:text-gray-900"
                          }`}
                          title="عرض التفاصيل"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className={`px-5 py-4 border-t ${isDark ? "border-[#1f1f23]" : "border-gray-200"}`}>
              <p className={`text-sm ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                صفحة {currentPage} من {lastPage} — {total} مكالمة
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

      {/* ── Call Detail Modal ── */}
      {selectedCallId && (
        <CallDetailModal
          callId={selectedCallId}
          onClose={() => setSelectedCallId(null)}
          isDark={isDark}
        />
      )}
    </div>
  );
}
