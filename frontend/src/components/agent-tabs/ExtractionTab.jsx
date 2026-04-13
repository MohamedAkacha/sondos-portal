import { useState } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { Plus, Trash2, Loader2, ToggleLeft, ToggleRight } from 'lucide-react';

const VAR_TYPES = [{ v: 'string', l: 'نص' }, { v: 'number', l: 'رقم' }, { v: 'boolean', l: 'نعم/لا' }, { v: 'date', l: 'تاريخ' }, { v: 'email', l: 'إيميل' }, { v: 'phone', l: 'هاتف' }];

export default function ExtractionTab({ agent, onSave }) {
  const { isDark } = useTheme();
  const [enabled, setEnabled] = useState(agent?.extractionConfig?.enabled || false);
  const [variables, setVariables] = useState(agent?.extractionConfig?.variables || []);
  const [webhook, setWebhook] = useState(agent?.extractionConfig?.postExtractionWebhook || { enabled: false, url: '', headers: [] });
  const [saving, setSaving] = useState(false);

  const addVar = () => setVariables(p => [...p, { name: '', type: 'string', description: '', required: false, enumValues: [] }]);
  const removeVar = (i) => setVariables(p => p.filter((_, idx) => idx !== i));
  const updateVar = (i, k, v) => setVariables(p => p.map((item, idx) => idx === i ? { ...item, [k]: v } : item));

  const handleSave = async () => {
    setSaving(true);
    await onSave({ extractionConfig: { enabled, variables, postExtractionWebhook: webhook } });
    setSaving(false);
  };

  const text = isDark ? 'text-white' : 'text-gray-900';
  const textMuted = isDark ? 'text-gray-500' : 'text-gray-500';
  const card = isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200';
  const inputCls = `w-full rounded-xl px-3 py-2 border text-sm focus:border-teal-500 focus:outline-none ${isDark ? 'bg-[#1a1a1d] border-[#27272a] text-white' : 'bg-white border-gray-300 text-gray-900'}`;
  const inner = isDark ? 'bg-[#0a0a0b]' : 'bg-gray-50';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h3 className={`font-semibold ${text}`}>استخراج المتغيرات بعد المكالمة</h3><p className={`text-sm ${textMuted}`}>حدد المعلومات اللي يستخرجها النظام تلقائياً من كل مكالمة</p></div>
        <div className="flex items-center gap-3">
          <button onClick={() => setEnabled(!enabled)} className={`p-1 rounded-lg`}>{enabled ? <ToggleRight size={28} className="text-teal-400"/> : <ToggleLeft size={28} className={textMuted}/>}</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-bold rounded-xl disabled:opacity-50 text-sm">{saving ? 'جاري الحفظ...' : 'حفظ'}</button>
        </div>
      </div>

      {enabled && (<>
        <div className={`rounded-2xl p-5 border ${card}`}>
          <div className="flex items-center justify-between mb-4">
            <h4 className={`text-sm font-medium ${text}`}>المتغيرات ({variables.length})</h4>
            <button onClick={addVar} className="flex items-center gap-1 px-3 py-1.5 bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-xl text-xs"><Plus size={14}/> إضافة</button>
          </div>
          {variables.length === 0 ? <p className={`text-center py-4 text-sm ${textMuted}`}>أضف متغيرات لاستخراجها من المكالمات</p> : (
            <div className="space-y-3">{variables.map((v, i) => (
              <div key={i} className={`rounded-xl p-3 ${inner}`}>
                <div className="grid grid-cols-12 gap-2">
                  <input value={v.name} onChange={e => updateVar(i, 'name', e.target.value)} className={`col-span-3 ${inputCls}`} placeholder="اسم المتغير"/>
                  <select value={v.type} onChange={e => updateVar(i, 'type', e.target.value)} className={`col-span-2 ${inputCls}`}>{VAR_TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}</select>
                  <input value={v.description} onChange={e => updateVar(i, 'description', e.target.value)} className={`col-span-5 ${inputCls}`} placeholder="الوصف (يساعد الذكاء الاصطناعي)"/>
                  <label className="col-span-1 flex items-center gap-1 text-xs"><input type="checkbox" checked={v.required} onChange={e => updateVar(i, 'required', e.target.checked)} className="rounded"/> مطلوب</label>
                  <button onClick={() => removeVar(i)} className="col-span-1 p-1 text-red-400 hover:bg-red-500/10 rounded-lg"><Trash2 size={14}/></button>
                </div>
              </div>
            ))}</div>
          )}
        </div>

        <div className={`rounded-2xl p-5 border ${card}`}>
          <div className="flex items-center justify-between mb-4">
            <h4 className={`text-sm font-medium ${text}`}>Webhook بعد الاستخراج</h4>
            <button onClick={() => setWebhook(p => ({...p, enabled: !p.enabled}))}>{webhook.enabled ? <ToggleRight size={24} className="text-teal-400"/> : <ToggleLeft size={24} className={textMuted}/>}</button>
          </div>
          {webhook.enabled && (
            <div className="space-y-3">
              <input value={webhook.url} onChange={e => setWebhook(p => ({...p, url: e.target.value}))} className={inputCls} placeholder="https://your-api.com/extraction-webhook" dir="ltr"/>
              <p className={`text-xs ${textMuted}`}>سيتم إرسال المتغيرات المستخرجة لهذا الرابط بعد كل مكالمة</p>
            </div>
          )}
        </div>
      </>)}
    </div>
  );
}
