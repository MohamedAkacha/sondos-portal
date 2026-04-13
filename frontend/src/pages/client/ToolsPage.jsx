import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import toolAPI from '@/services/api/toolAPI';
import { Wrench, Plus, Trash2, ToggleLeft, ToggleRight, ExternalLink, Loader2 } from 'lucide-react';

export default function ToolsPage() {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadTools(); }, []);
  const loadTools = async () => {
    try { setLoading(true); const res = await toolAPI.getAll(); setTools(res.data?.data || []); }
    catch (err) { console.error(err); } finally { setLoading(false); }
  };
  const handleToggle = async (id) => {
    try { const res = await toolAPI.toggle(id); setTools(prev => prev.map(t => t.id === id ? res.data.data : t)); } catch (err) { console.error(err); }
  };
  const handleDelete = async (id) => {
    if (!confirm(t('common.confirm'))) return;
    try { await toolAPI.delete(id); setTools(prev => prev.filter(t => t.id !== id)); } catch (err) { console.error(err); }
  };

  const card = isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200';
  const text = isDark ? 'text-white' : 'text-gray-900';
  const textSec = isDark ? 'text-gray-400' : 'text-gray-600';
  const textMuted = isDark ? 'text-gray-500' : 'text-gray-500';

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className={`animate-spin ${textSec}`} size={32} /></div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className={`text-2xl font-bold ${text}`}>{t('tools.title')}</h1>
        <button onClick={() => navigate('/tools/create')}
          className="px-5 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white font-bold rounded-xl transition-all flex items-center gap-2">
          <Plus size={18} /> {t('tools.createTool')}
        </button>
      </div>
      {tools.length === 0 ? (
        <div className={`text-center py-16 rounded-2xl border ${card}`}>
          <Wrench className={`mx-auto mb-4 ${textMuted}`} size={48} />
          <h3 className={`text-lg font-medium mb-2 ${text}`}>{t('tools.empty.title')}</h3>
          <p className={`mb-6 ${textMuted}`}>{t('tools.empty.description')}</p>
          <button onClick={() => navigate('/tools/create')} className="px-5 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-bold rounded-xl">{t('tools.empty.action')}</button>
        </div>
      ) : (
        <div className="space-y-3">
          {tools.map(tool => (
            <div key={tool.id} className={`rounded-2xl p-5 border ${card} transition-all`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tool.type === 'built_in' ? (isDark ? 'bg-cyan-500/20' : 'bg-cyan-50') : (isDark ? 'bg-teal-500/20' : 'bg-teal-50')}`}>
                    <Wrench size={18} className={tool.type === 'built_in' ? 'text-cyan-400' : 'text-teal-400'} />
                  </div>
                  <div>
                    <div className={`font-medium ${text}`}>{tool.name}</div>
                    <div className={`text-sm ${textMuted}`}>{tool.description?.substring(0, 80)}</div>
                    <div className={`text-xs mt-1 font-mono ${textMuted}`}>{tool.functionName}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${tool.type === 'built_in' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-teal-500/10 text-teal-400 border-teal-500/20'}`}>
                    {tool.type === 'built_in' ? t('tools.builtIn') : t('tools.custom')}
                  </span>
                  <button onClick={() => handleToggle(tool.id)} className={`p-2 rounded-lg ${isDark ? 'hover:bg-[#1a1a1d]' : 'hover:bg-gray-100'}`}>
                    {tool.isActive ? <ToggleRight size={20} className="text-emerald-400" /> : <ToggleLeft size={20} className={textMuted} />}
                  </button>
                  <button onClick={() => handleDelete(tool.id)} className={`p-2 rounded-lg ${isDark ? 'hover:bg-red-500/10' : 'hover:bg-red-50'}`}>
                    <Trash2 size={16} className="text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
