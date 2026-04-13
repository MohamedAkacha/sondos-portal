import { useState, useEffect } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import analyticsAPI from '@/services/api/analyticsAPI';
import usageAPI from '@/services/api/usageAPI';
import { BarChart3, Phone, MessageSquare, Users, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';

const PERIODS = [{ key: 'week', days: 7 }, { key: 'month', days: 30 }, { key: 'quarter', days: 90 }, { key: 'year', days: 365 }];
const SENTIMENT_COLORS = { very_positive: '#22c55e', positive: '#86efac', neutral: '#9ca3af', negative: '#fca5a5', very_negative: '#ef4444' };

export default function AnalyticsPage() {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [stats, setStats] = useState(null);
  const [overview, setOverview] = useState(null);

  useEffect(() => { loadData(); }, [period]);

  const loadData = async () => {
    try {
      setLoading(true);
      const days = PERIODS.find(p => p.key === period)?.days || 30;
      const startDate = new Date(); startDate.setDate(startDate.getDate() - days);
      const [statsRes, overviewRes] = await Promise.all([usageAPI.getStats(), analyticsAPI.getOverview({ startDate: startDate.toISOString() })]);
      setStats(statsRes.data?.data); setOverview(overviewRes.data?.data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const card = isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200';
  const text = isDark ? 'text-white' : 'text-gray-900';
  const textSec = isDark ? 'text-gray-400' : 'text-gray-600';
  const textMuted = isDark ? 'text-gray-500' : 'text-gray-500';

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className={`animate-spin ${textSec}`} size={32} /></div>;

  const kpis = [
    { label: t('analytics.kpis.totalCalls'), value: stats?.callsThisMonth || 0, change: stats?.callsChange || 0, icon: Phone, color: 'teal' },
    { label: t('analytics.kpis.activeChats'), value: stats?.chatsThisMonth || 0, icon: MessageSquare, color: 'cyan' },
    { label: t('analytics.kpis.totalLeads'), value: stats?.totalLeads || 0, icon: Users, color: 'emerald' },
    { label: t('billing.usage.callMinutes'), value: stats?.usage?.callMinutes || 0, icon: BarChart3, color: 'purple' },
  ];

  const kpiColors = {
    teal: isDark ? 'from-teal-500/20 to-teal-600/10 border-teal-500/30' : 'from-teal-50 to-teal-100/50 border-teal-200',
    cyan: isDark ? 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30' : 'from-cyan-50 to-cyan-100/50 border-cyan-200',
    emerald: isDark ? 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30' : 'from-emerald-50 to-emerald-100/50 border-emerald-200',
    purple: isDark ? 'from-purple-500/20 to-purple-600/10 border-purple-500/30' : 'from-purple-50 to-purple-100/50 border-purple-200',
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className={`text-2xl font-bold ${text}`}>{t('analytics.title')}</h1>
        <div className="flex gap-2">
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 rounded-xl text-sm border transition ${period === p.key
                ? 'bg-teal-500/10 text-teal-500 border-teal-500/20'
                : isDark ? 'bg-[#1a1a1d] border-[#1f1f23] text-gray-400 hover:text-white' : 'bg-white border-gray-200 text-gray-600 hover:text-gray-900'}`}>
              {t(`analytics.period.${p.key}`)}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {kpis.map((kpi, i) => (
          <div key={i} className={`bg-gradient-to-br ${kpiColors[kpi.color]} border rounded-2xl p-6`}>
            <div className="flex items-center justify-between mb-3">
              <kpi.icon size={20} className={`text-${kpi.color}-400`} />
              {kpi.change !== undefined && kpi.change !== 0 && (
                <div className={`flex items-center gap-1 text-xs ${kpi.change > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {kpi.change > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />} {Math.abs(kpi.change)}%
                </div>
              )}
            </div>
            <div className={`text-2xl font-bold ${text}`}>{kpi.value.toLocaleString()}</div>
            <div className={`text-sm mt-1 ${textSec}`}>{kpi.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Sentiment */}
        <div className={`rounded-2xl p-6 border ${card}`}>
          <h3 className={`font-semibold mb-4 ${text}`}>{t('analytics.charts.sentimentDistribution')}</h3>
          {overview?.sentimentDistribution && Object.keys(overview.sentimentDistribution).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(overview.sentimentDistribution).map(([sentiment, count]) => {
                const total = Object.values(overview.sentimentDistribution).reduce((a, b) => a + b, 0);
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={sentiment}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className={textSec}>{t(`calls.analysis.sentiments.${sentiment}`)}</span>
                      <span className={textMuted}>{count} ({pct}%)</span>
                    </div>
                    <div className={`w-full rounded-full h-2 ${isDark ? 'bg-[#1a1a1d]' : 'bg-gray-100'}`}>
                      <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: SENTIMENT_COLORS[sentiment] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <p className={`text-center py-8 ${textMuted}`}>{t('common.noData')}</p>}
        </div>

        {/* Topics */}
        <div className={`rounded-2xl p-6 border ${card}`}>
          <h3 className={`font-semibold mb-4 ${text}`}>{t('analytics.charts.topTopics')}</h3>
          {overview?.topTopics?.length > 0 ? (
            <div className="space-y-3">
              {overview.topTopics.map((item, i) => (
                <div key={i} className={`flex items-center justify-between p-3 rounded-xl ${isDark ? 'bg-[#0a0a0b]' : 'bg-gray-50'}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-teal-500/20 text-teal-400 w-6 h-6 rounded-full flex items-center justify-center font-medium">{i + 1}</span>
                    <span className={`text-sm ${text}`}>{item.topic}</span>
                  </div>
                  <span className={`text-sm ${textMuted}`}>{item.count}</span>
                </div>
              ))}
            </div>
          ) : <p className={`text-center py-8 ${textMuted}`}>{t('common.noData')}</p>}
        </div>

        {/* Intent */}
        <div className={`rounded-2xl p-6 border ${card}`}>
          <h3 className={`font-semibold mb-4 ${text}`}>{t('calls.analysis.intent')}</h3>
          {overview?.intentDistribution && Object.keys(overview.intentDistribution).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(overview.intentDistribution).sort((a, b) => b[1] - a[1]).map(([intent, count]) => (
                <div key={intent} className={`flex items-center justify-between py-2 border-b ${isDark ? 'border-[#1f1f23]' : 'border-gray-100'}`}>
                  <span className={`text-sm ${textSec}`}>{t(`calls.analysis.intents.${intent}`)}</span>
                  <span className={`text-sm font-medium ${text}`}>{count}</span>
                </div>
              ))}
            </div>
          ) : <p className={`text-center py-8 ${textMuted}`}>{t('common.noData')}</p>}
        </div>

        {/* Performance */}
        <div className={`rounded-2xl p-6 border ${card}`}>
          <h3 className={`font-semibold mb-4 ${text}`}>{t('calls.analysis.agentPerformance')}</h3>
          {overview?.avgPerformance?.total > 0 ? (
            <div className="grid grid-cols-2 gap-4">
              {['avgAccuracy', 'avgHelpfulness', 'avgProfessionalism', 'avgOverall'].map(key => (
                <div key={key} className={`text-center p-4 rounded-xl ${isDark ? 'bg-[#0a0a0b]' : 'bg-gray-50'}`}>
                  <div className="text-2xl font-bold text-teal-400">{(overview.avgPerformance[key] || 0).toFixed(1)}</div>
                  <div className={`text-xs mt-1 ${textMuted}`}>{t(`calls.analysis.${key.replace('avg', '').toLowerCase()}`)}</div>
                </div>
              ))}
            </div>
          ) : <p className={`text-center py-8 ${textMuted}`}>{t('common.noData')}</p>}
        </div>
      </div>
    </div>
  );
}
