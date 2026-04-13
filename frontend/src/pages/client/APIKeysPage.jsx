import { useState, useEffect } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { apikeyAPI } from '@/services/api/publicAPI';
import { Key, Plus, Trash2, ToggleLeft, ToggleRight, Copy, Check } from 'lucide-react';
export default function APIKeysPage() {
  const { t } = useLanguage(); const { isDark } = useTheme();
  const [keys, setKeys] = useState([]); const [loading, setLoading] = useState(true); const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState(''); const [newKeyValue, setNewKeyValue] = useState(''); const [copied, setCopied] = useState(false);
  useEffect(() => { loadKeys(); }, []);
  const loadKeys = async () => { try { setLoading(true); const res = await apikeyAPI.getAll(); setKeys(res.data?.data || []); } catch(e){console.error(e)} finally{setLoading(false)} };
  const handleCreate = async () => { if(!newKeyName.trim()) return; try { setCreating(true); const res = await apikeyAPI.create({name:newKeyName.trim()}); setNewKeyValue(res.data?.data?.key||''); setNewKeyName(''); loadKeys(); } catch(e){alert(e.message)} finally{setCreating(false)} };
  const handleCopy = () => { navigator.clipboard.writeText(newKeyValue); setCopied(true); setTimeout(()=>setCopied(false),2000); };
  const handleDelete = async (id) => { if(!confirm(t('common.confirm'))) return; try { await apikeyAPI.delete(id); loadKeys(); } catch(e){console.error(e)} };
  const handleToggle = async (id) => { try { await apikeyAPI.toggle(id); loadKeys(); } catch(e){console.error(e)} };
  const card = isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200';
  const text = isDark ? 'text-white' : 'text-gray-900'; const textSec = isDark ? 'text-gray-400' : 'text-gray-600'; const textMuted = isDark ? 'text-gray-500' : 'text-gray-500';
  const inputCls = `w-full rounded-xl px-4 py-2.5 border focus:border-teal-500 focus:outline-none ${isDark ? 'bg-[#1a1a1d] border-[#27272a] text-white' : 'bg-white border-gray-300 text-gray-900'}`;
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className={`text-2xl font-bold mb-6 ${text}`}>مفاتيح API</h1>
      <div className={`rounded-2xl p-6 border mb-6 ${card}`}>
        <h3 className={`font-semibold mb-3 ${text}`}>إنشاء مفتاح جديد</h3>
        <div className="flex gap-3"><input value={newKeyName} onChange={e=>setNewKeyName(e.target.value)} placeholder="اسم المفتاح" className={inputCls}/>
          <button onClick={handleCreate} disabled={creating||!newKeyName.trim()} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white font-bold rounded-xl transition disabled:opacity-50"><Plus size={16}/> إنشاء</button></div>
        {newKeyValue&&<div className={`mt-4 p-4 rounded-xl border ${isDark?'bg-emerald-500/10 border-emerald-500/30':'bg-emerald-50 border-emerald-200'}`}><p className="text-emerald-400 text-sm mb-2">انسخ المفتاح الآن — لن يظهر مرة أخرى!</p><div className="flex items-center gap-2"><code className={`flex-1 p-3 rounded-lg text-sm font-mono break-all ${isDark?'bg-[#0a0a0b] text-gray-300':'bg-white text-gray-700'}`} dir="ltr">{newKeyValue}</code><button onClick={handleCopy} className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">{copied?<Check size={16}/>:<Copy size={16}/>}</button></div></div>}
      </div>
      <div className="space-y-3">{keys.map(key=>(<div key={key.id} className={`rounded-2xl p-4 border flex items-center justify-between ${card}`}><div className="flex items-center gap-3"><Key size={18} className="text-teal-400"/><div><div className={`font-medium ${text}`}>{key.name}</div><div className={`text-xs font-mono ${textMuted}`} dir="ltr">{key.keyPrefix}</div><div className={`text-xs mt-0.5 ${textMuted}`}>استخدام: {key.usageCount} • آخر: {key.lastUsedAt?new Date(key.lastUsedAt).toLocaleDateString('ar-SA'):'لم يُستخدم'}</div></div></div><div className="flex items-center gap-2"><button onClick={()=>handleToggle(key.id)} className={`p-2 rounded-lg ${isDark?'hover:bg-[#1a1a1d]':'hover:bg-gray-100'}`}>{key.isActive?<ToggleRight size={20} className="text-emerald-400"/>:<ToggleLeft size={20} className={textMuted}/>}</button><button onClick={()=>handleDelete(key.id)} className={`p-2 rounded-lg ${isDark?'hover:bg-red-500/10':'hover:bg-red-50'}`}><Trash2 size={16} className="text-red-400"/></button></div></div>))}{!loading&&keys.length===0&&<div className={`text-center py-12 ${textMuted}`}>لا توجد مفاتيح API</div>}</div>
    </div>
  );
}
