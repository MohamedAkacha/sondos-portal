import { useState, useEffect } from 'react';
import { useTheme } from '@/hooks/useTheme';
import toolAPI from '@/services/api/toolAPI';
import { Wrench, Check, Loader2 } from 'lucide-react';

export default function ToolsTab({ agent, onSave }) {
  const { isDark } = useTheme();
  const [tools, setTools] = useState([]);
  const [selected, setSelected] = useState(agent?.toolIds || []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => { try { const res = await toolAPI.getAll(); setTools(res.data?.data || []); } catch(e){console.error(e)} finally{setLoading(false)} })();
  }, []);

  const toggle = (id) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const handleSave = async () => { setSaving(true); await onSave({ toolIds: selected }); setSaving(false); };

  const card = isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200';
  const text = isDark ? 'text-white' : 'text-gray-900';
  const textSec = isDark ? 'text-gray-400' : 'text-gray-600';
  const textMuted = isDark ? 'text-gray-500' : 'text-gray-500';

  if (loading) return <div className="flex justify-center py-8"><Loader2 className={`animate-spin ${textSec}`} size={24}/></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h3 className={`font-semibold ${text}`}>الأدوات المتاحة</h3><p className={`text-sm ${textMuted}`}>اختر الأدوات اللي يقدر المساعد يستخدمها</p></div>
        <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-bold rounded-xl disabled:opacity-50 text-sm">
          {saving ? <Loader2 size={14} className="animate-spin"/> : 'حفظ'}
        </button>
      </div>
      {tools.length === 0 ? (
        <div className={`text-center py-8 rounded-2xl border ${card}`}>
          <Wrench className={`mx-auto mb-3 ${textMuted}`} size={32}/>
          <p className={textMuted}>لا توجد أدوات. أنشئ أدوات أولاً من صفحة الأدوات.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tools.map(tool => {
            const isSelected = selected.includes(tool.id);
            return (
              <button key={tool.id} onClick={() => toggle(tool.id)}
                className={`w-full text-start rounded-2xl p-4 border transition-all ${isSelected
                  ? (isDark ? 'bg-teal-500/10 border-teal-500/30' : 'bg-teal-50 border-teal-200')
                  : card} ${isDark ? 'hover:bg-[#1a1a1d]' : 'hover:bg-gray-50'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isSelected ? 'bg-teal-500/20' : isDark ? 'bg-[#1a1a1d]' : 'bg-gray-100'}`}>
                      <Wrench size={16} className={isSelected ? 'text-teal-400' : textMuted}/>
                    </div>
                    <div><div className={`font-medium ${text}`}>{tool.name}</div><div className={`text-xs ${textMuted}`}>{tool.description?.substring(0, 60)}</div></div>
                  </div>
                  {isSelected && <Check size={18} className="text-teal-400"/>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
