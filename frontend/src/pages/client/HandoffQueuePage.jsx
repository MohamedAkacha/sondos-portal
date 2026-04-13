import { useState, useEffect } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import handoffAPI from '@/services/api/handoffAPI';
import { Users, Clock, CheckCircle, AlertTriangle, UserPlus, Play, Check, Loader2 } from 'lucide-react';
const STATUS_CFG = { waiting:{bg:'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',label:'في الانتظار'}, assigned:{bg:'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',label:'تم التعيين'}, in_progress:{bg:'bg-purple-500/10 text-purple-400 border-purple-500/20',label:'جاري العمل'}, resolved:{bg:'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',label:'تم الحل'}, expired:{bg:'bg-gray-500/10 text-gray-400 border-gray-500/20',label:'منتهي'} };
const PRIORITY_CLS = { low:'text-gray-400', normal:'text-cyan-400', high:'text-yellow-400', urgent:'text-red-400' };
export default function HandoffQueuePage() {
  const { t } = useLanguage(); const { isDark } = useTheme();
  const [items, setItems] = useState([]); const [stats, setStats] = useState(null); const [loading, setLoading] = useState(true); const [statusFilter, setStatusFilter] = useState('waiting');
  const [resolveId, setResolveId] = useState(null); const [resolution, setResolution] = useState('');
  useEffect(() => { loadData(); }, [statusFilter]);
  const loadData = async () => { try { setLoading(true); const [q,s] = await Promise.all([handoffAPI.getQueue({status:statusFilter||undefined}),handoffAPI.getStats()]); setItems(q.data?.data?.items||[]); setStats(s.data?.data); } catch(e){console.error(e)} finally{setLoading(false)} };
  const handleAssign = async (id) => { try { await handoffAPI.assign(id,'me'); loadData(); } catch(e){console.error(e)} };
  const handleStart = async (id) => { try { await handoffAPI.startProgress(id); loadData(); } catch(e){console.error(e)} };
  const handleResolve = async (id) => { if(!resolution.trim()) return; try { await handoffAPI.resolve(id,resolution.trim()); setResolveId(null); setResolution(''); loadData(); } catch(e){console.error(e)} };
  const card = isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200';
  const text = isDark ? 'text-white' : 'text-gray-900'; const textSec = isDark ? 'text-gray-400' : 'text-gray-600'; const textMuted = isDark ? 'text-gray-500' : 'text-gray-500';
  const tabCls = (a) => `px-3 py-1.5 rounded-xl text-sm border transition ${a ? 'bg-teal-500/10 text-teal-500 border-teal-500/20' : isDark ? 'bg-[#1a1a1d] border-[#1f1f23] text-gray-400 hover:text-white' : 'bg-white border-gray-200 text-gray-600 hover:text-gray-900'}`;
  const inputCls = isDark ? 'bg-[#1a1a1d] border-[#27272a] text-white' : 'bg-white border-gray-300 text-gray-900';
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className={`text-2xl font-bold mb-6 ${text}`}>قائمة التحويل لموظف</h1>
      {stats&&<div className="grid grid-cols-5 gap-4 mb-6">{[{l:'في الانتظار',v:stats.waiting,c:'yellow'},{l:'تم التعيين',v:stats.assigned,c:'cyan'},{l:'جاري العمل',v:stats.inProgress,c:'purple'},{l:'تم الحل اليوم',v:stats.resolvedToday,c:'emerald'},{l:'متوسط الانتظار',v:`${Math.round(stats.avgWaitSeconds/60)}د`,c:'gray'}].map((s,i)=>(<div key={i} className={`rounded-2xl p-4 border text-center ${card}`}><div className={`text-2xl font-bold text-${s.c}-400`}>{s.v}</div><div className={`text-xs ${textMuted}`}>{s.l}</div></div>))}</div>}
      <div className="flex gap-2 mb-6">{['waiting','assigned','in_progress','resolved',''].map(s=>(<button key={s} onClick={()=>setStatusFilter(s)} className={tabCls(statusFilter===s)}>{s?STATUS_CFG[s]?.label:t('common.all')}</button>))}</div>
      {loading?<div className="text-center py-16"><Loader2 className={`animate-spin mx-auto ${textSec}`} size={32}/></div>:items.length===0?<div className={`text-center py-16 rounded-2xl border ${card}`}><Users className={`mx-auto mb-4 ${textMuted}`} size={48}/><p className={textSec}>لا توجد طلبات تحويل</p></div>:(
        <div className="space-y-3">{items.map(item=>{const sc=STATUS_CFG[item.status]||STATUS_CFG.waiting;return(
          <div key={item.id} className={`rounded-2xl p-5 border ${card}`}><div className="flex items-start justify-between"><div className="flex-1"><div className="flex items-center gap-3 mb-2"><span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${sc.bg}`}>{sc.label}</span><span className={`text-xs font-medium ${PRIORITY_CLS[item.priority]}`}>{item.priority}</span><span className={`text-xs ${textMuted}`}>{item.sourceType==='call'?'📞 مكالمة':'💬 محادثة'}</span></div><div className={`font-medium ${text}`}>{item.contactName||item.contactPhone||'زائر مجهول'}</div><p className={`text-sm mt-1 ${textSec}`}>{item.reason}</p><div className={`text-xs mt-2 ${textMuted}`}>{new Date(item.createdAt).toLocaleString('ar-SA')}</div></div>
            <div className="flex items-center gap-2">
              {item.status==='waiting'&&<button onClick={()=>handleAssign(item.id)} className="px-3 py-1.5 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-xl text-sm font-bold">تعيين لي</button>}
              {item.status==='assigned'&&<button onClick={()=>handleStart(item.id)} className="px-3 py-1.5 bg-purple-500/20 text-purple-400 border border-purple-500/20 rounded-xl text-sm">بدء العمل</button>}
              {item.status==='in_progress'&&(resolveId===item.id?<div className="flex gap-2"><input value={resolution} onChange={e=>setResolution(e.target.value)} placeholder="كيف تم الحل؟" className={`rounded-lg px-3 py-1.5 text-sm border w-48 focus:border-teal-500 focus:outline-none ${inputCls}`}/><button onClick={()=>handleResolve(item.id)} className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-sm"><Check size={14}/></button></div>:<button onClick={()=>setResolveId(item.id)} className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-sm">حل</button>)}
            </div></div></div>)})}</div>)}
    </div>
  );
}
