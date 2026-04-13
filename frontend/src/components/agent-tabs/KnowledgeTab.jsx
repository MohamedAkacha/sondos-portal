import { useState, useEffect } from 'react';
import { useTheme } from '@/hooks/useTheme';
import knowledgeAPI from '@/services/api/knowledgeAPI';
import { BookOpen, Check, Loader2 } from 'lucide-react';

export default function KnowledgeTab({ agent, onSave }) {
  const { isDark } = useTheme();
  const [bases, setBases] = useState([]);
  const [selected, setSelected] = useState(agent?.knowledgeBaseIds || []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => { try { const res = await knowledgeAPI.getAllBases(); setBases(res.data?.data || []); } catch(e){console.error(e)} finally{setLoading(false)} })();
  }, []);

  const toggle = (id) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const handleSave = async () => { setSaving(true); await onSave({ knowledgeBaseIds: selected }); setSaving(false); };

  const card = isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200';
  const text = isDark ? 'text-white' : 'text-gray-900';
  const textMuted = isDark ? 'text-gray-500' : 'text-gray-500';

  if (loading) return <div className="flex justify-center py-8"><Loader2 className={`animate-spin ${isDark?'text-gray-400':'text-gray-500'}`} size={24}/></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h3 className={`font-semibold ${text}`}>قواعد المعرفة</h3><p className={`text-sm ${textMuted}`}>اختر قواعد المعرفة اللي يبحث فيها المساعد</p></div>
        <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-bold rounded-xl disabled:opacity-50 text-sm">{saving?'جاري الحفظ...':'حفظ'}</button>
      </div>
      {bases.length === 0 ? (
        <div className={`text-center py-8 rounded-2xl border ${card}`}><BookOpen className={`mx-auto mb-3 ${textMuted}`} size={32}/><p className={textMuted}>لا توجد قواعد معرفة. أنشئ قاعدة أولاً.</p></div>
      ) : (
        <div className="space-y-2">{bases.map(base => {
          const isSel = selected.includes(base.id);
          return (<button key={base.id} onClick={() => toggle(base.id)} className={`w-full text-start rounded-2xl p-4 border transition-all ${isSel?(isDark?'bg-teal-500/10 border-teal-500/30':'bg-teal-50 border-teal-200'):card} ${isDark?'hover:bg-[#1a1a1d]':'hover:bg-gray-50'}`}>
            <div className="flex items-center justify-between">
              <div><div className={`font-medium ${text}`}>{base.name}</div><div className={`text-xs ${textMuted}`}>{base.totalDocuments} مستند • {base.totalChunks} جزء</div></div>
              {isSel && <Check size={18} className="text-teal-400"/>}
            </div>
          </button>);
        })}</div>
      )}
    </div>
  );
}
