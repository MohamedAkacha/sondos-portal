import { useState, useEffect } from "react";
import {
  Crown, Loader2, CheckCircle, AlertCircle, Calendar,
  Zap, Star, Rocket, Power, Copy, Check, ExternalLink,
  Key, Eye, EyeOff, Shield, Clock, Gauge, Mic, Bot,
  WifiOff, ChevronDown, ChevronUp
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { apiCall } from "@/services/api/httpClient";

// ── Icon map for plan icons ──
const PLAN_ICONS = { zap: Zap, star: Star, crown: Crown, rocket: Rocket };

// ── Color map for plan colors ──
const PLAN_COLORS = {
  orange: { gradient: 'from-orange-500/15 to-amber-500/15', border: 'border-orange-500/30', text: 'text-orange-400', bg: 'bg-orange-500/20', light: { gradient: 'from-orange-50 to-amber-50', border: 'border-orange-200', text: 'text-orange-600', bg: 'bg-orange-100' } },
  gray:   { gradient: 'from-slate-500/15 to-gray-500/15', border: 'border-slate-500/30', text: 'text-slate-400', bg: 'bg-slate-500/20', light: { gradient: 'from-slate-50 to-gray-50', border: 'border-slate-200', text: 'text-slate-600', bg: 'bg-slate-100' } },
  yellow: { gradient: 'from-yellow-500/15 to-amber-500/15', border: 'border-yellow-500/30', text: 'text-yellow-400', bg: 'bg-yellow-500/20', light: { gradient: 'from-yellow-50 to-amber-50', border: 'border-yellow-200', text: 'text-yellow-600', bg: 'bg-yellow-100' } },
  teal:   { gradient: 'from-teal-500/15 to-cyan-500/15', border: 'border-teal-500/30', text: 'text-teal-400', bg: 'bg-teal-500/20', light: { gradient: 'from-teal-50 to-cyan-50', border: 'border-teal-200', text: 'text-teal-600', bg: 'bg-teal-100' } },
};

const PERIOD_LABELS = {
  monthly: { ar: 'شهرياً', en: 'Monthly' },
  quarterly: { ar: 'ربع سنوي', en: 'Quarterly' },
  yearly: { ar: 'سنوياً', en: 'Yearly' },
  one_time: { ar: 'مرة واحدة', en: 'One-time' },
};

export default function MyPlanPage() {
  const { isDark } = useTheme();
  const { t, isAr } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [flows, setFlows] = useState([]);
  const [togglingId, setTogglingId] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [expandedFlow, setExpandedFlow] = useState(null);
  const [copiedEndpoint, setCopiedEndpoint] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [planRes, flowsRes, keyRes] = await Promise.all([
        apiCall('/user/my-plan'),
        apiCall('/user/my-flows'),
        apiCall('/user/api-key'),
      ]);

      if (planRes.success) {
        setPlan(planRes.data.plan);
        setSubscription(planRes.data.subscription);
      }
      if (flowsRes.success) {
        setFlows(flowsRes.data.flows || []);
      }
      if (keyRes.success && keyRes.data) {
        setApiKey(keyRes.data.apiKey || '');
      }
    } catch (err) {
      console.error('Load plan data error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFlow = async (flowId, currentEnabled) => {
    setTogglingId(flowId);
    setMessage({ type: '', text: '' });
    try {
      const res = await apiCall(`/user/my-flows/${flowId}/toggle`, {
        method: 'PUT',
        body: JSON.stringify({ enabled: !currentEnabled }),
      });
      if (res.success) {
        setFlows(prev => prev.map(f =>
          f.id === flowId ? { ...f, isEnabled: !currentEnabled } : f
        ));
        setMessage({
          type: 'success',
          text: !currentEnabled
            ? (isAr ? `تم تفعيل "${res.data.flowName}" بنجاح` : `"${res.data.flowName}" enabled`)
            : (isAr ? `تم إيقاف "${res.data.flowName}" بنجاح` : `"${res.data.flowName}" disabled`)
        });
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || (isAr ? 'حدث خطأ' : 'An error occurred') });
    } finally {
      setTogglingId(null);
    }
  };

  const handleCopyEndpoint = async (flowKey) => {
    const url = `${window.location.origin}/api/public/flow-status/${flowKey}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedEndpoint(flowKey);
    setTimeout(() => setCopiedEndpoint(null), 2000);
  };

  const handleCopyApiKey = async () => {
    if (!apiKey) return;
    try {
      await navigator.clipboard.writeText(apiKey);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = apiKey;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString(isAr ? 'ar-SA' : 'en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      });
    } catch { return dateStr; }
  };

  const getDaysRemaining = () => {
    if (!subscription?.endDate) return null;
    const now = new Date();
    const end = new Date(subscription.endDate);
    const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    return diff;
  };

  // ── Loading State ──
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-teal-500' : 'text-teal-600'}`} />
      </div>
    );
  }

  // ── No Plan State ──
  if (!plan) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {isAr ? 'باقتي' : 'My Plan'}
          </h1>
        </div>
        <div className={`rounded-2xl p-12 text-center ${isDark ? 'bg-[#111113] border border-[#1f1f23]' : 'bg-white border border-gray-200'}`}>
          <Crown className={`w-16 h-16 mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
          <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {isAr ? 'لا توجد باقة مفعّلة' : 'No active plan'}
          </h3>
          <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>
            {isAr ? 'تواصل مع الدعم لتفعيل باقتك' : 'Contact support to activate your plan'}
          </p>
        </div>
      </div>
    );
  }

  const colorScheme = PLAN_COLORS[plan.color] || PLAN_COLORS.teal;
  const colors = isDark ? colorScheme : colorScheme.light;
  const PlanIcon = PLAN_ICONS[plan.icon] || Crown;
  const daysRemaining = getDaysRemaining();
  const periodLabel = PERIOD_LABELS[plan.period] || PERIOD_LABELS.monthly;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {isAr ? 'باقتي' : 'My Plan'}
        </h1>
        <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>
          {isAr ? 'تفاصيل الباقة والتحكم بالأتمتة' : 'Plan details and automation control'}
        </p>
      </div>

      {/* ── Message ── */}
      {message.text && (
        <div className={`flex items-center gap-3 p-4 rounded-xl transition-all ${
          message.type === 'success'
            ? isDark ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border border-emerald-200 text-emerald-600'
            : isDark ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-red-50 border border-red-200 text-red-600'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="text-sm">{message.text}</span>
        </div>
      )}

      {/* ══════════════════════════════════════════ */}
      {/* ── PLAN CARD ── */}
      {/* ══════════════════════════════════════════ */}
      <div className={`rounded-2xl overflow-hidden border ${isDark ? colors.border : colors.border}`}>
        {/* Plan Header */}
        <div className={`bg-gradient-to-br ${isDark ? colorScheme.gradient : colors.gradient} p-6`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${isDark ? colorScheme.bg : colors.bg}`}>
                <PlanIcon className={`w-7 h-7 ${isDark ? colorScheme.text : colors.text}`} />
              </div>
              <div>
                <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {isAr ? plan.name : (plan.nameEn || plan.name)}
                </h2>
                <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {isAr ? plan.description : (plan.descriptionEn || plan.description)}
                </p>
              </div>
            </div>
            {/* Price Badge */}
            <div className="text-left">
              <div className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {plan.priceDisplay} <span className="text-base font-normal">{plan.currency}</span>
              </div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {isAr ? periodLabel.ar : periodLabel.en}
              </p>
            </div>
          </div>
        </div>

        {/* Subscription Info + Features */}
        <div className={`p-6 ${isDark ? 'bg-[#111113]' : 'bg-white'}`}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Subscription Status */}
            {subscription && (
              <div className="space-y-4">
                <h3 className={`font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  <Calendar className="w-4 h-4 text-teal-500" />
                  {isAr ? 'الاشتراك' : 'Subscription'}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {/* Status */}
                  <div className={`p-3 rounded-xl ${isDark ? 'bg-[#0a0a0b]' : 'bg-gray-50'}`}>
                    <p className={`text-xs mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {isAr ? 'الحالة' : 'Status'}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        subscription.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'
                      }`} />
                      <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {subscription.status === 'active'
                          ? (isAr ? 'فعّال' : 'Active')
                          : (isAr ? 'منتهي' : 'Expired')}
                      </span>
                    </div>
                  </div>
                  {/* Days remaining */}
                  <div className={`p-3 rounded-xl ${isDark ? 'bg-[#0a0a0b]' : 'bg-gray-50'}`}>
                    <p className={`text-xs mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {isAr ? 'الأيام المتبقية' : 'Days Left'}
                    </p>
                    <p className={`text-sm font-medium ${
                      daysRemaining && daysRemaining < 7
                        ? 'text-red-500'
                        : isDark ? 'text-white' : 'text-gray-900'
                    }`}>
                      {daysRemaining !== null ? (daysRemaining > 0 ? `${daysRemaining} ${isAr ? 'يوم' : 'days'}` : (isAr ? 'منتهي' : 'Expired')) : '-'}
                    </p>
                  </div>
                  {/* Start date */}
                  <div className={`p-3 rounded-xl ${isDark ? 'bg-[#0a0a0b]' : 'bg-gray-50'}`}>
                    <p className={`text-xs mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {isAr ? 'تاريخ البداية' : 'Start Date'}
                    </p>
                    <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {formatDate(subscription.startDate)}
                    </p>
                  </div>
                  {/* End date */}
                  <div className={`p-3 rounded-xl ${isDark ? 'bg-[#0a0a0b]' : 'bg-gray-50'}`}>
                    <p className={`text-xs mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {isAr ? 'تاريخ الانتهاء' : 'End Date'}
                    </p>
                    <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {formatDate(subscription.endDate)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Features & Limits */}
            <div className="space-y-4">
              <h3 className={`font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                <Gauge className="w-4 h-4 text-teal-500" />
                {isAr ? 'المميزات والحدود' : 'Features & Limits'}
              </h3>
              <div className="space-y-2">
                {plan.features && plan.features.map((f, i) => (
                  <div key={i} className={`flex items-center justify-between p-3 rounded-xl ${isDark ? 'bg-[#0a0a0b]' : 'bg-gray-50'}`}>
                    <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {isAr ? f.label : (f.labelEn || f.label)}
                    </span>
                    <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {isAr ? f.value : (f.valueEn || f.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════ */}
      {/* ── AUTOMATIONS SECTION ── */}
      {/* ══════════════════════════════════════════ */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className={`text-xl font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              <Bot className="w-5 h-5 text-teal-500" />
              {isAr ? 'الأتمتة' : 'Automations'}
            </h2>
            <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {isAr ? 'تحكم بكل أتمتة على حدة — فعّل أو أوقف حسب حاجتك' : 'Control each automation individually'}
            </p>
          </div>
          {flows.length > 0 && (
            <span className={`text-sm px-3 py-1 rounded-lg ${isDark ? 'bg-teal-500/10 text-teal-400' : 'bg-teal-50 text-teal-600'}`}>
              {flows.filter(f => f.isEnabled).length}/{flows.length} {isAr ? 'مفعّلة' : 'active'}
            </span>
          )}
        </div>

        {/* No flows */}
        {flows.length === 0 && (
          <div className={`rounded-2xl p-10 text-center ${isDark ? 'bg-[#111113] border border-[#1f1f23]' : 'bg-white border border-gray-200'}`}>
            <WifiOff className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
            <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>
              {isAr ? 'لا توجد أتمتة مرتبطة بباقتك حالياً' : 'No automations linked to your plan'}
            </p>
          </div>
        )}

        {/* Flows List */}
        {flows.map((flow) => {
          const isToggling = togglingId === flow.id;
          const isExpanded = expandedFlow === flow.id;
          const endpointUrl = `${window.location.origin}/api/public/flow-status/${flow.flowKey}`;

          return (
            <div
              key={flow.id}
              className={`rounded-2xl overflow-hidden border transition-all ${
                flow.isEnabled
                  ? isDark ? 'bg-[#111113] border-teal-500/20' : 'bg-white border-teal-200'
                  : isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200'
              }`}
            >
              {/* Flow Main Row */}
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    {/* Status icon */}
                    <div className={`p-2.5 rounded-xl flex-shrink-0 ${
                      flow.isEnabled
                        ? isDark ? 'bg-teal-500/15' : 'bg-teal-50'
                        : isDark ? 'bg-[#1a1a1d]' : 'bg-gray-100'
                    }`}>
                      <Power className={`w-5 h-5 ${
                        flow.isEnabled
                          ? isDark ? 'text-teal-400' : 'text-teal-600'
                          : isDark ? 'text-gray-500' : 'text-gray-400'
                      }`} />
                    </div>
                    {/* Name & description */}
                    <div className="min-w-0 flex-1">
                      <h4 className={`font-bold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {flow.flowName}
                      </h4>
                      {flow.description && (
                        <p className={`text-sm mt-0.5 truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          {flow.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    {/* Status text */}
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${
                      flow.isEnabled
                        ? isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
                        : isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600'
                    }`}>
                      {flow.isEnabled ? (isAr ? 'مفعّلة' : 'ON') : (isAr ? 'متوقفة' : 'OFF')}
                    </span>

                    {/* Toggle Button */}
                    <button
                      onClick={() => handleToggleFlow(flow.id, flow.isEnabled)}
                      disabled={isToggling}
                      className={`relative w-14 h-7 rounded-full transition-all duration-300 focus:outline-none focus:ring-4 ${
                        isToggling ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                      } ${
                        flow.isEnabled
                          ? `bg-teal-500 ${isDark ? 'focus:ring-teal-500/30' : 'focus:ring-teal-300'}`
                          : `${isDark ? 'bg-[#2a2a2d]' : 'bg-gray-300'} ${isDark ? 'focus:ring-gray-600' : 'focus:ring-gray-300'}`
                      }`}
                    >
                      <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 flex items-center justify-center ${
                        flow.isEnabled ? 'left-7' : 'left-0.5'
                      }`}>
                        {isToggling && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
                      </span>
                    </button>

                    {/* Expand button */}
                    <button
                      onClick={() => setExpandedFlow(isExpanded ? null : flow.id)}
                      className={`p-2 rounded-lg transition-colors ${
                        isDark ? 'hover:bg-[#1a1a1d] text-gray-400' : 'hover:bg-gray-100 text-gray-500'
                      }`}
                      title={isAr ? 'عرض الـ API' : 'Show API'}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* ── Expanded: API Endpoint Info ── */}
              {isExpanded && (
                <div className={`px-5 pb-5 border-t ${isDark ? 'border-[#1f1f23]' : 'border-gray-100'}`}>
                  <div className="pt-4 space-y-3">
                    <p className={`text-sm font-medium flex items-center gap-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      <ExternalLink className="w-4 h-4 text-cyan-500" />
                      {isAr ? 'API للأنظمة الخارجية' : 'External System API'}
                    </p>
                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {isAr
                        ? 'استخدم هذا الـ Endpoint للتحقق من حالة هذه الأتمتة قبل تنفيذها.'
                        : 'Use this endpoint to check this automation status before execution.'}
                    </p>

                    {/* Endpoint URL */}
                    <div className={`rounded-xl overflow-hidden ${isDark ? 'bg-[#0a0a0b] border border-[#1f1f23]' : 'bg-gray-50 border border-gray-200'}`}>
                      <div className={`flex items-center gap-2 px-3 py-1.5 border-b ${isDark ? 'border-[#1f1f23]' : 'border-gray-200'}`}>
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-500">GET</span>
                        <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{flow.flowName}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 gap-2">
                        <code className={`text-xs break-all flex-1 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} dir="ltr">
                          {endpointUrl}
                        </code>
                        <button
                          onClick={() => handleCopyEndpoint(flow.flowKey)}
                          className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
                            copiedEndpoint === flow.flowKey
                              ? 'bg-emerald-500/20 text-emerald-500'
                              : isDark ? 'hover:bg-[#1a1a1d] text-gray-400' : 'hover:bg-gray-200 text-gray-500'
                          }`}
                        >
                          {copiedEndpoint === flow.flowKey ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Auth info */}
                    <div className={`text-xs space-y-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} dir="ltr">
                      <p>
                        <span className="font-medium text-cyan-500">Header:</span>{' '}
                        <code className={`px-1.5 py-0.5 rounded ${isDark ? 'bg-[#111113]' : 'bg-gray-200'}`}>
                          X-API-Key: your_sondos_api_key
                        </code>
                      </p>
                    </div>

                    {/* Example response */}
                    <pre className={`text-xs p-3 rounded-xl overflow-x-auto ${isDark ? 'bg-[#0a0a0b] text-gray-300' : 'bg-gray-50 text-gray-700'}`} dir="ltr">
{JSON.stringify({
  success: true,
  flowKey: flow.flowKey,
  flowName: flow.flowName,
  isEnabled: flow.isEnabled,
}, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════ */}
      {/* ── API KEY SECTION ── */}
      {/* ══════════════════════════════════════════ */}
      {apiKey && (
        <div className={`rounded-2xl p-6 ${isDark ? 'bg-[#111113] border border-[#1f1f23]' : 'bg-white border border-gray-200 shadow-sm'}`}>
          <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            <Key className="w-5 h-5 text-teal-500" />
            {isAr ? 'مفتاح API' : 'API Key'}
          </h3>
          <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {isAr
              ? 'استخدم هذا المفتاح في الـ Header عند استدعاء أي endpoint عام.'
              : 'Use this key in the Header when calling any public endpoint.'}
          </p>
          <div className={`flex items-center gap-2 p-3 rounded-xl ${isDark ? 'bg-[#0a0a0b] border border-[#2a2a2d]' : 'bg-gray-50 border border-gray-200'}`}>
            <code className={`text-xs flex-1 break-all ${isDark ? 'text-teal-400' : 'text-teal-600'}`} dir="ltr">
              {showApiKey ? apiKey : apiKey.substring(0, 6) + '••••••••••••••••' + apiKey.substring(apiKey.length - 4)}
            </code>
            <button
              onClick={() => setShowApiKey(!showApiKey)}
              className={`p-2 rounded-lg transition-colors flex-shrink-0 ${isDark ? 'hover:bg-[#1a1a1d] text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
            >
              {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <button
              onClick={handleCopyApiKey}
              className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
                copiedKey
                  ? 'bg-emerald-500/20 text-emerald-500'
                  : isDark ? 'hover:bg-[#1a1a1d] text-gray-400' : 'hover:bg-gray-100 text-gray-500'
              }`}
            >
              {copiedKey ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {/* ── Security Note ── */}
      <div className={`flex items-center gap-3 p-4 rounded-xl ${isDark ? 'bg-[#111113] border border-[#1f1f23]' : 'bg-gray-50 border border-gray-200'}`}>
        <Shield className={`w-5 h-5 flex-shrink-0 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
        <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          {isAr
            ? 'الـ Endpoints العامة للقراءة فقط (GET) — لا تسمح بتغيير الإعدادات. التحكم بالتفعيل والإيقاف متاح فقط من هذه الصفحة.'
            : 'Public endpoints are read-only (GET). Toggle controls are only available from this page.'}
        </p>
      </div>
    </div>
  );
}
