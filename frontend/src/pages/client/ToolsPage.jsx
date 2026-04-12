import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/hooks/useLanguage';
import toolAPI from '@/services/api/toolAPI';
import { Plus, Wrench, ToggleLeft, ToggleRight, Trash2, Edit, Zap, ExternalLink } from 'lucide-react';

export default function ToolsPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [tools, setTools] = useState([]);
  const [builtInTools, setBuiltInTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('custom');

  useEffect(() => {
    loadTools();
  }, []);

  const loadTools = async () => {
    try {
      setLoading(true);
      const [customRes, builtInRes] = await Promise.all([
        toolAPI.getAll(),
        toolAPI.getBuiltIn(),
      ]);
      setTools(customRes.data?.data?.tools || []);
      setBuiltInTools(builtInRes.data?.data || []);
    } catch (err) {
      console.error('Failed to load tools:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (id) => {
    try {
      const res = await toolAPI.toggle(id);
      setTools(prev => prev.map(t => t.id === id ? res.data.data : t));
    } catch (err) {
      console.error('Toggle failed:', err);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm(t('common.confirm'))) return;
    try {
      await toolAPI.delete(id);
      setTools(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-gray-400">{t('common.loading')}</div></div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('tools.title')}</h1>
        </div>
        <button
          onClick={() => navigate('/tools/create')}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition"
        >
          <Plus size={18} />
          {t('tools.createTool')}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white/5 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('custom')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'custom' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          {t('tools.custom')} ({tools.length})
        </button>
        <button
          onClick={() => setActiveTab('built-in')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'built-in' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          {t('tools.builtIn')} ({builtInTools.length})
        </button>
      </div>

      {/* Custom Tools */}
      {activeTab === 'custom' && (
        <>
          {tools.length === 0 ? (
            <div className="text-center py-16 bg-white/5 rounded-xl border border-white/10">
              <Wrench className="mx-auto mb-4 text-gray-500" size={48} />
              <h3 className="text-lg font-medium text-gray-300 mb-2">{t('tools.empty.title')}</h3>
              <p className="text-gray-500 mb-6">{t('tools.empty.description')}</p>
              <button
                onClick={() => navigate('/tools/create')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition"
              >
                {t('tools.empty.action')}
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {tools.map(tool => (
                <div key={tool.id} className="bg-white/5 border border-white/10 rounded-xl p-5 hover:border-white/20 transition">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg">{tool.name}</h3>
                        <code className="text-xs bg-white/10 px-2 py-0.5 rounded text-indigo-300">{tool.functionName}</code>
                        <span className={`text-xs px-2 py-0.5 rounded ${tool.isEnabled ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                          {tool.isEnabled ? t('common.active') : t('common.inactive')}
                        </span>
                      </div>
                      <p className="text-gray-400 text-sm mb-3">{tool.description}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>{tool.httpConfig?.method} {tool.httpConfig?.url}</span>
                        <span>•</span>
                        <span>{tool.parameters?.length || 0} {t('tools.parameters.title')}</span>
                        <span>•</span>
                        <span>{tool.executionCount} executions</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleToggle(tool.id)} className="p-2 hover:bg-white/10 rounded-lg transition" title="Toggle">
                        {tool.isEnabled ? <ToggleRight size={20} className="text-green-400" /> : <ToggleLeft size={20} className="text-gray-500" />}
                      </button>
                      <button onClick={() => navigate(`/tools/${tool.id}/edit`)} className="p-2 hover:bg-white/10 rounded-lg transition" title={t('common.edit')}>
                        <Edit size={18} className="text-gray-400" />
                      </button>
                      <button onClick={() => handleDelete(tool.id)} className="p-2 hover:bg-red-500/20 rounded-lg transition" title={t('common.delete')}>
                        <Trash2 size={18} className="text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Built-in Tools */}
      {activeTab === 'built-in' && (
        <div className="grid gap-4">
          {builtInTools.map(tool => (
            <div key={tool.functionName} className="bg-white/5 border border-white/10 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-2">
                <Zap size={18} className="text-yellow-400" />
                <h3 className="font-semibold">{tool.name}</h3>
                <code className="text-xs bg-white/10 px-2 py-0.5 rounded text-yellow-300">{tool.functionName}</code>
                <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">{t('tools.builtIn')}</span>
              </div>
              <p className="text-gray-400 text-sm">{tool.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
