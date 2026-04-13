import { useState, useRef, useEffect } from 'react';
import { useTheme } from '@/hooks/useTheme';
import chatAPI from '@/services/api/chatAPI';
import { X, Send, Bot, User, Loader2, Wrench } from 'lucide-react';

export default function ChatTestModal({ agentId, agentName, onClose }) {
  const { isDark } = useTheme();
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [starting, setStarting] = useState(true);
  const endRef = useRef(null);

  useEffect(() => { startSession(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const startSession = async () => {
    try {
      const res = await chatAPI.startSession(agentId, { channel: 'test', visitorName: 'اختبار من الداشبورد' });
      const data = res.data?.data;
      setSessionId(data?.id);
      if (data?.messages?.length) setMessages(data.messages);
    } catch (e) { console.error(e); }
    finally { setStarting(false); }
  };

  const handleSend = async () => {
    if (!input.trim() || !sessionId || sending) return;
    const msg = input.trim(); setInput(''); setSending(true);
    setMessages(p => [...p, { role: 'user', content: msg }]);
    try {
      const res = await chatAPI.sendMessage(sessionId, msg);
      const reply = res.data?.data?.reply;
      if (reply) setMessages(p => [...p, { role: 'assistant', content: reply }]);
    } catch (e) { setMessages(p => [...p, { role: 'system', content: 'حدث خطأ' }]); }
    finally { setSending(false); }
  };

  const bg = isDark ? 'bg-[#0a0a0b]' : 'bg-gray-50';
  const card = isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200';
  const text = isDark ? 'text-white' : 'text-gray-900';
  const inputBg = isDark ? 'bg-[#1a1a1d] border-[#27272a] text-white' : 'bg-white border-gray-300 text-gray-900';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className={`w-full max-w-lg mx-4 rounded-2xl border flex flex-col overflow-hidden ${card}`} style={{ height: '70vh' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b ${isDark ? 'border-[#1f1f23]' : 'border-gray-200'}`}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-teal-400 to-cyan-500 rounded-lg flex items-center justify-center"><Bot size={16} className="text-white"/></div>
            <div><div className={`font-medium text-sm ${text}`}>اختبار: {agentName}</div><div className={`text-xs ${isDark?'text-gray-500':'text-gray-500'}`}>دردشة نصية تجريبية</div></div>
          </div>
          <button onClick={onClose} className={`p-2 rounded-lg ${isDark?'hover:bg-[#1a1a1d]':'hover:bg-gray-100'}`}><X size={18} className={isDark?'text-gray-400':'text-gray-500'}/></button>
        </div>

        {/* Messages */}
        <div className={`flex-1 overflow-y-auto p-4 space-y-3 ${bg}`}>
          {starting && <div className="text-center py-4"><Loader2 className="animate-spin text-teal-400 mx-auto" size={24}/><p className={`text-xs mt-2 ${isDark?'text-gray-500':'text-gray-500'}`}>جاري بدء المحادثة...</p></div>}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm border ${
                m.role === 'user' ? (isDark ? 'bg-teal-500/10 border-teal-500/20' : 'bg-teal-50 border-teal-200')
                : m.role === 'tool' ? (isDark ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-yellow-50 border-yellow-200')
                : (isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200')
              }`}>
                <p className={`leading-relaxed ${text}`}>{m.content}</p>
              </div>
            </div>
          ))}
          {sending && <div className="flex justify-start"><div className={`rounded-2xl px-4 py-2.5 border ${card}`}><Loader2 size={16} className="animate-spin text-teal-400"/></div></div>}
          <div ref={endRef}/>
        </div>

        {/* Input */}
        <div className={`p-3 border-t ${isDark ? 'border-[#1f1f23]' : 'border-gray-200'}`}>
          <div className="flex gap-2">
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()}
              className={`flex-1 rounded-xl px-4 py-2.5 border text-sm focus:border-teal-500 focus:outline-none ${inputBg}`}
              placeholder="اكتب رسالة..." disabled={sending || starting}/>
            <button onClick={handleSend} disabled={sending || !input.trim()}
              className="px-3 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-xl disabled:opacity-50">
              <Send size={16}/>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
