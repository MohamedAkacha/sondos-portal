import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { Phone, Clock, User, Bot, RefreshCw, Radio, Loader2 } from 'lucide-react';
export default function LiveCallsPage() {
  const { t } = useLanguage(); const { isDark } = useTheme();
  const [calls, setCalls] = useState([]); const [loading, setLoading] = useState(true);
  const intervalRef = useRef(null);
  useEffect(() => { loadCalls(); intervalRef.current = setInterval(loadCalls, 5000); return () => clearInterval(intervalRef.current); }, []);
  const loadCalls = async () => { try { const token = localStorage.getItem('auth_token'); const res = await fetch('/api/livekit/calls?status=active', { headers: { Authorization: `Bearer ${token}` } }); const data = await res.json(); setCalls(data.data || []); } catch(e){console.error(e)} finally{setLoading(false)} };
  const fmtDur = (s) => { if(!s) return '00:00'; const secs = Math.floor((Date.now()-new Date(s).getTime())/1000); return `${Math.floor(secs/60).toString().padStart(2,'0')}:${(secs%60).toString().padStart(2,'0')}`; };
  const [,setTick] = useState(0); useEffect(() => { const t = setInterval(()=>setTick(x=>x+1), 1000); return ()=>clearInterval(t); }, []);
  const card = isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200';
  const text = isDark ? 'text-white' : 'text-gray-900'; const textSec = isDark ? 'text-gray-400' : 'text-gray-600'; const textMuted = isDark ? 'text-gray-500' : 'text-gray-500';
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3"><h1 className={`text-2xl font-bold ${text}`}>{t('calls.live.title')}</h1><div className="flex items-center gap-1.5 px-3 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full text-sm"><Radio size={12} className="animate-pulse"/><span>{calls.length} مكالمات</span></div></div>
        <button onClick={loadCalls} className={`p-2 rounded-lg ${isDark?'hover:bg-[#1a1a1d]':'hover:bg-gray-100'}`}><RefreshCw size={18} className={textSec}/></button>
      </div>
      {loading?<div className="text-center py-16"><Loader2 className={`animate-spin mx-auto ${textSec}`} size={32}/></div>:calls.length===0?<div className={`text-center py-16 rounded-2xl border ${card}`}><Phone className={`mx-auto mb-4 ${textMuted}`} size={48}/><h3 className={`text-lg font-medium mb-2 ${text}`}>{t('calls.live.noActiveCalls')}</h3><p className={textMuted}>ستظهر هنا المكالمات الجارية</p></div>:(
        <div className="grid gap-4">{calls.map(call=>(<div key={call._id||call.id} className={`rounded-2xl p-5 border transition ${card} hover:border-teal-500/30`}>
          <div className="flex items-center justify-between"><div className="flex items-center gap-4"><div className="relative"><div className={`w-12 h-12 rounded-full flex items-center justify-center ${isDark?'bg-emerald-500/20':'bg-emerald-50'}`}><Phone size={20} className="text-emerald-400"/></div><div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full animate-pulse"/></div><div><div className={`flex items-center gap-2 mb-1 ${text}`}><span className="font-medium">{call.roomName||'Room'}</span><span className="text-xs px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">{call.direction||'inbound'}</span></div><div className={`flex items-center gap-3 text-sm ${textMuted}`}>{call.phoneNumber&&<span>{call.phoneNumber}</span>}</div></div></div><div className="text-end"><div className="flex items-center gap-2 text-lg font-mono text-emerald-400"><Clock size={16}/>{fmtDur(call.startedAt)}</div></div></div>
          {call.transcript?.length>0&&<div className={`mt-4 pt-3 border-t space-y-2 ${isDark?'border-[#1f1f23]':'border-gray-100'}`}>{call.transcript.slice(-2).map((e,i)=>(<div key={i} className="flex items-start gap-2 text-sm"><span className="text-xs mt-0.5">{e.speaker==='agent'?<Bot size={12} className="text-teal-400"/>:<User size={12} className={textMuted}/>}</span><span className={e.speaker==='agent'?'text-teal-300':textSec}>{e.text?.substring(0,100)}</span></div>))}</div>}
        </div>))}</div>)}
    </div>
  );
}
