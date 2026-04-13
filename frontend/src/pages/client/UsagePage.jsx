import { useState, useEffect } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import usageAPI from '@/services/api/usageAPI';
import { CreditCard, Phone, MessageSquare, FileText, Zap, Loader2 } from 'lucide-react';
const TYPE_CFG = { call_minute:{icon:Phone,label:'دقائق المكالمات',color:'teal'}, chat_message:{icon:MessageSquare,label:'رسائل الدردشة',color:'cyan'}, document_process:{icon:FileText,label:'معالجة مستندات',color:'purple'}, api_call:{icon:Zap,label:'طلبات API',color:'emerald'}, sms_sent:{icon:MessageSquare,label:'رسائل SMS',color:'pink'}, voice_clone:{icon:Phone,label:'استنساخ صوت',color:'cyan'}, embedding:{icon:FileText,label:'Embedding',color:'yellow'} };
export default function UsagePage() {
  const { t } = useLanguage(); const { isDark } = useTheme();
  const [loading, setLoading] = useState(true); const [current, setCurrent] = useState(null); const [breakdown, setBreakdown] = useState(null); const [history, setHistory] = useState([]); const [activeTab, setActiveTab] = useState('overview');
  useEffect(() => { (async () => { try { setLoading(true); const [c,b,h] = await Promise.all([usageAPI.getCurrent(),usageAPI.getBreakdown(),usageAPI.getHistory({limit:50})]); setCurrent(c.data?.data); setBreakdown(b.data?.data); setHistory(h.data?.data?.records||[]); } catch(e){console.error(e)} finally{setLoading(false)} })(); }, []);
  const card = isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200';
  const text = isDark ? 'text-white' : 'text-gray-900'; const textSec = isDark ? 'text-gray-400' : 'text-gray-600'; const textMuted = isDark ? 'text-gray-500' : 'text-gray-500';
  const inner = isDark ? 'bg-[#0a0a0b]' : 'bg-gray-50';
  const tabCls = (a) => `px-4 py-2 rounded-xl text-sm border transition ${a ? 'bg-teal-500/10 text-teal-500 border-teal-500/20' : isDark ? 'bg-[#1a1a1d] border-[#1f1f23] text-gray-400 hover:text-white' : 'bg-white border-gray-200 text-gray-600 hover:text-gray-900'}`;
  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className={`animate-spin ${textSec}`} size={32}/></div>;
  const usage = current?.usage || {}; const plan = current?.plan;
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className={`text-2xl font-bold mb-6 ${text}`}>{t('billing.title')}</h1>
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className={`bg-gradient-to-br ${isDark?'from-teal-500/20 to-teal-600/10 border-teal-500/30':'from-teal-50 to-teal-100/50 border-teal-200'} border rounded-2xl p-6`}><div className={`text-sm ${textSec}`}>{t('billing.plan.currentPlan')}</div><div className={`text-xl font-bold ${text}`}>{plan?.name||'Free'}</div></div>
        <div className={`rounded-2xl p-6 border ${card}`}><div className={`text-sm ${textSec}`}>{t('billing.usage.callMinutes')}</div><div className={`text-xl font-bold ${text}`}>{usage.callMinutes||0}</div></div>
        <div className={`rounded-2xl p-6 border ${card}`}><div className={`text-sm ${textSec}`}>{t('billing.usage.chatMessages')}</div><div className={`text-xl font-bold ${text}`}>{usage.chatMessages||0}</div></div>
      </div>
      <div className="flex gap-2 mb-6"><button onClick={()=>setActiveTab('overview')} className={tabCls(activeTab==='overview')}>{t('analytics.overview')}</button><button onClick={()=>setActiveTab('history')} className={tabCls(activeTab==='history')}>{t('billing.invoices.title')}</button></div>
      {activeTab==='overview'&&(<div className="space-y-4">{breakdown?.breakdown?.length>0?(<><div className={`rounded-2xl p-6 border ${card}`}><div className="flex items-center justify-between mb-4"><h3 className={`font-semibold ${text}`}>{t('billing.usage.totalCost')}</h3><span className="text-xl font-bold text-teal-400">{breakdown.totalCostSAR?.toFixed(2)} SAR</span></div><div className="space-y-3">{breakdown.breakdown.map(item=>{const cfg=TYPE_CFG[item._id]||{icon:Zap,label:item._id};return(<div key={item._id} className="flex items-center justify-between"><div className="flex items-center gap-3"><div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark?'bg-teal-500/10':'bg-teal-50'}`}><cfg.icon size={16} className="text-teal-400"/></div><div><div className={`text-sm font-medium ${text}`}>{cfg.label}</div><div className={`text-xs ${textMuted}`}>{item.totalQuantity} عملية</div></div></div><div className={`text-sm font-medium ${text}`}>{(item.totalCost/100).toFixed(2)} SAR</div></div>)})}</div></div></>):<div className={`text-center py-12 rounded-2xl border ${card} ${textMuted}`}>{t('common.noData')}</div>}</div>)}
      {activeTab==='history'&&(<div className={`rounded-2xl border overflow-hidden ${card}`}>{history.length===0?<div className={`text-center py-12 ${textMuted}`}>{t('common.noData')}</div>:<table className="w-full"><thead><tr className={`border-b text-sm ${isDark?'border-[#1f1f23]':'border-gray-200'} ${textMuted}`}><th className="text-start p-4">{t('common.date')}</th><th className="text-start p-4">{t('common.type')}</th><th className="text-start p-4">{t('common.description')}</th><th className="text-end p-4">{t('billing.invoices.amount')}</th></tr></thead><tbody>{history.map((r,i)=>{const cfg=TYPE_CFG[r.type]||{icon:Zap,label:r.type};return(<tr key={i} className={`border-b ${isDark?'border-[#1f1f23] hover:bg-[#0a0a0b]':'border-gray-100 hover:bg-gray-50'}`}><td className={`p-4 text-sm ${textMuted}`}>{new Date(r.createdAt).toLocaleString('ar-SA')}</td><td className="p-4"><div className="flex items-center gap-2"><cfg.icon size={14} className="text-teal-400"/><span className={`text-sm ${text}`}>{cfg.label}</span></div></td><td className={`p-4 text-sm ${textMuted}`}>{r.description||'-'}</td><td className={`p-4 text-sm text-end font-medium ${text}`}>{(r.costHalala/100).toFixed(2)} SAR</td></tr>)})}</tbody></table>}</div>)}
    </div>
  );
}
