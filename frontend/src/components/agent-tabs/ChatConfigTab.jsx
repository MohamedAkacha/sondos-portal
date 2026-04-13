import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme';
import { ToggleLeft, ToggleRight, Loader2, Code, ExternalLink } from 'lucide-react';
export default function ChatConfigTab({ agent, onSave }) {
  const { isDark } = useTheme(); const navigate = useNavigate();
  const cfg = agent?.chatConfig || {};
  const [enabled, setEnabled] = useState(cfg.enabled || false);
  const [widgetEnabled, setWidgetEnabled] = useState(cfg.widgetEnabled || false);
  const [widgetColor, setWidgetColor] = useState(cfg.widgetColor || '#14b8a6');
  const [widgetPosition, setWidgetPosition] = useState(cfg.widgetPosition || 'bottom-right');
  const [widgetGreeting, setWidgetGreeting] = useState(cfg.widgetGreeting || '');
  const [maxMessages, setMaxMessages] = useState(cfg.maxSessionMessages || 100);
  const [saving, setSaving] = useState(false);
  const handleSave = async () => { setSaving(true); await onSave({ chatConfig: { enabled, widgetEnabled, widgetColor, widgetPosition, widgetGreeting, maxSessionMessages: maxMessages } }); setSaving(false); };
  const text = isDark ? 'text-white' : 'text-gray-900'; const textMuted = isDark ? 'text-gray-500' : 'text-gray-500';
  const card = isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200';
  const inputCls = `w-full rounded-xl px-4 py-2.5 border text-sm focus:border-teal-500 focus:outline-none ${isDark ? 'bg-[#1a1a1d] border-[#27272a] text-white' : 'bg-white border-gray-300 text-gray-900'}`;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h3 className={`font-semibold ${text}`}>الدردشة النصية</h3><p className={`text-sm ${textMuted}`}>فعّل الدردشة النصية والودجت لهذا المساعد</p></div>
        <div className="flex items-center gap-3"><button onClick={() => setEnabled(!enabled)}>{enabled ? <ToggleRight size={28} className="text-teal-400"/> : <ToggleLeft size={28} className={textMuted}/>}</button><button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-bold rounded-xl disabled:opacity-50 text-sm">{saving?'حفظ...':'حفظ'}</button></div>
      </div>
      {enabled && (<>
        <div className={`rounded-2xl p-5 border ${card}`}>
          <div className="flex items-center justify-between mb-4"><h4 className={`text-sm font-medium ${text}`}>ودجت الموقع</h4><button onClick={() => setWidgetEnabled(!widgetEnabled)}>{widgetEnabled ? <ToggleRight size={24} className="text-teal-400"/> : <ToggleLeft size={24} className={textMuted}/>}</button></div>
          {widgetEnabled && (<div className="space-y-4">
            <div><label className={`text-sm ${textMuted} block mb-1`}>اللون</label><div className="flex gap-3"><input type="color" value={widgetColor} onChange={e => setWidgetColor(e.target.value)} className="w-10 h-10 rounded-lg cursor-pointer"/><input value={widgetColor} onChange={e => setWidgetColor(e.target.value)} className={`${inputCls} font-mono`} dir="ltr"/></div></div>
            <div><label className={`text-sm ${textMuted} block mb-1`}>الموضع</label><select value={widgetPosition} onChange={e => setWidgetPosition(e.target.value)} className={inputCls}><option value="bottom-right">أسفل يمين</option><option value="bottom-left">أسفل يسار</option></select></div>
            <div><label className={`text-sm ${textMuted} block mb-1`}>رسالة الترحيب</label><input value={widgetGreeting} onChange={e => setWidgetGreeting(e.target.value)} className={inputCls} placeholder="أهلاً! كيف أقدر أساعدك؟"/></div>
            <div><label className={`text-sm ${textMuted} block mb-1`}>حد الرسائل لكل جلسة</label><input type="number" value={maxMessages} onChange={e => setMaxMessages(parseInt(e.target.value)||100)} className={inputCls} min={10} max={500}/></div>
            <button onClick={() => navigate('/widget-setup')} className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm ${isDark?'border-[#1f1f23] text-gray-400 hover:bg-[#1a1a1d]':'border-gray-200 text-gray-600 hover:bg-gray-50'}`}><Code size={16}/> إعداد كود التضمين <ExternalLink size={12}/></button>
          </div>)}
        </div>
      </>)}
    </div>
  );
}
