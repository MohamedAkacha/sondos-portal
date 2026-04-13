import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import chatAPI from '@/services/api/chatAPI';
import { MessageSquare, Clock, User, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

const STATUS_BADGE = {
  active: { bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', label: 'نشط' },
  ended: { bg: 'bg-gray-500/10 text-gray-400 border-gray-500/20', label: 'منتهي' },
  handed_off: { bg: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20', label: 'محوّل' },
};
const CHANNEL = { widget: '🌐 ودجت', api: '⚡ API', whatsapp: '💬 واتساب', telegram: '📱 تلغرام', test: '🧪 اختبار' };

export default function ChatSessionsPage() {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => { loadSessions(); }, [page, statusFilter]);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const res = await chatAPI.getSessions({ page, limit: 20, status: statusFilter || undefined });
      setSessions(res.data?.data?.sessions || []);
      setTotal(res.data?.data?.total || 0);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const totalPages = Math.ceil(total / 20);
  const card = isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200';
  const cardHover = isDark ? 'hover:bg-[#1a1a1d]' : 'hover:bg-gray-50';
  const text = isDark ? 'text-white' : 'text-gray-900';
  const textSec = isDark ? 'text-gray-400' : 'text-gray-600';
  const textMuted = isDark ? 'text-gray-500' : 'text-gray-500';

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className={`text-2xl font-bold ${text}`}>{t('chat.title')}</h1>
        <div className="flex gap-2">
          {['', 'active', 'ended', 'handed_off'].map(s => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-sm border transition ${statusFilter === s
                ? 'bg-teal-500/10 text-teal-500 border-teal-500/20'
                : isDark ? 'bg-[#1a1a1d] border-[#1f1f23] text-gray-400 hover:text-white' : 'bg-white border-gray-200 text-gray-600 hover:text-gray-900'}`}>
              {s ? STATUS_BADGE[s]?.label : t('common.all')}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16"><Loader2 className={`animate-spin mx-auto ${textSec}`} size={32} /></div>
      ) : sessions.length === 0 ? (
        <div className={`text-center py-16 rounded-2xl border ${card}`}>
          <MessageSquare className={`mx-auto mb-4 ${textMuted}`} size={48} />
          <h3 className={`text-lg font-medium mb-2 ${text}`}>{t('chat.empty.title')}</h3>
          <p className={textMuted}>{t('chat.empty.description')}</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {sessions.map(session => {
              const badge = STATUS_BADGE[session.status] || STATUS_BADGE.ended;
              return (
                <button key={session.id} onClick={() => navigate(`/chat/${session.id}`)}
                  className={`w-full text-start rounded-2xl p-5 border transition-all ${card} ${cardHover}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-cyan-500 rounded-full flex items-center justify-center">
                        <User size={18} className="text-white" />
                      </div>
                      <div>
                        <div className={`font-medium ${text}`}>{session.visitorName || 'زائر مجهول'}</div>
                        <div className={`flex items-center gap-2 text-xs mt-0.5 ${textMuted}`}>
                          <span>{CHANNEL[session.channel] || session.channel}</span>
                          <span>•</span>
                          <span>{session.messageCount} {t('chat.messages')}</span>
                          <span>•</span>
                          <span>{new Date(session.createdAt).toLocaleString('ar-SA')}</span>
                        </div>
                      </div>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${badge.bg}`}>
                      {badge.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-6">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className={`p-2 rounded-lg border disabled:opacity-30 ${isDark ? 'border-[#1f1f23] hover:bg-[#1a1a1d]' : 'border-gray-200 hover:bg-gray-50'}`}>
                <ChevronRight size={16} />
              </button>
              <span className={`text-sm ${textMuted}`}>{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className={`p-2 rounded-lg border disabled:opacity-30 ${isDark ? 'border-[#1f1f23] hover:bg-[#1a1a1d]' : 'border-gray-200 hover:bg-gray-50'}`}>
                <ChevronLeft size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
