import { useState, useEffect } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { Brain, Phone, Mail, Trash2, Search, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

export default function MemoryPage() {
  const { t } = useLanguage(); const { isDark } = useTheme();
  const [memories, setMemories] = useState([]); const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(''); const [expandedId, setExpandedId] = useState(null);

  useEffect(() => { loadMemories(); }, [search]);
  const loadMemories = async () => {
    try { setLoading(true);
      const token = localStorage.getItem('auth_token');
      const q = search ? `?search=${encodeURIComponent(search)}` : '';
      const res = await fetch(`/api/memory${q}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setMemories(data.data?.memories || []);
    } catch(e) { console.error(e); } finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('هل تريد مسح ذاكرة جهة الاتصال هذه؟')) return;
    try {
      const token = localStorage.getItem('auth_token');
      await fetch(`/api/memory/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      setMemories(p => p.filter(m => m.id !== id));
    } catch(e) { console.error(e); }
  };

  const card = isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200';
  const text = isDark ? 'text-white' : 'text-gray-900';
  const textSec = isDark ? 'text-gray-400' : 'text-gray-600';
  const textMuted = isDark ? 'text-gray-500' : 'text-gray-500';
  const inner = isDark ? 'bg-[#0a0a0b]' : 'bg-gray-50';
  const inputCls = `w-full rounded-xl px-4 py-2.5 border focus:border-teal-500 focus:outline-none ${isDark ? 'bg-[#1a1a1d] border-[#27272a] text-white' : 'bg-white border-gray-300 text-gray-900'}`;

  const SENTIMENT = { very_positive: 'إيجابي جداً', positive: 'إيجابي', neutral: 'محايد', negative: 'سلبي', very_negative: 'سلبي جداً' };
  const SENTIMENT_CLR = { very_positive: 'text-emerald-400', positive: 'text-emerald-300', neutral: textMuted, negative: 'text-red-300', very_negative: 'text-red-400' };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-cyan-500 rounded-xl flex items-center justify-center"><Brain size={20} className="text-white"/></div>
          <div><h1 className={`text-2xl font-bold ${text}`}>ذاكرة المحادثات</h1><p className={`text-sm ${textMuted}`}>ماذا يتذكر المساعد عن كل عميل</p></div>
        </div>
      </div>

      <div className="relative mb-6"><Search size={16} className={`absolute top-1/2 -translate-y-1/2 start-3 ${textMuted}`}/><input value={search} onChange={e => setSearch(e.target.value)} className={`${inputCls} ps-10`} placeholder="بحث برقم الهاتف أو الاسم..."/></div>

      {loading ? <div className="text-center py-16"><Loader2 className={`animate-spin mx-auto ${textSec}`} size={32}/></div>
      : memories.length === 0 ? (
        <div className={`text-center py-16 rounded-2xl border ${card}`}>
          <Brain className={`mx-auto mb-4 ${textMuted}`} size={48}/>
          <h3 className={`text-lg font-medium mb-2 ${text}`}>لا توجد ذاكرة محفوظة</h3>
          <p className={textMuted}>ستتكوّن الذاكرة تلقائياً بعد تحليل المكالمات</p>
        </div>
      ) : (
        <div className="space-y-3">{memories.map(mem => {
          const isExpanded = expandedId === mem.id;
          return (
            <div key={mem.id} className={`rounded-2xl border ${card}`}>
              <button onClick={() => setExpandedId(isExpanded ? null : mem.id)} className={`w-full text-start p-5 flex items-center justify-between ${isDark?'hover:bg-[#1a1a1d]':'hover:bg-gray-50'} rounded-2xl transition`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDark?'bg-teal-500/20':'bg-teal-50'}`}>
                    {mem.contactType === 'email' ? <Mail size={18} className="text-teal-400"/> : <Phone size={18} className="text-teal-400"/>}
                  </div>
                  <div>
                    <div className={`font-medium ${text}`}>{mem.contactName || mem.contactIdentifier}</div>
                    <div className={`flex items-center gap-3 text-xs ${textMuted}`}>
                      <span dir="ltr">{mem.contactIdentifier}</span>
                      <span>•</span>
                      <span>{mem.totalInteractions} تواصل</span>
                      {mem.lastSentiment && <span className={SENTIMENT_CLR[mem.lastSentiment]}>• {SENTIMENT[mem.lastSentiment]}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isExpanded ? <ChevronUp size={16} className={textMuted}/> : <ChevronDown size={16} className={textMuted}/>}
                </div>
              </button>

              {isExpanded && (
                <div className={`px-5 pb-5 space-y-4 border-t ${isDark?'border-[#1f1f23]':'border-gray-100'}`}>
                  {mem.summary && <div className="pt-4"><h4 className={`text-xs font-medium mb-1 ${textMuted}`}>الملخص</h4><p className={`text-sm leading-relaxed ${textSec}`}>{mem.summary}</p></div>}
                  {mem.keyFacts?.length > 0 && <div><h4 className={`text-xs font-medium mb-2 ${textMuted}`}>حقائق مهمة</h4><div className="space-y-1">{mem.keyFacts.map((f, i) => <div key={i} className={`text-sm px-3 py-2 rounded-xl ${inner}`}><span className="text-teal-400 me-1">•</span>{f.fact}</div>)}</div></div>}
                  <div className="flex items-center justify-between pt-2">
                    <div className={`text-xs ${textMuted}`}>آخر تواصل: {mem.lastInteractionAt ? new Date(mem.lastInteractionAt).toLocaleString('ar-SA') : '—'}</div>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(mem.id); }} className={`p-2 rounded-lg text-red-400 ${isDark?'hover:bg-red-500/10':'hover:bg-red-50'}`}><Trash2 size={14}/></button>
                  </div>
                </div>
              )}
            </div>
          );
        })}</div>
      )}
    </div>
  );
}
