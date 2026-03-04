import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  CreditCard, Phone, Check, AlertCircle, BarChart3, Settings,
  TrendingUp, Calendar, Clock, PhoneIncoming, PhoneOutgoing, Users,
  Bot, Database, Megaphone, Loader2, RefreshCw, Mic, Hash
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { 
  callsAPI, leadsAPI, campaignsAPI, assistantsAPI, 
  knowledgebasesAPI, phoneNumbersAPI, userAPI 
} from "@/services/api/sondosAPI";

export default function OverviewPage() {
  const { isDark } = useTheme();
  const { t, isAr } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [balance, setBalance] = useState(0);
  
  // Data from API
  const [data, setData] = useState({
    calls: [],
    leads: [],
    campaigns: [],
    assistants: [],
    knowledgebases: [],
    phoneNumbers: [],
    recentCalls: [],
    stats: {
      totalCalls: 0,
      todayCalls: 0,
      answeredCalls: 0,
      missedCalls: 0,
      inboundCalls: 0,
      outboundCalls: 0,
      totalLeads: 0,
      todayLeads: 0,
      totalCampaigns: 0,
      activeCampaigns: 0,
      totalAssistants: 0,
      answerRate: 0,
    }
  });

  useEffect(() => {
    loadOverviewData();
  }, []);

  const loadOverviewData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch all data in parallel
      const [callsRes, leadsRes, campaignsRes, assistantsRes, kbRes, phonesRes, userRes] = await Promise.allSettled([
        callsAPI.getAll({ per_page: 50 }),
        leadsAPI.getAll({ per_page: 50 }),
        campaignsAPI.getAll(),
        assistantsAPI.getAll(),
        knowledgebasesAPI.getAll(),
        phoneNumbersAPI.getAll(),
        userAPI.me()
      ]);

      // Process user balance
      if (userRes.status === 'fulfilled') {
        const u = userRes.value;
        setBalance(parseFloat(u?.total_balance ?? u?.balance ?? u?.credits ?? 0));
      }

      // Process calls
      let calls = [];
      let totalCalls = 0;
      if (callsRes.status === 'fulfilled') {
        const res = callsRes.value;
        calls = res.data || res || [];
        totalCalls = res.total || calls.length;
      }

      // Process leads
      let leads = [];
      let totalLeads = 0;
      if (leadsRes.status === 'fulfilled') {
        const res = leadsRes.value;
        leads = res.data || res || [];
        totalLeads = res.total || leads.length;
      }

      // Process campaigns
      let campaigns = [];
      if (campaignsRes.status === 'fulfilled') {
        const res = campaignsRes.value;
        campaigns = res.data || res || [];
      }

      // Process assistants
      let assistants = [];
      if (assistantsRes.status === 'fulfilled') {
        const res = assistantsRes.value;
        assistants = res.data || res || [];
      }

      // Process knowledgebases
      let knowledgebases = [];
      if (kbRes.status === 'fulfilled') {
        const res = kbRes.value;
        knowledgebases = res.data || res || [];
      }

      // Process phone numbers
      let phoneNumbers = [];
      if (phonesRes.status === 'fulfilled') {
        const res = phonesRes.value;
        phoneNumbers = res.data || res || [];
      }

      // Calculate today's date
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Filter today's calls
      const todayCalls = calls.filter(call => {
        const callDate = new Date(call.created_at || call.date);
        callDate.setHours(0, 0, 0, 0);
        return callDate.getTime() === today.getTime();
      });

      // Filter today's leads
      const todayLeads = leads.filter(lead => {
        const leadDate = new Date(lead.created_at || lead.date);
        leadDate.setHours(0, 0, 0, 0);
        return leadDate.getTime() === today.getTime();
      });

      // Calculate call stats — using correct API field names
      // API: status = 'completed' | 'ended' | 'ended_by_customer' | 'ended_by_assistant' | 'no-answer' | 'failed' | 'busy' | 'in-progress' | 'ringing' | 'initiated'
      // API: type   = 'inbound' | 'outbound' | 'web'
      const answeredCalls = calls.filter(c =>
        ['completed', 'ended', 'ended_by_customer', 'ended_by_assistant'].includes(c.status)
      ).length;

      const missedCalls = calls.filter(c =>
        ['no-answer', 'failed', 'busy'].includes(c.status)
      ).length;

      const inboundCalls  = calls.filter(c => c.type === 'inbound').length;
      const outboundCalls = calls.filter(c => c.type === 'outbound').length;

      // Today specific stats
      const todayInbound  = todayCalls.filter(c => c.type === 'inbound').length;
      const todayOutbound = todayCalls.filter(c => c.type === 'outbound').length;

      // Active campaigns
      const activeCampaigns = campaigns.filter(c => 
        c.status === 'active' || c.status === 'running'
      ).length;

      // Answer rate
      const answerRate = totalCalls > 0 ? Math.round((answeredCalls / totalCalls) * 100) : 0;

      // Recent calls (last 5)
      const recentCalls = calls.slice(0, 5);

      setData({
        calls,
        leads,
        campaigns,
        assistants,
        knowledgebases,
        phoneNumbers,
        recentCalls,
        stats: {
          totalCalls,
          todayCalls: todayCalls.length,
          answeredCalls,
          missedCalls,
          inboundCalls,
          outboundCalls,
          todayInbound,
          todayOutbound,
          totalLeads,
          todayLeads: todayLeads.length,
          totalCampaigns: campaigns.length,
          activeCampaigns,
          totalAssistants: assistants.length,
          totalKnowledgebases: knowledgebases.length,
          totalPhoneNumbers: phoneNumbers.length,
          answerRate,
        }
      });

    } catch (err) {
      console.error('Error loading overview data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const { stats, recentCalls, campaigns, assistants } = data;

  // Check if balance is low
  const isLowBalance = balance < 200;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-teal-500' : 'text-teal-600'}`} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('over.welcome')}</h1>
          <p className={`mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('over.subtitle')}</p>
        </div>
        <button 
          onClick={loadOverviewData}
          disabled={loading}
          className={`px-4 py-2.5 rounded-xl border flex items-center gap-2 ${isDark ? 'bg-[#1a1a1d] border-[#1f1f23] text-gray-400 hover:text-white' : 'bg-white border-gray-200 text-gray-600 hover:text-gray-900'}`}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {t('over.refresh')}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className={`flex items-center gap-3 p-4 rounded-xl ${isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className={isDark ? 'text-red-400' : 'text-red-600'}>{error}</span>
        </div>
      )}

      {/* Alert Banner - Low Balance */}
      {isLowBalance && (
        <div className={`flex items-center gap-4 p-4 rounded-2xl ${isDark ? 'bg-teal-500/10 border border-teal-500/30' : 'bg-teal-50 border border-teal-200'}`}>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-teal-500/20' : 'bg-teal-100'}`}>
            <AlertCircle className="w-6 h-6 text-teal-500" />
          </div>
          <div className="flex-1">
            <p className="text-teal-500 font-medium">{t('over.alertLowBalance')}</p>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('over.alertLowBalanceMsg').replace('{balance}', balance)}</p>
          </div>
          <button 
            onClick={() => navigate('/payment')}
            className="px-5 py-2.5 bg-gradient-to-l from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white font-bold rounded-xl transition-all flex-shrink-0">
            {t('over.recharge')}
          </button>
        </div>
      )}

      {/* Main Stats Cards */}
      <div className="grid grid-cols-3 gap-6">
        <StatCard
          icon={Phone}
          label={t('over.todayCalls')}
          value={stats.todayCalls}
          unit={t('over.calls')}
          color="cyan"
          isDark={isDark}
        />
        <StatCard
          icon={TrendingUp}
          label={t('over.answerRate')}
          value={stats.answerRate}
          unit="%"
          color="teal"
          isDark={isDark}
        />
        <StatCard
          icon={Check}
          label={t('over.systemStatus')}
          value={t('over.active')}
          status="active"
          color="emerald"
          isDark={isDark}
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('over.quickActions')}</h2>
        <div className="grid grid-cols-4 gap-4">
          <QuickActionCard
            icon={BarChart3}
            title={t('over.dashboard')}
            description={t('over.viewAnalytics')}
            color="cyan"
            isDark={isDark}
          />
          <QuickActionCard
            icon={Bot}
            title={t('over.assistants')}
            description={t('over.assistantsCount').replace('{count}', stats.totalAssistants)}
            color="teal"
            isDark={isDark}
          />
          <QuickActionCard
            icon={Megaphone}
            title={t('over.campaigns')}
            description={t('over.activeCount').replace('{count}', stats.activeCampaigns)}
            color="purple"
            isDark={isDark}
          />
          <QuickActionCard
            icon={Settings}
            title={t('over.settings')}
            description={t('over.configureAccount')}
            color="gray"
            isDark={isDark}
          />
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-2 gap-6">
        {/* Recent Calls */}
        <div className={`rounded-2xl p-6 border ${isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200'}`}>
          <h3 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('over.recentCalls')}</h3>
          {recentCalls.length === 0 ? (
            <p className={`text-center py-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t('over.noRecentCalls')}</p>
          ) : (
            <div className="space-y-3">
              {recentCalls.map((call, i) => (
                <ActivityItem 
                  key={call.id || i}
                  icon={call.type === 'outbound' ? PhoneOutgoing : PhoneIncoming}
                  text={call.client_phone_number || t('over.unknown')}
                  time={formatTimeAgo(call.created_at, t, isAr)}
                  status={call.status}
                  color={call.type === 'outbound' ? 'purple' : 'teal'}
                  isDark={isDark}
                />
              ))}
            </div>
          )}
        </div>

        {/* Active Assistants */}
        <div className={`rounded-2xl p-6 border ${isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200'}`}>
          <h3 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('over.yourAssistants')}</h3>
          {assistants.length === 0 ? (
            <p className={`text-center py-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t('over.noAssistants')}</p>
          ) : (
            <div className="space-y-3">
              {assistants.slice(0, 5).map((assistant, i) => (
                <div 
                  key={assistant.id || i} 
                  className={`flex items-center gap-3 p-3 rounded-xl ${isDark ? 'bg-[#0a0a0b] hover:bg-[#0f0f10]' : 'bg-gray-50 hover:bg-gray-100'} transition-colors`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    assistant.calls_direction === 'outbound' || assistant.direction === 'outbound'
                      ? 'bg-purple-500/10' : 'bg-teal-500/10'
                  }`}>
                    <Bot className={`w-5 h-5 ${
                      assistant.calls_direction === 'outbound' || assistant.direction === 'outbound'
                        ? 'text-purple-500' : 'text-teal-500'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {assistant.name || assistant.assistant_name || `${t('over.assistant')} ${assistant.id}`}
                    </p>
                    <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {assistant.language || '-'} • {assistant.calls_direction || assistant.direction || 'inbound'}
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs ${
                    assistant.is_active || assistant.status === 'active'
                      ? 'bg-emerald-500/10 text-emerald-500'
                      : isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {assistant.is_active || assistant.status === 'active' ? t('over.active') : t('over.inactive')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Today's Summary */}
      <div>
        <h2 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('over.todaySummary')}</h2>
        <div className="grid grid-cols-5 gap-4">
          <MiniStatCard icon={PhoneIncoming} label={t('over.inbound')} value={stats.todayInbound || 0} color="teal" isDark={isDark} />
          <MiniStatCard icon={PhoneOutgoing} label={t('over.outbound')} value={stats.todayOutbound || 0} color="purple" isDark={isDark} />
          <MiniStatCard icon={Users} label={t('over.newLeads')} value={stats.todayLeads} color="cyan" isDark={isDark} />
          <MiniStatCard icon={Megaphone} label={t('over.campaigns')} value={stats.totalCampaigns} color="orange" isDark={isDark} />
          <MiniStatCard icon={Database} label={t('over.knowledge')} value={stats.totalKnowledgebases || 0} color="emerald" isDark={isDark} />
        </div>
      </div>

      {/* System Overview */}
      <div className="grid grid-cols-4 gap-4">
        <SystemCard 
          icon={Phone} 
          label={t('over.totalCalls')} 
          value={stats.totalCalls.toLocaleString()} 
          subtext={t('over.answered').replace('{count}', stats.answeredCalls)}
          color="cyan" 
          isDark={isDark} 
        />
        <SystemCard 
          icon={Users} 
          label={t('over.totalLeads')} 
          value={stats.totalLeads.toLocaleString()} 
          subtext={t('over.inDatabase')}
          color="blue" 
          isDark={isDark} 
        />
        <SystemCard 
          icon={Bot} 
          label={t('over.assistants')} 
          value={stats.totalAssistants} 
          subtext={t('over.configured')}
          color="teal" 
          isDark={isDark} 
        />
        <SystemCard 
          icon={Mic} 
          label={t('over.phoneNumbers')} 
          value={stats.totalPhoneNumbers || 0} 
          subtext={t('over.connected')}
          color="purple" 
          isDark={isDark} 
        />
      </div>
    </div>
  );
}

// ================== Helper Functions ==================

function formatTimeAgo(dateStr, t, isAr) {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return t('over.justNow');
    if (diffMins < 60) return t('over.mAgo').replace('{n}', diffMins);
    if (diffHours < 24) return t('over.hAgo').replace('{n}', diffHours);
    if (diffDays < 7) return t('over.dAgo').replace('{n}', diffDays);
    return date.toLocaleDateString(isAr ? 'ar-SA' : 'en-US');
  } catch {
    return dateStr;
  }
}

// ================== Components ==================

function StatCard({ icon: Icon, label, value, unit, trend, trendDown, status, color, isDark }) {
  const { t } = useLanguage();
  const colorClasses = {
    teal: isDark ? 'from-teal-500/20 to-teal-600/10 border-teal-500/30' : 'from-teal-50 to-teal-100/50 border-teal-200',
    cyan: isDark ? 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30' : 'from-cyan-50 to-cyan-100/50 border-cyan-200',
    emerald: isDark ? 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30' : 'from-emerald-50 to-emerald-100/50 border-emerald-200',
  };

  const iconColorClasses = {
    teal: isDark ? 'bg-teal-500/20 text-teal-400' : 'bg-teal-100 text-teal-600',
    cyan: isDark ? 'bg-cyan-500/20 text-cyan-400' : 'bg-cyan-100 text-cyan-600',
    emerald: isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-600',
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} border rounded-2xl p-6`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 ${iconColorClasses[color]} rounded-xl flex items-center justify-center`}>
          <Icon className="w-6 h-6" />
        </div>
        {trend && (
          <span className={`text-sm font-medium ${trendDown ? 'text-red-500' : 'text-emerald-500'}`}>
            {trend}
          </span>
        )}
        {status === 'active' && (
          <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-500">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            {t('over.online')}
          </span>
        )}
      </div>
      <p className={`text-sm mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{label}</p>
      <div className="flex items-baseline gap-2">
        <span className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{value}</span>
        {unit && <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>{unit}</span>}
      </div>
    </div>
  );
}

function QuickActionCard({ icon: Icon, title, description, color, isDark }) {
  const colorClasses = {
    teal: 'hover:border-teal-500/50',
    cyan: 'hover:border-cyan-500/50',
    purple: 'hover:border-purple-500/50',
    gray: isDark ? 'hover:border-gray-500/50' : 'hover:border-gray-300',
  };

  const iconBgClasses = {
    teal: isDark ? 'bg-teal-500/10 group-hover:bg-teal-500/20' : 'bg-teal-50 group-hover:bg-teal-100',
    cyan: isDark ? 'bg-cyan-500/10 group-hover:bg-cyan-500/20' : 'bg-cyan-50 group-hover:bg-cyan-100',
    purple: isDark ? 'bg-purple-500/10 group-hover:bg-purple-500/20' : 'bg-purple-50 group-hover:bg-purple-100',
    gray: isDark ? 'bg-gray-500/10 group-hover:bg-gray-500/20' : 'bg-gray-100 group-hover:bg-gray-200',
  };

  const iconColorClasses = {
    teal: 'text-teal-500',
    cyan: 'text-cyan-500',
    purple: 'text-purple-500',
    gray: isDark ? 'text-gray-400' : 'text-gray-500',
  };

  return (
    <button className={`group border ${colorClasses[color]} rounded-2xl p-5 text-left transition-all w-full ${isDark ? 'bg-[#111113] border-[#1f1f23] hover:bg-[#1a1a1d]' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
      <div className={`w-12 h-12 ${iconBgClasses[color]} rounded-xl flex items-center justify-center mb-3 transition-colors`}>
        <Icon className={`w-6 h-6 ${iconColorClasses[color]} group-hover:scale-110 transition-transform`} />
      </div>
      <h3 className={`text-base font-bold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{description}</p>
    </button>
  );
}

function ActivityItem({ icon: Icon, text, time, status, color, isDark }) {
  const colorClasses = {
    teal: isDark ? 'bg-teal-500/10 text-teal-400' : 'bg-teal-50 text-teal-600',
    cyan: isDark ? 'bg-cyan-500/10 text-cyan-400' : 'bg-cyan-50 text-cyan-600',
    purple: isDark ? 'bg-purple-500/10 text-purple-400' : 'bg-purple-50 text-purple-600',
    emerald: isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600',
    orange: isDark ? 'bg-orange-500/10 text-orange-400' : 'bg-orange-50 text-orange-600',
  };

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${isDark ? 'bg-[#0a0a0b] hover:bg-[#0f0f10]' : 'bg-gray-50 hover:bg-gray-100'}`}>
      <div className={`w-10 h-10 ${colorClasses[color]} rounded-lg flex items-center justify-center flex-shrink-0`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`truncate ${isDark ? 'text-white' : 'text-gray-900'}`} dir="ltr">{text}</p>
        <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{time}</p>
      </div>
      {status && (
        <span className={`px-2 py-1 rounded text-xs ${
          ['completed', 'ended', 'ended_by_customer', 'ended_by_assistant'].includes(status)
            ? 'bg-emerald-500/10 text-emerald-500' :
          ['no-answer', 'failed', 'busy'].includes(status)
            ? 'bg-red-500/10 text-red-500' :
          isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'
        }`}>
          {status}
        </span>
      )}
    </div>
  );
}

function MiniStatCard({ icon: Icon, label, value, color, isDark }) {
  const colorClasses = {
    teal: 'text-teal-500',
    cyan: 'text-cyan-500',
    emerald: 'text-emerald-500',
    purple: 'text-purple-500',
    orange: 'text-orange-500',
    blue: 'text-blue-500',
  };

  return (
    <div className={`rounded-xl p-4 border ${isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200'}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${colorClasses[color]}`} />
        <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{label}</span>
      </div>
      <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{value}</p>
    </div>
  );
}

function SystemCard({ icon: Icon, label, value, subtext, color, isDark }) {
  const colorClasses = {
    teal: isDark ? 'bg-teal-500/10 text-teal-400' : 'bg-teal-50 text-teal-600',
    cyan: isDark ? 'bg-cyan-500/10 text-cyan-400' : 'bg-cyan-50 text-cyan-600',
    blue: isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600',
    purple: isDark ? 'bg-purple-500/10 text-purple-400' : 'bg-purple-50 text-purple-600',
  };

  return (
    <div className={`rounded-xl p-5 border ${isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200'}`}>
      <div className={`w-10 h-10 ${colorClasses[color]} rounded-lg flex items-center justify-center mb-3`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className={`text-sm mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{label}</p>
      <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{value}</p>
      <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{subtext}</p>
    </div>
  );
}