import { useState, useEffect } from "react";
import {
  Phone, Check, TrendingUp, Calendar, Clock, Users, BarChart3,
  PhoneIncoming, PhoneOutgoing, PhoneMissed, Star, User, Search,
  Filter, Download, RefreshCw, Plus, Eye, Edit, MoreVertical,
  Play, Pause, Volume2, FileText, X, MapPin, ArrowUpRight,
  ArrowDownRight, Loader2, AlertCircle, Bot, Database, Megaphone,
  Hash, Mic, Smartphone
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { 
  callsAPI, leadsAPI, campaignsAPI, assistantsAPI, 
  knowledgebasesAPI, phoneNumbersAPI 
} from "@/services/api/sondosAPI";
import { listAgents } from "@/services/api/agentAPI";

export default function DashboardPage() {
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedCall, setSelectedCall] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Data from API
  const [dashboardData, setDashboardData] = useState({
    calls: [],
    leads: [],
    campaigns: [],
    assistants: [],
    knowledgebases: [],
    phoneNumbers: [],
    stats: {
      totalCalls: 0,
      answeredCalls: 0,
      missedCalls: 0,
      inProgressCalls: 0,
      inboundCalls: 0,
      outboundCalls: 0,
      webCalls: 0,
      totalLeads: 0,
      totalCampaigns: 0,
      totalAssistants: 0,
      avgCallDuration: 0,
      answerRate: 0,
      totalAgents: 0,
      activeAgents: 0,
      totalPhones: 0,
    }
  });

  const tabs = [
    { id: "overview", label: t('dash.tabOverview'), icon: BarChart3 },
    { id: "calls", label: t('dash.tabCalls'), icon: Phone },
    { id: "leads", label: t('dash.tabLeads'), icon: Users },
  ];

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch all data in parallel
      const [callsRes, leadsRes, campaignsRes, assistantsRes, kbRes, phonesRes, agentsRes] = await Promise.allSettled([
        callsAPI.getAll({ per_page: 100 }),
        leadsAPI.getAll({ per_page: 100 }),
        campaignsAPI.getAll(),
        assistantsAPI.getAll(),
        knowledgebasesAPI.getAll(),
        phoneNumbersAPI.getAll(),
        listAgents(),
      ]);

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

      // Process agents (Sondos AI Agents)
      let agents = [];
      if (agentsRes.status === 'fulfilled') {
        const res = agentsRes.value;
        agents = res.agents || res.data || res || [];
      }

      // ========== STATS CALCULATION (Based on API docs) ==========
      // API field: status = 'initiated', 'ringing', 'busy', 'in-progress', 'ended', 
      //            'completed', 'ended_by_customer', 'ended_by_assistant', 'no-answer', 'failed'
      // API field: type = 'inbound', 'outbound', 'web'
      // API field: duration = integer (seconds)
      
      // Answered = completed, ended, ended_by_customer, ended_by_assistant
      const answeredCalls = calls.filter(c => 
        ['completed', 'ended', 'ended_by_customer', 'ended_by_assistant'].includes(c.status)
      ).length;
      
      // Missed = no-answer, failed, busy
      const missedCalls = calls.filter(c => 
        ['no-answer', 'failed', 'busy'].includes(c.status)
      ).length;
      
      // In Progress
      const inProgressCalls = calls.filter(c => 
        ['initiated', 'ringing', 'in-progress'].includes(c.status)
      ).length;
      
      // Direction uses 'type' field: inbound, outbound, web
      const inboundCalls = calls.filter(c => c.type === 'inbound').length;
      const outboundCalls = calls.filter(c => c.type === 'outbound').length;
      const webCalls = calls.filter(c => c.type === 'web').length;

      // Calculate average call duration (duration is in seconds)
      const callsWithDuration = calls.filter(c => c.duration && c.duration > 0);
      let avgDuration = 0;
      if (callsWithDuration.length > 0) {
        const totalDuration = callsWithDuration.reduce((acc, c) => acc + c.duration, 0);
        avgDuration = Math.round(totalDuration / callsWithDuration.length);
      }

      // Answer rate (answered / total)
      const answerRate = totalCalls > 0 ? Math.round((answeredCalls / totalCalls) * 100 * 10) / 10 : 0;
      
      // Debug log
      console.log('📊 Dashboard Stats:', { totalCalls, answeredCalls, missedCalls, inProgressCalls, inboundCalls, outboundCalls, webCalls, avgDuration, answerRate });

      setDashboardData({
        calls,
        leads,
        campaigns,
        assistants,
        knowledgebases,
        phoneNumbers,
        agents,
        stats: {
          totalCalls,
          answeredCalls,
          missedCalls,
          inProgressCalls,
          inboundCalls,
          outboundCalls,
          webCalls,
          totalLeads,
          totalCampaigns: campaigns.length,
          totalAssistants: assistants.length,
          totalKnowledgebases: knowledgebases.length,
          totalPhoneNumbers: phoneNumbers.length,
          avgCallDuration: avgDuration,
          answerRate,
          totalAgents: agents.length,
          activeAgents: agents.filter(a => a.status === 'active').length,
          totalPhones: phoneNumbers.length,
        }
      });

    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Parse duration string to seconds
  const parseDuration = (dur) => {
    if (typeof dur === 'number') return dur;
    if (!dur || dur === '-') return 0;
    const parts = dur.split(':');
    if (parts.length === 2) {
      return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    }
    if (parts.length === 3) {
      return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
    }
    return parseInt(dur) || 0;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('dash.title')}</h1>
          <p className={`mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('dash.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={loadDashboardData}
            disabled={loading}
            className={`px-4 py-2.5 rounded-xl border flex items-center gap-2 ${isDark ? 'bg-[#1a1a1d] border-[#1f1f23] text-gray-400 hover:text-white' : 'bg-white border-gray-200 text-gray-600 hover:text-gray-900'}`}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button className={`px-4 py-2.5 rounded-xl border flex items-center gap-2 ${isDark ? 'bg-[#1a1a1d] border-[#1f1f23] text-gray-400 hover:text-white' : 'bg-white border-gray-200 text-gray-600 hover:text-gray-900'}`}>
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className={`flex items-center gap-2 p-1.5 rounded-xl border w-fit ${isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-gray-100 border-gray-200'}`}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all ${
              activeTab === tab.id
                ? "bg-teal-500/20 text-teal-500 border border-teal-500/30"
                : isDark ? "text-gray-400 hover:text-white hover:bg-[#1a1a1d]" : "text-gray-500 hover:text-gray-900 hover:bg-gray-200"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className={`flex items-center gap-3 p-4 rounded-xl ${isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className={isDark ? 'text-red-400' : 'text-red-600'}>{error}</span>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-teal-500' : 'text-teal-600'}`} />
        </div>
      ) : (
        <>
          {activeTab === "overview" && <OverviewTab data={dashboardData} isDark={isDark} />}
          {activeTab === "calls" && <CallsTab calls={dashboardData.calls} setSelectedCall={setSelectedCall} isDark={isDark} />}
          {activeTab === "leads" && <LeadsTab leads={dashboardData.leads} isDark={isDark} />}
        </>
      )}

      {/* Call Details Modal */}
      {selectedCall && (
        <CallDetailsModal call={selectedCall} onClose={() => setSelectedCall(null)} isDark={isDark} />
      )}
    </div>
  );
}

// ================== Overview Tab ==================
function OverviewTab({ data, isDark }) {
  const { t } = useLanguage();
  const { stats, calls, campaigns, assistants } = data;

  // Format duration
  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get calls by day for chart (last 7 days)
  const getCallsByDay = () => {
    const days = [t('dash.sat'), t('dash.sun'), t('dash.mon'), t('dash.tue'), t('dash.wed'), t('dash.thu'), t('dash.fri')];
    const today = new Date();
    const last7Days = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dayName = days[date.getDay()];
      
      // Count calls for this day
      const count = calls.filter(call => {
        const callDate = new Date(call.created_at || call.date);
        return callDate.toDateString() === date.toDateString();
      }).length;
      
      last7Days.push({ day: dayName, count });
    }
    
    return last7Days;
  };

  const callsByDay = getCallsByDay();
  const maxCalls = Math.max(...callsByDay.map(d => d.count), 1);

  return (
    <div className="space-y-6">
      {/* Main KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <KPICard icon={Phone} title={t('dash.totalCalls')} value={stats.totalCalls.toLocaleString()} color="cyan" isDark={isDark} />
        <KPICard icon={Check} title={t('dash.answered')} value={stats.answeredCalls.toLocaleString()} color="emerald" isDark={isDark} />
        <KPICard icon={TrendingUp} title={t('dash.answerRate')} value={`${stats.answerRate}%`} color="teal" isDark={isDark} />
        <KPICard icon={Clock} title={t('dash.avgDuration')} value={formatDuration(stats.avgCallDuration)} color="orange" isDark={isDark} />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <KPICard icon={Users} title={t('dash.totalLeads')} value={stats.totalLeads.toLocaleString()} color="blue" isDark={isDark} />
        <KPICard icon={Megaphone} title={t('dash.campaigns')} value={stats.totalCampaigns} color="purple" isDark={isDark} />
        <KPICard icon={Bot} title={t('dash.assistants')} value={stats.totalAssistants} color="pink" isDark={isDark} />
        <KPICard icon={Database} title={t('dash.knowledgeBases')} value={stats.totalKnowledgebases || 0} color="yellow" isDark={isDark} />
      </div>

      {/* Agents & Phones Stats */}
      <div className="grid grid-cols-3 gap-4">
        <KPICard icon={Bot} title="المساعدين الأذكياء" value={stats.totalAgents} color="teal" isDark={isDark} />
        <KPICard icon={Check} title="مساعدين نشطين" value={stats.activeAgents} color="emerald" isDark={isDark} />
        <KPICard icon={Smartphone} title="أرقام الهاتف" value={stats.totalPhones} color="cyan" isDark={isDark} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Daily Calls Chart */}
        <div className={`rounded-2xl p-6 border ${isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200'}`}>
          <h3 className={`text-lg font-bold mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('dash.dailyCalls')}</h3>
          <div className="h-64 flex items-end justify-between gap-3">
            {callsByDay.map((item, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.count}</span>
                <div
                  className="w-full bg-gradient-to-t from-teal-600 to-cyan-400 rounded-t-lg transition-all hover:from-teal-500 hover:to-cyan-300"
                  style={{ height: `${(item.count / maxCalls) * 100}%`, minHeight: item.count > 0 ? '20px' : '4px' }}
                />
                <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{item.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Call Types Distribution */}
        <div className={`rounded-2xl p-6 border ${isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200'}`}>
          <h3 className={`text-lg font-bold mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('dash.callDistribution')}</h3>
          <div className="space-y-4">
            <StatBar 
              label={t('dash.inbound')} 
              value={stats.inboundCalls} 
              total={stats.totalCalls} 
              color="bg-blue-500" 
              isDark={isDark}
            />
            <StatBar 
              label={t('dash.outbound')} 
              value={stats.outboundCalls} 
              total={stats.totalCalls} 
              color="bg-purple-500" 
              isDark={isDark}
            />
            <StatBar 
              label={t('dash.web')} 
              value={stats.webCalls || 0} 
              total={stats.totalCalls} 
              color="bg-cyan-500" 
              isDark={isDark}
            />
            <StatBar 
              label={t('dash.answered')} 
              value={stats.answeredCalls} 
              total={stats.totalCalls} 
              color="bg-emerald-500" 
              isDark={isDark}
            />
            <StatBar 
              label={t('dash.missed')} 
              value={stats.missedCalls} 
              total={stats.totalCalls} 
              color="bg-red-500" 
              isDark={isDark}
            />
          </div>
        </div>
      </div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-3 gap-6">
        {/* Call Types */}
        <div className={`rounded-2xl p-6 border ${isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200'}`}>
          <h3 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('dash.callTypes')}</h3>
          <div className="flex items-center justify-around">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-2">
                <PhoneIncoming className="w-7 h-7 text-blue-500" />
              </div>
              <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{stats.inboundCalls}</p>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('dash.inbound')}</p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-2">
                <PhoneOutgoing className="w-7 h-7 text-purple-500" />
              </div>
              <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{stats.outboundCalls}</p>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('dash.outbound')}</p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-cyan-500/10 flex items-center justify-center mx-auto mb-2">
                <Phone className="w-7 h-7 text-cyan-500" />
              </div>
              <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{stats.webCalls || 0}</p>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('dash.web')}</p>
            </div>
          </div>
        </div>

        {/* Active Campaigns */}
        <div className={`rounded-2xl p-6 border ${isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200'}`}>
          <h3 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('dash.activeCampaigns')}</h3>
          {campaigns.length === 0 ? (
            <p className={`text-center py-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t('dash.noCampaigns')}</p>
          ) : (
            <div className="space-y-2">
              {campaigns.slice(0, 4).map((campaign, i) => (
                <div key={campaign.id || i} className={`flex items-center justify-between p-2 rounded-lg ${isDark ? 'bg-[#0a0a0b]' : 'bg-gray-50'}`}>
                  <span className={`text-sm truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{campaign.name || `Campaign ${campaign.id}`}</span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    campaign.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 
                    campaign.status === 'paused' ? 'bg-yellow-500/10 text-yellow-500' : 
                    isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {campaign.status || 'draft'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Assistants */}
        <div className={`rounded-2xl p-6 border ${isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200'}`}>
          <h3 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('dash.assistants')}</h3>
          {assistants.length === 0 ? (
            <p className={`text-center py-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t('dash.noAssistants')}</p>
          ) : (
            <div className="space-y-2">
              {assistants.slice(0, 4).map((assistant, i) => (
                <div key={assistant.id || i} className={`flex items-center gap-3 p-2 rounded-lg ${isDark ? 'bg-[#0a0a0b]' : 'bg-gray-50'}`}>
                  <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-teal-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {assistant.name || assistant.assistant_name || `Assistant ${assistant.id}`}
                    </p>
                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {assistant.language || '-'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ================== Calls Tab ==================
function CallsTab({ calls, setSelectedCall, isDark }) {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");

  // API fields: client_phone_number, assistant_name, status, type
  const filteredCalls = calls.filter(call => {
    const matchesSearch = !searchQuery || 
      (call.client_phone_number || '').includes(searchQuery) ||
      (call.assistant_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (call.campaign_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = filterStatus === "all" || call.status === filterStatus;
    const matchesType = filterType === "all" || call.type === filterType;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  // Helper functions using correct API field names
  const getCallStatus = (call) => call.status || 'unknown';
  const getCallType = (call) => call.type || 'unknown'; // inbound, outbound, web
  const getCallPhone = (call) => call.client_phone_number || '-';
  const getCallDuration = (call) => {
    const dur = call.duration;
    if (!dur || dur === 0) return '-';
    const mins = Math.floor(dur / 60);
    const secs = dur % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  const getCallDate = (call) => {
    if (!call.created_at) return '-';
    try {
      return new Date(call.created_at).toLocaleDateString();
    } catch {
      return call.created_at;
    }
  };
  const getCallTime = (call) => {
    if (!call.created_at) return '-';
    try {
      return new Date(call.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '-';
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className={`absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
          <input
            type="text"
            placeholder={t('dash.searchPhone')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-4 pr-11 py-2.5 rounded-xl border ${isDark ? 'bg-[#111113] border-[#1f1f23] text-white' : 'bg-white border-gray-200 text-gray-900'}`}
          />
        </div>
        {/* Status Filter - API values */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className={`px-4 py-2.5 rounded-xl border ${isDark ? 'bg-[#111113] border-[#1f1f23] text-white' : 'bg-white border-gray-200 text-gray-900'}`}
        >
          <option value="all">{t('dash.allStatus')}</option>
          <option value="completed">{t('dash.completed')}</option>
          <option value="ended">{t('dash.ended')}</option>
          <option value="ended_by_customer">{t('dash.endedByCustomer')}</option>
          <option value="ended_by_assistant">{t('dash.endedByAssistant')}</option>
          <option value="no-answer">{t('dash.noAnswer')}</option>
          <option value="failed">{t('dash.failed')}</option>
          <option value="busy">{t('dash.busy')}</option>
          <option value="in-progress">{t('dash.inProgress')}</option>
          <option value="ringing">{t('dash.ringing')}</option>
          <option value="initiated">{t('dash.initiated')}</option>
        </select>
        {/* Type Filter - API values */}
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className={`px-4 py-2.5 rounded-xl border ${isDark ? 'bg-[#111113] border-[#1f1f23] text-white' : 'bg-white border-gray-200 text-gray-900'}`}
        >
          <option value="all">{t('dash.allTypes')}</option>
          <option value="inbound">{t('dash.inbound')}</option>
          <option value="outbound">{t('dash.outbound')}</option>
          <option value="web">{t('dash.web')}</option>
        </select>
        <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>{filteredCalls.length} {t('dash.calls')}</span>
      </div>

      {/* Calls Table */}
      <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200'}`}>
        {filteredCalls.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Phone className={`w-16 h-16 mb-4 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
            <p className={`text-lg font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('dash.noCalls')}</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className={`border-b ${isDark ? 'border-[#1f1f23]' : 'border-gray-200'}`}>
                <th className={`text-left px-6 py-4 text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('dash.phone')}</th>
                <th className={`text-left px-6 py-4 text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('dash.type')}</th>
                <th className={`text-left px-6 py-4 text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('dash.status')}</th>
                <th className={`text-left px-6 py-4 text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('dash.duration')}</th>
                <th className={`text-left px-6 py-4 text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('dash.date')}</th>
                <th className={`text-left px-6 py-4 text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('dash.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredCalls.slice(0, 50).map((call, i) => {
                const callType = getCallType(call);
                const callStatus = getCallStatus(call);
                const isAnswered = ['completed', 'ended', 'ended_by_customer', 'ended_by_assistant'].includes(callStatus);
                const isMissed = ['no-answer', 'failed', 'busy'].includes(callStatus);
                const isInProgress = ['initiated', 'ringing', 'in-progress'].includes(callStatus);
                
                return (
                  <tr key={call.id || i} className={`border-b transition-colors ${isDark ? 'border-[#1f1f23]/50 hover:bg-[#1a1a1d]' : 'border-gray-100 hover:bg-gray-50'}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          callType === 'outbound' ? 'bg-purple-500/10' : 
                          callType === 'web' ? 'bg-cyan-500/10' : 'bg-blue-500/10'
                        }`}>
                          {callType === 'outbound' ? 
                            <PhoneOutgoing className="w-5 h-5 text-purple-500" /> : 
                            callType === 'web' ?
                            <Phone className="w-5 h-5 text-cyan-500" /> :
                            <PhoneIncoming className="w-5 h-5 text-blue-500" />
                          }
                        </div>
                        <div>
                          <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`} dir="ltr">{getCallPhone(call)}</p>
                          <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{getCallTime(call)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs ${
                        callType === 'outbound' ? 'bg-purple-500/10 text-purple-500' : 
                        callType === 'web' ? 'bg-cyan-500/10 text-cyan-500' :
                        'bg-blue-500/10 text-blue-500'
                      }`}>
                        {callType}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs ${
                        isAnswered ? 'bg-emerald-500/10 text-emerald-500' :
                        isMissed ? 'bg-red-500/10 text-red-500' :
                        isInProgress ? 'bg-yellow-500/10 text-yellow-500' :
                        isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {callStatus}
                      </span>
                    </td>
                    <td className={`px-6 py-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{getCallDuration(call)}</td>
                    <td className={`px-6 py-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{getCallDate(call)}</td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => setSelectedCall(call)}
                        className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-[#222225]' : 'hover:bg-gray-100'}`}
                      >
                        <Eye className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ================== Leads Tab ==================
function LeadsTab({ leads, isDark }) {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  // API fields: id, phone_number, variables (object with customer_name, email, etc.), status, campaign
  const filteredLeads = leads.filter(lead => {
    if (!searchQuery && filterStatus === "all") return true;
    
    const query = searchQuery.toLowerCase();
    const name = lead.variables?.customer_name || lead.variables?.name || '';
    const phone = lead.phone_number || '';
    const email = lead.variables?.email || '';
    const campaignName = lead.campaign?.name || '';
    
    const matchesSearch = !searchQuery || 
      name.toLowerCase().includes(query) ||
      phone.includes(query) ||
      email.toLowerCase().includes(query) ||
      campaignName.toLowerCase().includes(query) ||
      String(lead.id).includes(query);
    
    const matchesStatus = filterStatus === "all" || lead.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  // Helper functions using correct API field names
  const getLeadName = (lead) => {
    // Check variables object first (API standard)
    if (lead.variables?.customer_name) return lead.variables.customer_name;
    if (lead.variables?.name) return lead.variables.name;
    if (lead.variables?.full_name) return lead.variables.full_name;
    // Fallback to Lead #ID
    return `Lead #${lead.id}`;
  };
  
  const getLeadPhone = (lead) => lead.phone_number || '-';
  
  const getLeadEmail = (lead) => {
    if (lead.variables?.email) return lead.variables.email;
    return '-';
  };
  
  const getLeadStatus = (lead) => lead.status || 'unknown';
  
  const getCampaignName = (lead) => lead.campaign?.name || '-';

  // Get unique statuses for filter
  const uniqueStatuses = [...new Set(leads.map(l => l.status).filter(Boolean))];

  // Status color mapping
  const getStatusColor = (status) => {
    switch(status) {
      case 'completed':
        return 'bg-emerald-500/10 text-emerald-500';
      case 'created':
        return 'bg-blue-500/10 text-blue-500';
      case 'reached-max-retries':
        return 'bg-orange-500/10 text-orange-500';
      case 'failed':
        return 'bg-red-500/10 text-red-500';
      case 'in-progress':
        return 'bg-yellow-500/10 text-yellow-500';
      case 'scheduled':
        return 'bg-purple-500/10 text-purple-500';
      default:
        return isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className={`absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
          <input
            type="text"
            placeholder={t('dash.searchLeads')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-4 pr-11 py-2.5 rounded-xl border ${isDark ? 'bg-[#111113] border-[#1f1f23] text-white' : 'bg-white border-gray-200 text-gray-900'}`}
          />
        </div>
        {/* Status Filter */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className={`px-4 py-2.5 rounded-xl border ${isDark ? 'bg-[#111113] border-[#1f1f23] text-white' : 'bg-white border-gray-200 text-gray-900'}`}
        >
          <option value="all">{t('dash.allStatus')}</option>
          <option value="created">{t('dash.created')}</option>
          <option value="completed">{t('dash.completed')}</option>
          <option value="reached-max-retries">{t('dash.maxRetries')}</option>
          <option value="failed">{t('dash.failed')}</option>
          <option value="in-progress">{t('dash.inProgress')}</option>
          <option value="scheduled">{t('dash.scheduled')}</option>
        </select>
        <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>{filteredLeads.length} {t('dash.leads')}</span>
      </div>

      {/* Leads Grid */}
      {filteredLeads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Users className={`w-16 h-16 mb-4 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
          <p className={`text-lg font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('dash.noLeads')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLeads.slice(0, 30).map((lead, i) => {
            const leadName = getLeadName(lead);
            const leadStatus = getLeadStatus(lead);
            
            return (
              <div key={lead.id || i} className={`rounded-xl p-4 border ${isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200'}`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-white font-bold">
                    {leadName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{leadName}</p>
                    <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`} dir="ltr">{getLeadPhone(lead)}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs whitespace-nowrap ${getStatusColor(leadStatus)}`}>
                    {leadStatus}
                  </span>
                </div>
                
                {/* Additional Info */}
                <div className="space-y-1">
                  {getLeadEmail(lead) !== '-' && (
                    <p className={`text-sm truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`} dir="ltr">
                      {getLeadEmail(lead)}
                    </p>
                  )}
                  {getCampaignName(lead) !== '-' && (
                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {t('dash.campaign')}: {getCampaignName(lead)}
                    </p>
                  )}
                </div>
                
                {/* Variables Preview (if any custom variables exist) */}
                {lead.variables && Object.keys(lead.variables).filter(k => !['customer_name', 'name', 'email', 'full_name'].includes(k)).length > 0 && (
                  <div className={`mt-3 pt-3 border-t ${isDark ? 'border-[#1f1f23]' : 'border-gray-100'}`}>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(lead.variables)
                        .filter(([key]) => !['customer_name', 'name', 'email', 'full_name'].includes(key))
                        .slice(0, 3)
                        .map(([key, value]) => (
                          <span 
                            key={key} 
                            className={`text-xs px-2 py-0.5 rounded ${isDark ? 'bg-[#1a1a1d] text-gray-400' : 'bg-gray-100 text-gray-500'}`}
                            title={`${key}: ${value}`}
                          >
                            {key}: {String(value).substring(0, 15)}{String(value).length > 15 ? '...' : ''}
                          </span>
                        ))
                      }
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ================== Call Details Modal ==================
function CallDetailsModal({ call, onClose, isDark }) {
  const { t } = useLanguage();
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useState(null);

  // API field names
  const getCallPhone = () => call.client_phone_number || '-';
  const getCallType = () => call.type || 'unknown'; // inbound, outbound, web
  const getCallStatus = () => call.status || 'unknown';
  const getCallDuration = () => {
    if (!call.duration || call.duration === 0) return '-';
    const mins = Math.floor(call.duration / 60);
    const secs = call.duration % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const callType = getCallType();
  const isAnswered = ['completed', 'ended', 'ended_by_customer', 'ended_by_assistant'].includes(call.status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className={`w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl ${isDark ? 'bg-[#111113]' : 'bg-white'}`}>
        <div className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-[#1f1f23]' : 'border-gray-200'}`}>
          <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('dash.callDetails')}</h2>
          <button onClick={onClose} className={`p-2 rounded-lg ${isDark ? 'hover:bg-[#1a1a1d]' : 'hover:bg-gray-100'}`}>
            <X className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(85vh-180px)] space-y-4">
          {/* Phone Header */}
          <div className="flex items-center gap-4 mb-6">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
              callType === 'outbound' ? 'bg-purple-500/10' : 
              callType === 'web' ? 'bg-cyan-500/10' : 'bg-blue-500/10'
            }`}>
              {callType === 'outbound' ? 
                <PhoneOutgoing className="w-8 h-8 text-purple-500" /> : 
                callType === 'web' ?
                <Phone className="w-8 h-8 text-cyan-500" /> :
                <PhoneIncoming className="w-8 h-8 text-blue-500" />
              }
            </div>
            <div>
              <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`} dir="ltr">{getCallPhone()}</h3>
              <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>ID: {call.id}</p>
            </div>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-3">
            <InfoCard label={t('dash.type')} value={callType} isDark={isDark} />
            <InfoCard label={t('dash.status')} value={getCallStatus()} isDark={isDark} />
            <InfoCard label={t('dash.duration')} value={getCallDuration()} isDark={isDark} />
            <InfoCard label={t('dash.date')} value={call.created_at ? new Date(call.created_at).toLocaleString() : '-'} isDark={isDark} />
            {call.assistant_name && <InfoCard label={t('dash.assistant')} value={call.assistant_name} isDark={isDark} />}
            {call.campaign_name && <InfoCard label={t('dash.campaign')} value={call.campaign_name} isDark={isDark} />}
            {call.assistant_phone_number && <InfoCard label={t('dash.assistantPhone')} value={call.assistant_phone_number} isDark={isDark} />}
            {call.answered_by && <InfoCard label={t('dash.answeredBy')} value={call.answered_by} isDark={isDark} />}
            {call.total_cost !== undefined && <InfoCard label={t('dash.totalCost')} value={`$${call.total_cost?.toFixed(3) || '0.000'}`} isDark={isDark} />}
            {call.carrier_cost !== undefined && <InfoCard label={t('dash.carrierCost')} value={`$${call.carrier_cost?.toFixed(3) || '0.000'}`} isDark={isDark} />}
          </div>

          {/* Variables */}
          {call.variables && Object.keys(call.variables).length > 0 && (
            <div className={`rounded-xl p-4 ${isDark ? 'bg-[#0a0a0b]' : 'bg-gray-50'}`}>
              <p className={`text-sm mb-3 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('dash.variables')}</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(call.variables).map(([key, value]) => (
                  <div key={key} className={`p-2 rounded-lg ${isDark ? 'bg-[#111113]' : 'bg-white'}`}>
                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{key}</p>
                    <p className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{String(value)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Evaluation */}
          {call.evaluation && Object.keys(call.evaluation).length > 0 && (
            <div className={`rounded-xl p-4 ${isDark ? 'bg-[#0a0a0b]' : 'bg-gray-50'}`}>
              <p className={`text-sm mb-3 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('dash.evaluation')}</p>
              <div className="grid grid-cols-3 gap-2">
                {call.evaluation.sentiment && (
                  <div className={`p-2 rounded-lg ${isDark ? 'bg-[#111113]' : 'bg-white'}`}>
                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t('dash.sentiment')}</p>
                    <p className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{call.evaluation.sentiment}</p>
                  </div>
                )}
                {call.evaluation.outcome && (
                  <div className={`p-2 rounded-lg ${isDark ? 'bg-[#111113]' : 'bg-white'}`}>
                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t('dash.outcome')}</p>
                    <p className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{call.evaluation.outcome}</p>
                  </div>
                )}
                {call.evaluation.score !== undefined && (
                  <div className={`p-2 rounded-lg ${isDark ? 'bg-[#111113]' : 'bg-white'}`}>
                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t('dash.score')}</p>
                    <p className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{call.evaluation.score}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Recording */}
          {call.recording_url && (
            <div className={`rounded-xl p-4 ${isDark ? 'bg-[#0a0a0b]' : 'bg-gray-50'}`}>
              <p className={`text-sm mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('dash.recording')}</p>
              <audio controls className="w-full" src={call.recording_url}>
                Your browser does not support audio.
              </audio>
            </div>
          )}

          {/* Transcript */}
          {call.transcript && (
            <div className={`rounded-xl p-4 ${isDark ? 'bg-[#0a0a0b]' : 'bg-gray-50'}`}>
              <p className={`text-sm mb-3 flex items-center gap-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                <FileText className="w-4 h-4" />
                {t('dash.transcript')}
              </p>
              <p className={`text-sm whitespace-pre-wrap ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{call.transcript}</p>
            </div>
          )}
        </div>

        <div className={`p-6 border-t ${isDark ? 'border-[#1f1f23]' : 'border-gray-200'}`}>
          <button onClick={onClose} className={`w-full py-3 rounded-xl font-medium ${isDark ? 'bg-[#1a1a1d] text-white hover:bg-[#222225]' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ================== Helper Components ==================

function KPICard({ icon: Icon, title, value, color, isDark }) {
  const colors = {
    cyan: "bg-cyan-500/10 text-cyan-500",
    emerald: "bg-emerald-500/10 text-emerald-500",
    teal: "bg-teal-500/10 text-teal-500",
    purple: "bg-purple-500/10 text-purple-500",
    orange: "bg-orange-500/10 text-orange-500",
    blue: "bg-blue-500/10 text-blue-500",
    red: "bg-red-500/10 text-red-500",
    yellow: "bg-yellow-500/10 text-yellow-500",
    pink: "bg-pink-500/10 text-pink-500",
  };

  return (
    <div className={`rounded-xl p-5 border ${isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 ${colors[color]} rounded-lg flex items-center justify-center`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className={`text-sm mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{title}</p>
      <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{value}</p>
    </div>
  );
}

function StatBar({ label, value, total, color, isDark }) {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
  
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{label}</span>
        <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{value} ({percentage}%)</span>
      </div>
      <div className={`w-full h-2 rounded-full ${isDark ? 'bg-[#1f1f23]' : 'bg-gray-200'}`}>
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

function InfoCard({ label, value, isDark }) {
  return (
    <div className={`p-3 rounded-xl ${isDark ? 'bg-[#0a0a0b]' : 'bg-gray-50'}`}>
      <p className={`text-xs mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{label}</p>
      <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{value}</p>
    </div>
  );
}