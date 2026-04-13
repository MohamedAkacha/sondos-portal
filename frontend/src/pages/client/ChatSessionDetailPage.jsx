import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import chatAPI from '@/services/api/chatAPI';
import { ArrowLeft, Send, User, Bot, Wrench, Loader2, XCircle } from 'lucide-react';

export default function ChatSessionDetailPage() {
  const { id } = useParams();
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');

  useEffect(() => { loadSession(); }, [id]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [session?.messages]);

  const loadSession = async () => {
    try { setLoading(true); const res = await chatAPI.getSession(id); setSession(res.data?.data); }
    catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleSend = async () => {
    if (!input.trim() || sending || session?.status !== 'active') return;
    const msg = input.trim(); setInput(''); setSending(true);
    setSession(prev => ({ ...prev, messages: [...prev.messages, { role: 'user', content: msg, timestamp: new Date().toISOString() }] }));
    try {
      const res = await chatAPI.sendMessage(id, msg);
      const reply = res.data?.data?.reply;
      if (reply) setSession(prev => ({ ...prev, messages: [...prev.messages, { role: 'assistant', content: reply, timestamp: new Date().toISOString() }], messageCount: (prev.messageCount || 0) + 2 }));
    } catch (err) { console.error(err); } finally { setSending(false); }
  };

  const handleEnd = async () => {
    try { await chatAPI.endSession(id); setSession(prev => ({ ...prev, status: 'ended' })); } catch (err) { console.error(err); }
  };

  const text = isDark ? 'text-white' : 'text-gray-900';
  const textSec = isDark ? 'text-gray-400' : 'text-gray-600';
  const border = isDark ? 'border-[#1f1f23]' : 'border-gray-200';
  const inputBg = isDark ? 'bg-[#1a1a1d] border-[#27272a] text-white' : 'bg-white border-gray-300 text-gray-900';

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className={`animate-spin ${textSec}`} size={32} /></div>;
  if (!session) return <div className={`p-6 text-center ${textSec}`}>{t('common.noData')}</div>;

  const ROLE_STYLE = {
    user: { bubble: isDark ? 'bg-teal-500/10 border-teal-500/20' : 'bg-teal-50 border-teal-200', align: 'justify-end', label: '👤 الزائر' },
    assistant: { bubble: isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200', align: 'justify-start', label: '🤖 المساعد' },
    tool: { bubble: isDark ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-yellow-50 border-yellow-200', align: 'justify-start', label: '🔧 أداة' },
    system: { bubble: isDark ? 'bg-[#0a0a0b] border-[#1f1f23]' : 'bg-gray-100 border-gray-200', align: 'justify-start', label: '⚙️ النظام' },
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      <div className={`flex items-center justify-between p-4 border-b ${border}`}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/chat')} className={`p-2 rounded-lg ${isDark ? 'hover:bg-[#1a1a1d]' : 'hover:bg-gray-100'}`}><ArrowLeft size={20} className={textSec} /></button>
          <div>
            <h1 className={`font-bold ${text}`}>{session.visitorName || 'زائر مجهول'}</h1>
            <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{session.messageCount} {t('chat.messages')}</div>
          </div>
        </div>
        {session.status === 'active' && (
          <button onClick={handleEnd} className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-sm transition">
            <XCircle size={14} /> {t('chat.endChat')}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {session.messages?.map((msg, i) => {
          const style = ROLE_STYLE[msg.role] || ROLE_STYLE.system;
          return (
            <div key={i} className={`flex ${style.align}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-3 border ${style.bubble}`}>
                <div className={`text-xs mb-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{style.label}</div>
                <p className={`text-sm leading-relaxed whitespace-pre-wrap ${text}`}>{msg.content}</p>
                {msg.toolCall?.name && <div className="text-xs text-yellow-400 mt-1">🔧 {msg.toolCall.name}</div>}
              </div>
            </div>
          );
        })}
        {sending && (
          <div className="flex justify-start">
            <div className={`rounded-2xl px-4 py-3 border ${isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200'}`}>
              <Loader2 size={16} className="animate-spin text-teal-400" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {session.status === 'active' ? (
        <div className={`p-4 border-t ${border}`}>
          <div className="flex gap-3">
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              className={`flex-1 rounded-xl px-4 py-3 border focus:border-teal-500 focus:outline-none ${inputBg}`}
              placeholder={t('chat.typeMessage')} disabled={sending} />
            <button onClick={handleSend} disabled={sending || !input.trim()}
              className="px-4 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 disabled:opacity-50 text-white rounded-xl transition">
              <Send size={18} />
            </button>
          </div>
        </div>
      ) : (
        <div className={`p-4 border-t text-center text-sm ${border} ${textSec}`}>انتهت المحادثة</div>
      )}
    </div>
  );
}
