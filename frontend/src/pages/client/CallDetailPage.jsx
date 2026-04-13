import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import analyticsAPI from '@/services/api/analyticsAPI';
import { ArrowLeft, Brain, BarChart3, FileText, Loader2, CheckCircle, XCircle } from 'lucide-react';

const SENTIMENT_BADGE = {
  very_positive: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  positive: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  neutral: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  negative: 'bg-red-500/10 text-red-300 border-red-500/20',
  very_negative: 'bg-red-500/10 text-red-400 border-red-500/20',
};

export default function CallDetailPage() {
  const { id } = useParams();
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [call, setCall] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [extraction, setExtraction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState('transcript');

  useEffect(() => { loadData(); }, [id]);
  const loadData = async () => {
    try {
      setLoading(true);
      const callRes = await fetch(`/api/livekit/calls/${id}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` } });
      const callData = await callRes.json(); setCall(callData.data || callData);
      const [aRes, eRes] = await Promise.all([
        analyticsAPI.getCallAnalysis(id).catch(() => ({ data: { data: null } })),
        analyticsAPI.getCallExtraction(id).catch(() => ({ data: { data: null } })),
      ]);
      setAnalysis(aRes.data?.data); setExtraction(eRes.data?.data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };
  const handleAnalyze = async () => {
    try { setAnalyzing(true);
      const [aRes, eRes] = await Promise.all([analyticsAPI.analyzeCall(id), analyticsAPI.extractVariables(id)]);
      setAnalysis(aRes.data?.data); setExtraction(eRes.data?.data);
    } catch (err) { console.error(err); } finally { setAnalyzing(false); }
  };

  const card = isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200';
  const text = isDark ? 'text-white' : 'text-gray-900';
  const textSec = isDark ? 'text-gray-400' : 'text-gray-600';
  const textMuted = isDark ? 'text-gray-500' : 'text-gray-500';
  const inner = isDark ? 'bg-[#0a0a0b]' : 'bg-gray-50';
  const border = isDark ? 'border-[#1f1f23]' : 'border-gray-200';

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className={`animate-spin ${textSec}`} size={32} /></div>;
  const tabs = [
    { key: 'transcript', label: t('calls.detail.transcript'), icon: FileText },
    { key: 'analysis', label: t('calls.detail.analysis'), icon: Brain },
    { key: 'extraction', label: t('calls.detail.extraction'), icon: BarChart3 },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/calls')} className={`p-2 rounded-lg ${isDark ? 'hover:bg-[#1a1a1d]' : 'hover:bg-gray-100'}`}><ArrowLeft size={20} className={textSec} /></button>
          <div>
            <h1 className={`text-xl font-bold ${text}`}>{call?.roomName || 'Call Detail'}</h1>
            <div className={`flex items-center gap-3 text-sm mt-1 ${textMuted}`}>
              <span>{call?.formattedDuration || '00:00'}</span><span>•</span>
              <span>{new Date(call?.createdAt).toLocaleString('ar-SA')}</span>
            </div>
          </div>
        </div>
        {!analysis && (
          <button onClick={handleAnalyze} disabled={analyzing}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 disabled:opacity-50 text-white font-bold rounded-xl transition">
            {analyzing ? <Loader2 size={16} className="animate-spin" /> : <Brain size={16} />} تحليل المكالمة
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-6">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm border transition ${activeTab === tab.key
              ? 'bg-teal-500/10 text-teal-500 border-teal-500/20' : isDark ? 'bg-[#1a1a1d] border-[#1f1f23] text-gray-400 hover:text-white' : 'bg-white border-gray-200 text-gray-600 hover:text-gray-900'}`}>
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'transcript' && (
        <div className={`rounded-2xl p-6 border ${card}`}>
          {(!call?.transcript || call.transcript.length === 0) ? <p className={`text-center py-8 ${textMuted}`}>{t('common.noData')}</p> : (
            <div className="space-y-4">
              {call.transcript.map((entry, i) => (
                <div key={i} className={`flex ${entry.speaker === 'agent' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-3 border ${entry.speaker === 'agent'
                    ? (isDark ? 'bg-teal-500/10 border-teal-500/20' : 'bg-teal-50 border-teal-200')
                    : (isDark ? 'bg-[#1a1a1d] border-[#27272a]' : 'bg-gray-100 border-gray-200')}`}>
                    <div className={`text-xs mb-1 ${textMuted}`}>{entry.speaker === 'agent' ? '🤖 المساعد' : '👤 العميل'}</div>
                    <p className={`text-sm leading-relaxed ${text}`}>{entry.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'analysis' && (
        <div className="space-y-4">
          {!analysis ? (
            <div className={`rounded-2xl p-12 border text-center ${card}`}>
              <Brain className={`mx-auto mb-4 ${textMuted}`} size={48} />
              <p className={`mb-4 ${textSec}`}>لم يتم تحليل هذه المكالمة بعد</p>
              <button onClick={handleAnalyze} disabled={analyzing} className="px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-bold rounded-xl">{analyzing ? 'جاري التحليل...' : 'تحليل الآن'}</button>
            </div>
          ) : (<>
            <div className={`rounded-2xl p-6 border ${card}`}><h3 className={`font-semibold mb-3 ${text}`}>{t('calls.analysis.summary')}</h3><p className={`leading-relaxed ${textSec}`}>{analysis.summary}</p></div>
            <div className="grid grid-cols-2 gap-4">
              <div className={`rounded-2xl p-6 border ${card}`}><h3 className={`text-sm mb-2 ${textMuted}`}>{t('calls.analysis.sentiment')}</h3><span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium border ${SENTIMENT_BADGE[analysis.sentiment]}`}>{t(`calls.analysis.sentiments.${analysis.sentiment}`)}</span></div>
              <div className={`rounded-2xl p-6 border ${card}`}><h3 className={`text-sm mb-2 ${textMuted}`}>{t('calls.analysis.intent')}</h3><span className={`text-lg font-medium ${text}`}>{t(`calls.analysis.intents.${analysis.intent}`)}</span></div>
            </div>
            {analysis.topics?.length > 0 && <div className={`rounded-2xl p-6 border ${card}`}><h3 className={`text-sm mb-3 ${textMuted}`}>{t('calls.analysis.topics')}</h3><div className="flex flex-wrap gap-2">{analysis.topics.map((topic, i) => <span key={i} className="px-3 py-1 bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-full text-sm">{topic}</span>)}</div></div>}
            <div className={`rounded-2xl p-6 border ${card}`}><h3 className={`text-sm mb-4 ${textMuted}`}>{t('calls.analysis.agentPerformance')}</h3><div className="grid grid-cols-4 gap-4">{['accuracy','helpfulness','professionalism','overall'].map(key => <div key={key} className={`text-center p-4 rounded-xl ${inner}`}><div className="text-2xl font-bold text-teal-400">{analysis.performance?.[key] || 0}/10</div><div className={`text-xs mt-1 ${textMuted}`}>{t(`calls.analysis.${key}`)}</div></div>)}</div></div>
          </>)}
        </div>
      )}

      {activeTab === 'extraction' && (
        <div className={`rounded-2xl p-6 border ${card}`}>
          {!extraction || !extraction.variables || Object.keys(extraction.variables).length === 0 ? (
            <div className="text-center py-8"><BarChart3 className={`mx-auto mb-4 ${textMuted}`} size={48} /><p className={textSec}>{t('calls.extraction.noVariables')}</p></div>
          ) : (
            <div><div className="flex items-center justify-between mb-4"><h3 className={`font-semibold ${text}`}>{t('calls.extraction.title')}</h3><span className={`text-sm ${textMuted}`}>ثقة: {Math.round((extraction.confidence || 0) * 100)}%</span></div>
              <div className="space-y-3">{Object.entries(extraction.variables).map(([key, value]) => (
                <div key={key} className={`flex items-center justify-between py-3 border-b ${border}`}><span className={textSec}>{key}</span>
                  <div className="flex items-center gap-2">{value != null ? <><CheckCircle size={14} className="text-emerald-400" /><span className={`font-medium ${text}`}>{String(value)}</span></> : <><XCircle size={14} className={textMuted} /><span className={textMuted}>{t('calls.extraction.notFound')}</span></>}</div>
                </div>))}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
