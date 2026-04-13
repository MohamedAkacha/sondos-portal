import { useState } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { ToggleLeft, ToggleRight, Plus, X, Loader2 } from 'lucide-react';
const TRIGGERS = [
  { v: 'customer_request', l: 'طلب العميل', d: 'لما العميل يطلب موظف بشري' },
  { v: 'agent_unsure', l: 'عدم قدرة المساعد', d: 'لما المساعد ما يعرف يجاوب' },
  { v: 'negative_sentiment', l: 'مشاعر سلبية', d: 'لما العميل يكون زعلان أو محبط' },
  { v: 'max_turns', l: 'عدد أدوار محدد', d: 'بعد عدد معين من الردود' },
  { v: 'keyword', l: 'كلمة مفتاحية', d: 'لما العميل يقول كلمة معينة' },
];
export default function HandoffTab({ agent, onSave }) {
  const { isDark } = useTheme();
  const cfg = agent?.handoffConfig || {};
  const [enabled, setEnabled] = useState(cfg.enabled || false);
  const [triggers, setTriggers] = useState(cfg.triggers || []);
  const [maxTurns, setMaxTurns] = useState(cfg.maxTurnsBeforeHandoff || 10);
  const [keywords, setKeywords] = useState(cfg.handoffKeywords || []);
  const [message, setMessage] = useState(cfg.handoffMessage || 'سأحولك الآن لموظف مختص. يرجى الانتظار.');
  const [newKw, setNewKw] = useState('');
  const [saving, setSaving] = useState(false);
  const toggleTrigger = (v) => setTriggers(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);
  const addKw = () => { if (newKw.trim()) { setKeywords(p => [...p, newKw.trim()]); setNewKw(''); } };
  const handleSave = async () => { setSaving(true); await onSave({ handoffConfig: { enabled, triggers, maxTurnsBeforeHandoff: maxTurns, handoffKeywords: keywords, handoffMessage: message } }); setSaving(false); };
  const text = isDark ? 'text-white' : 'text-gray-900'; const textMuted = isDark ? 'text-gray-500' : 'text-gray-500';
  const card = isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200';
  const inputCls = `w-full rounded-xl px-4 py-2.5 border text-sm focus:border-teal-500 focus:outline-none ${isDark ? 'bg-[#1a1a1d] border-[#27272a] text-white' : 'bg-white border-gray-300 text-gray-900'}`;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h3 className={`font-semibold ${text}`}>التحويل لموظف بشري</h3><p className={`text-sm ${textMuted}`}>حدد متى يحوّل المساعد المكالمة لموظف</p></div>
        <div className="flex items-center gap-3"><button onClick={() => setEnabled(!enabled)}>{enabled ? <ToggleRight size={28} className="text-teal-400"/> : <ToggleLeft size={28} className={textMuted}/>}</button><button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-bold rounded-xl disabled:opacity-50 text-sm">{saving?'حفظ...':'حفظ'}</button></div>
      </div>
      {enabled && (<>
        <div className={`rounded-2xl p-5 border ${card}`}><h4 className={`text-sm font-medium mb-3 ${text}`}>المحفزات</h4><div className="space-y-2">{TRIGGERS.map(t => (<button key={t.v} onClick={() => toggleTrigger(t.v)} className={`w-full text-start rounded-xl p-3 border transition ${triggers.includes(t.v)?(isDark?'bg-teal-500/10 border-teal-500/30':'bg-teal-50 border-teal-200'):card} ${isDark?'hover:bg-[#1a1a1d]':'hover:bg-gray-50'}`}><div className={`font-medium text-sm ${text}`}>{t.l}</div><div className={`text-xs ${textMuted}`}>{t.d}</div></button>))}</div></div>
        {triggers.includes('max_turns') && <div className={`rounded-2xl p-5 border ${card}`}><label className={`text-sm ${textMuted}`}>عدد الأدوار قبل التحويل</label><input type="number" value={maxTurns} onChange={e => setMaxTurns(parseInt(e.target.value)||10)} className={inputCls} min={3} max={50}/></div>}
        {triggers.includes('keyword') && <div className={`rounded-2xl p-5 border ${card}`}><label className={`text-sm ${textMuted} block mb-2`}>الكلمات المفتاحية</label><div className="flex gap-2 mb-3"><input value={newKw} onChange={e => setNewKw(e.target.value)} onKeyDown={e => e.key==='Enter'&&addKw()} className={inputCls} placeholder="أبي أكلم مدير"/><button onClick={addKw} className="px-3 py-2 bg-teal-500/10 text-teal-400 rounded-xl"><Plus size={16}/></button></div><div className="flex flex-wrap gap-2">{keywords.map((kw,i) => <span key={i} className="flex items-center gap-1 px-3 py-1 bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-full text-sm">{kw}<button onClick={() => setKeywords(p=>p.filter((_,idx)=>idx!==i))}><X size={12}/></button></span>)}</div></div>}
        <div className={`rounded-2xl p-5 border ${card}`}><label className={`text-sm ${textMuted} block mb-2`}>رسالة التحويل</label><textarea value={message} onChange={e => setMessage(e.target.value)} rows={2} className={`${inputCls} resize-none`}/></div>
      </>)}
    </div>
  );
}
