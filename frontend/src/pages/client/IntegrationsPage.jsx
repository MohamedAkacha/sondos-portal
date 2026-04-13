import { useState, useEffect } from "react";
import { 
  Wrench, Search, Plus, Edit, Trash2, Eye, 
  Loader2, AlertCircle, X, CheckCircle, XCircle, RefreshCw,
  Globe, Clock, Code, Link2, Settings, ChevronDown, ChevronRight,
  Copy, ExternalLink, Zap
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import toolAPI from "@/services/api/toolAPI";
// v2: Compatibility wrapper
const toolsAPI = {
  getAll: async () => { const res = await toolAPI.getAll(); return { data: res.data?.data || [] }; },
  delete: async (id) => toolAPI.delete(id),
  update: async (id, data) => toolAPI.update(id, data),
  create: async (data) => toolAPI.create(data),
};

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
const PARAM_TYPES = ['string', 'number', 'boolean', 'array', 'object'];

export default function IntegrationsPage() {
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedTool, setSelectedTool] = useState(null);
  
  // Toast
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  useEffect(() => {
    loadTools();
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  // Send notification to backend
  const sendNotification = async (title, message, type = 'info') => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    const API_BASE = '/api';
    try {
      await fetch(`${API_BASE}/notifications`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, message, type })
      });
    } catch (err) {
      // Silent fail
    }
  };

  const loadTools = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await toolsAPI.getAll();
      console.log('📦 Tools response:', response);
      
      let toolsData = [];
      if (response.data && Array.isArray(response.data)) {
        toolsData = response.data;
      } else if (Array.isArray(response)) {
        toolsData = response;
      }
      
      setTools(toolsData);
    } catch (err) {
      console.error('❌ Error loading tools:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleView = (tool) => {
    setSelectedTool(tool);
    setShowViewModal(true);
  };

  const handleEdit = (tool) => {
    setSelectedTool(tool);
    setShowAddModal(true);
  };

  const handleDelete = (tool) => {
    setSelectedTool(tool);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    try {
      console.log('🗑️ Deleting tool:', selectedTool.id);
      await toolsAPI.delete(selectedTool.id);
      showToast('Tool deleted successfully', 'success');
      sendNotification('تم حذف أداة الربط 🗑️', `تم حذف الأداة "${selectedTool.name || selectedTool.id}" بنجاح`, 'warning');
      loadTools();
      setShowDeleteConfirm(false);
      setSelectedTool(null);
    } catch (err) {
      console.error('❌ Delete error:', err);
      showToast(err.message || 'Failed to delete', 'error');
    }
  };

  const handleSave = async (toolData) => {
    try {
      if (selectedTool) {
        console.log('📝 Updating tool:', selectedTool.id, toolData);
        await toolsAPI.update(selectedTool.id, toolData);
        showToast('Tool updated successfully', 'success');
        sendNotification('تم تحديث أداة الربط ✏️', `تم تحديث الأداة "${toolData.name || selectedTool.name}" بنجاح`, 'success');
      } else {
        console.log('➕ Creating tool:', toolData);
        await toolsAPI.create(toolData);
        showToast('Tool created successfully', 'success');
        sendNotification('تم إنشاء أداة ربط جديدة 🔗', `تم إنشاء الأداة "${toolData.name}" بنجاح`, 'success');
      }
      loadTools();
      setShowAddModal(false);
      setSelectedTool(null);
    } catch (err) {
      console.error('❌ Save error:', err);
      throw err;
    }
  };

  // Filter tools
  const filteredTools = tools.filter(tool => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (tool.name || '').toLowerCase().includes(query) ||
           (tool.description || '').toLowerCase().includes(query) ||
           (tool.endpoint || '').toLowerCase().includes(query);
  });

  // Stats
  const stats = {
    total: tools.length,
    get: tools.filter(t => t.method === 'GET').length,
    post: tools.filter(t => t.method === 'POST').length,
    other: tools.filter(t => !['GET', 'POST'].includes(t.method)).length,
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast.show && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 ${
          toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'
        } text-white`}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('integ.title')}</h1>
          <p className={`mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('integ.subtitle')}</p>
        </div>
        <button
          onClick={() => { setSelectedTool(null); setShowAddModal(true); }}
          className="px-5 py-2.5 bg-gradient-to-l from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-teal-500/25"
        >
          <Plus className="w-5 h-5" />
          {t('integ.addTool')}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className={`rounded-xl p-4 border ${isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-teal-500/10 text-teal-500">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('integ.totalTools')}</p>
              <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{stats.total}</p>
            </div>
          </div>
        </div>
        <div className={`rounded-xl p-4 border ${isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-500/10 text-emerald-500">
              <Code className="w-5 h-5" />
            </div>
            <div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>GET</p>
              <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{stats.get}</p>
            </div>
          </div>
        </div>
        <div className={`rounded-xl p-4 border ${isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500/10 text-blue-500">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>POST</p>
              <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{stats.post}</p>
            </div>
          </div>
        </div>
        <div className={`rounded-xl p-4 border ${isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-purple-500/10 text-purple-500">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('integ.other')}</p>
              <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{stats.other}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Refresh */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className={`absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
          <input
            type="text"
            placeholder={t("integ.searchTools")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-4 pr-11 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-teal-500/50 ${isDark ? 'bg-[#111113] border-[#1f1f23] text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`}
          />
        </div>
        <button 
          onClick={loadTools} 
          disabled={loading} 
          className={`px-4 py-2.5 rounded-xl border flex items-center gap-2 ${isDark ? 'bg-[#111113] border-[#1f1f23] text-white hover:bg-[#1a1a1d]' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
        <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>{filteredTools.length} {t('integ.tools')}</span>
      </div>

      {/* Error */}
      {error && (
        <div className={`flex items-center gap-3 p-4 rounded-xl ${isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className={isDark ? 'text-red-400' : 'text-red-600'}>{error}</span>
        </div>
      )}

      {/* Tools List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
        </div>
      ) : filteredTools.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Wrench className={`w-16 h-16 mb-4 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
          <p className={`text-lg font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('integ.noTools')}</p>
          <button onClick={() => setShowAddModal(true)} className="mt-4 text-teal-500 hover:underline">{t('integ.createFirst')}</button>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredTools.map((tool) => (
            <ToolCard 
              key={tool.id} 
              tool={tool} 
              isDark={isDark}
              onView={() => handleView(tool)}
              onEdit={() => handleEdit(tool)}
              onDelete={() => handleDelete(tool)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showViewModal && selectedTool && (
        <ViewToolModal isDark={isDark} tool={selectedTool} onClose={() => { setShowViewModal(false); setSelectedTool(null); }} />
      )}
      
      {showAddModal && (
        <EditToolModal isDark={isDark} tool={selectedTool} onClose={() => { setShowAddModal(false); setSelectedTool(null); }} onSave={handleSave} />
      )}
      
      {showDeleteConfirm && selectedTool && (
        <DeleteConfirmModal isDark={isDark} tool={selectedTool} onClose={() => { setShowDeleteConfirm(false); setSelectedTool(null); }} onConfirm={confirmDelete} />
      )}
    </div>
  );
}

// ==================== Tool Card ====================
function ToolCard({ tool, isDark, onView, onEdit, onDelete }) {
  const { t } = useLanguage();
  const methodColors = {
    GET: 'bg-emerald-500/10 text-emerald-500',
    POST: 'bg-blue-500/10 text-blue-500',
    PUT: 'bg-amber-500/10 text-amber-500',
    DELETE: 'bg-red-500/10 text-red-500',
    PATCH: 'bg-purple-500/10 text-purple-500',
  };

  const copyEndpoint = () => {
    navigator.clipboard.writeText(tool.endpoint);
  };

  return (
    <div className={`rounded-xl border p-5 ${isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200'}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4 flex-1">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-white shrink-0">
            <Wrench className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h3 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>{tool.name}</h3>
              <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${methodColors[tool.method] || 'bg-gray-500/10 text-gray-500'}`}>
                {tool.method}
              </span>
            </div>
            <p className={`text-sm mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {tool.description || t('integ.noDescription')}
            </p>
            <div className="flex items-center gap-2">
              <code className={`text-xs px-2 py-1 rounded-lg flex-1 truncate ${isDark ? 'bg-[#0a0a0b] text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                {tool.endpoint}
              </code>
              <button onClick={copyEndpoint} className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-[#1a1a1d] text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-4 mt-3">
              {tool.timeout && (
                <span className={`text-xs flex items-center gap-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  <Clock className="w-3 h-3" /> {tool.timeout}s {t('integ.timeout')}
                </span>
              )}
              {tool.headers?.length > 0 && (
                <span className={`text-xs flex items-center gap-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  <Code className="w-3 h-3" /> {tool.headers.length} {t('integ.headers')}
                </span>
              )}
              {tool.schema?.length > 0 && (
                <span className={`text-xs flex items-center gap-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  <Settings className="w-3 h-3" /> {tool.schema.length} {t('integ.params')}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-4">
          <button onClick={onView} className={`p-2 rounded-lg ${isDark ? 'hover:bg-[#1a1a1d] text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
            <Eye className="w-4 h-4" />
          </button>
          <button onClick={onEdit} className={`p-2 rounded-lg ${isDark ? 'hover:bg-[#1a1a1d] text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
            <Edit className="w-4 h-4" />
          </button>
          <button onClick={onDelete} className="p-2 rounded-lg hover:bg-red-500/10 text-red-500">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== View Tool Modal ====================
function ViewToolModal({ isDark, tool, onClose }) {
  const { t } = useLanguage();
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
      <div className={`w-full max-w-2xl my-8 rounded-2xl ${isDark ? 'bg-[#111113]' : 'bg-white'}`}>
        <div className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-[#1f1f23]' : 'border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-white">
              <Wrench className="w-6 h-6" />
            </div>
            <div>
              <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{tool.name}</h2>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('integ.toolDetails')}</p>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 rounded-lg ${isDark ? 'hover:bg-[#1a1a1d]' : 'hover:bg-gray-100'}`}>
            <X className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
          </button>
        </div>
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className={`p-3 rounded-xl ${isDark ? 'bg-[#0a0a0b]' : 'bg-gray-50'}`}>
              <p className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t('integ.method')}</p>
              <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{tool.method}</p>
            </div>
            <div className={`p-3 rounded-xl ${isDark ? 'bg-[#0a0a0b]' : 'bg-gray-50'}`}>
              <p className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t('integ.timeout')}</p>
              <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{tool.timeout || 30}s</p>
            </div>
          </div>
          
          {/* Description */}
          <div className={`p-3 rounded-xl ${isDark ? 'bg-[#0a0a0b]' : 'bg-gray-50'}`}>
            <p className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t('integ.description')}</p>
            <p className={isDark ? 'text-white' : 'text-gray-900'}>{tool.description || '-'}</p>
          </div>
          
          {/* Endpoint */}
          <div className={`p-3 rounded-xl ${isDark ? 'bg-[#0a0a0b]' : 'bg-gray-50'}`}>
            <div className="flex items-center justify-between mb-1">
              <p className={`text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t('integ.endpoint')}</p>
              <button onClick={() => copyToClipboard(tool.endpoint)} className="text-teal-500 text-xs flex items-center gap-1 hover:text-teal-400">
                <Copy className="w-3 h-3" /> {t('integ.copy')}
              </button>
            </div>
            <code className={`text-sm break-all ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>{tool.endpoint}</code>
          </div>

          {/* Headers */}
          {tool.headers?.length > 0 && (
            <div>
              <h4 className={`font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{t('integ.headers')} ({tool.headers.length})</h4>
              <div className="space-y-2">
                {tool.headers.map((header, idx) => (
                  <div key={idx} className={`p-3 rounded-xl flex items-center justify-between ${isDark ? 'bg-[#0a0a0b]' : 'bg-gray-50'}`}>
                    <span className={`font-mono text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{header.name}</span>
                    <span className={`font-mono text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{header.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Schema */}
          {tool.schema?.length > 0 && (
            <div>
              <h4 className={`font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{t('integ.parameters')} ({tool.schema.length})</h4>
              <div className="space-y-2">
                {tool.schema.map((param, idx) => (
                  <div key={idx} className={`p-3 rounded-xl ${isDark ? 'bg-[#0a0a0b]' : 'bg-gray-50'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`font-mono font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{param.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${isDark ? 'bg-[#1a1a1d] text-gray-400' : 'bg-gray-200 text-gray-600'}`}>{param.type}</span>
                    </div>
                    {param.description && (
                      <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{param.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className={`p-6 border-t ${isDark ? 'border-[#1f1f23]' : 'border-gray-200'}`}>
          <button onClick={onClose} className={`w-full py-3 rounded-xl font-medium ${isDark ? 'bg-[#1a1a1d] text-white hover:bg-[#222225]' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`}>{t('common.close')}</button>
        </div>
      </div>
    </div>
  );
}

// ==================== Edit Tool Modal ====================
function EditToolModal({ isDark, tool, onClose, onSave }) {
  const { t } = useLanguage();
  const [name, setName] = useState(tool?.name || '');
  const [description, setDescription] = useState(tool?.description || '');
  const [endpoint, setEndpoint] = useState(tool?.endpoint || '');
  const [method, setMethod] = useState(tool?.method || 'GET');
  const [timeout, setTimeout] = useState(tool?.timeout || 30);
  const [headers, setHeaders] = useState(tool?.headers || []);
  const [schema, setSchema] = useState(tool?.schema || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Sections expanded state
  const [showHeaders, setShowHeaders] = useState(headers.length > 0);
  const [showSchema, setShowSchema] = useState(schema.length > 0);

  const isEdit = !!tool;

  // Headers management
  const addHeader = () => setHeaders([...headers, { name: '', value: '' }]);
  const removeHeader = (idx) => setHeaders(headers.filter((_, i) => i !== idx));
  const updateHeader = (idx, field, value) => {
    const newHeaders = [...headers];
    newHeaders[idx][field] = value;
    setHeaders(newHeaders);
  };

  // Schema management
  const addParam = () => setSchema([...schema, { name: '', type: 'string', description: '' }]);
  const removeParam = (idx) => setSchema(schema.filter((_, i) => i !== idx));
  const updateParam = (idx, field, value) => {
    const newSchema = [...schema];
    newSchema[idx][field] = value;
    setSchema(newSchema);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError(t('integ.nameRequired'));
      return;
    }
    if (!endpoint.trim()) {
      setError(t('integ.endpointRequired'));
      return;
    }
    
    setLoading(true);
    setError("");
    try {
      const submitData = {
        name: name.trim(),
        description: description.trim() || '',
        endpoint: endpoint.trim(),
        method,
        timeout: parseInt(timeout) || 30,
      };

      // Only include headers if they have values
      const validHeaders = headers.filter(h => h.name.trim() && h.value.trim());
      if (validHeaders.length > 0) {
        submitData.headers = validHeaders;
      }

      // Only include schema if it has values
      const validSchema = schema.filter(s => s.name.trim());
      if (validSchema.length > 0) {
        submitData.schema = validSchema;
      }

      console.log('📤 Submitting tool:', JSON.stringify(submitData, null, 2));
      await onSave(submitData);
    } catch (err) {
      console.error('❌ Tool Error:', err);
      setError(err.message || t("integ.errorOccurred"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
      <div className={`w-full max-w-2xl my-8 rounded-2xl ${isDark ? 'bg-[#111113]' : 'bg-white'}`}>
        <div className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-[#1f1f23]' : 'border-gray-200'}`}>
          <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {isEdit ? t('integ.editTool') : t('integ.createTool')}
          </h2>
          <button onClick={onClose} className={`p-2 rounded-lg ${isDark ? 'hover:bg-[#1a1a1d]' : 'hover:bg-gray-100'}`}>
            <X className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Name */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{t('kb.name')} *</label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder={t("integ.toolName")} 
                className={`w-full px-4 py-3 rounded-xl border ${isDark ? 'bg-[#0a0a0b] border-[#1f1f23] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`} 
              />
            </div>

            {/* Description */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{t('integ.description')}</label>
              <textarea 
                value={description} 
                onChange={(e) => setDescription(e.target.value)} 
                placeholder={t("integ.toolDesc")} 
                rows={2} 
                className={`w-full px-4 py-3 rounded-xl border resize-none ${isDark ? 'bg-[#0a0a0b] border-[#1f1f23] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`} 
              />
            </div>

            {/* Endpoint */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{t('integ.endpointUrl')} *</label>
              <input 
                type="url" 
                value={endpoint} 
                onChange={(e) => setEndpoint(e.target.value)} 
                placeholder="https://api.example.com/endpoint" 
                dir="ltr"
                className={`w-full px-4 py-3 rounded-xl border ${isDark ? 'bg-[#0a0a0b] border-[#1f1f23] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`} 
              />
            </div>

            {/* Method & Timeout */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{t('integ.httpMethod')}</label>
                <select 
                  value={method} 
                  onChange={(e) => setMethod(e.target.value)}
                  className={`w-full px-4 py-3 rounded-xl border ${isDark ? 'bg-[#0a0a0b] border-[#1f1f23] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}
                >
                  {HTTP_METHODS.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{t('integ.timeoutSeconds')}</label>
                <input 
                  type="number" 
                  value={timeout} 
                  onChange={(e) => setTimeout(e.target.value)} 
                  min={1} 
                  max={300}
                  className={`w-full px-4 py-3 rounded-xl border ${isDark ? 'bg-[#0a0a0b] border-[#1f1f23] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`} 
                />
              </div>
            </div>

            {/* Headers Section */}
            <div className={`rounded-xl border ${isDark ? 'border-[#1f1f23]' : 'border-gray-200'}`}>
              <button 
                type="button"
                onClick={() => setShowHeaders(!showHeaders)}
                className={`w-full flex items-center justify-between p-4 ${isDark ? 'hover:bg-[#0a0a0b]' : 'hover:bg-gray-50'}`}
              >
                <span className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {t('integ.headers')} {headers.length > 0 && `(${headers.length})`}
                </span>
                {showHeaders ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
              </button>
              {showHeaders && (
                <div className={`p-4 border-t space-y-3 ${isDark ? 'border-[#1f1f23]' : 'border-gray-200'}`}>
                  {headers.map((header, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input 
                        type="text" 
                        value={header.name} 
                        onChange={(e) => updateHeader(idx, 'name', e.target.value)} 
                        placeholder={t("integ.headerName")}
                        className={`flex-1 px-3 py-2 rounded-lg border ${isDark ? 'bg-[#0a0a0b] border-[#1f1f23] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`} 
                      />
                      <input 
                        type="text" 
                        value={header.value} 
                        onChange={(e) => updateHeader(idx, 'value', e.target.value)} 
                        placeholder={t("integ.headerValue")}
                        className={`flex-1 px-3 py-2 rounded-lg border ${isDark ? 'bg-[#0a0a0b] border-[#1f1f23] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`} 
                      />
                      <button type="button" onClick={() => removeHeader(idx)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={addHeader} className="text-teal-500 text-sm flex items-center gap-1 hover:text-teal-400">
                    <Plus className="w-4 h-4" /> {t('integ.addHeader')}
                  </button>
                </div>
              )}
            </div>

            {/* Schema Section */}
            <div className={`rounded-xl border ${isDark ? 'border-[#1f1f23]' : 'border-gray-200'}`}>
              <button 
                type="button"
                onClick={() => setShowSchema(!showSchema)}
                className={`w-full flex items-center justify-between p-4 ${isDark ? 'hover:bg-[#0a0a0b]' : 'hover:bg-gray-50'}`}
              >
                <span className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {t('integ.parameters')} {schema.length > 0 && `(${schema.length})`}
                </span>
                {showSchema ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
              </button>
              {showSchema && (
                <div className={`p-4 border-t space-y-3 ${isDark ? 'border-[#1f1f23]' : 'border-gray-200'}`}>
                  {schema.map((param, idx) => (
                    <div key={idx} className={`p-3 rounded-lg space-y-2 ${isDark ? 'bg-[#0a0a0b]' : 'bg-gray-50'}`}>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={param.name} 
                          onChange={(e) => updateParam(idx, 'name', e.target.value)} 
                          placeholder={t("integ.paramName")}
                          className={`flex-1 px-3 py-2 rounded-lg border ${isDark ? 'bg-[#111113] border-[#1f1f23] text-white' : 'bg-white border-gray-200 text-gray-900'}`} 
                        />
                        <select 
                          value={param.type} 
                          onChange={(e) => updateParam(idx, 'type', e.target.value)}
                          className={`w-32 px-3 py-2 rounded-lg border ${isDark ? 'bg-[#111113] border-[#1f1f23] text-white' : 'bg-white border-gray-200 text-gray-900'}`}
                        >
                          {PARAM_TYPES.map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                        <button type="button" onClick={() => removeParam(idx)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <input 
                        type="text" 
                        value={param.description} 
                        onChange={(e) => updateParam(idx, 'description', e.target.value)} 
                        placeholder={t("integ.paramDesc")}
                        className={`w-full px-3 py-2 rounded-lg border ${isDark ? 'bg-[#111113] border-[#1f1f23] text-white' : 'bg-white border-gray-200 text-gray-900'}`} 
                      />
                    </div>
                  ))}
                  <button type="button" onClick={addParam} className="text-teal-500 text-sm flex items-center gap-1 hover:text-teal-400">
                    <Plus className="w-4 h-4" /> {t('integ.addParam')}
                  </button>
                </div>
              )}
            </div>

            {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">{error}</div>}
          </div>
          <div className={`flex gap-3 p-6 border-t ${isDark ? 'border-[#1f1f23]' : 'border-gray-200'}`}>
            <button type="button" onClick={onClose} className={`flex-1 py-3 rounded-xl font-medium ${isDark ? 'bg-[#1a1a1d] text-white' : 'bg-gray-100 text-gray-900'}`}>{t('common.cancel')}</button>
            <button type="submit" disabled={loading} className="flex-1 py-3 bg-gradient-to-l from-teal-500 to-cyan-500 text-white font-bold rounded-xl flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              {isEdit ? t('integ.saveChanges') : t('integ.createTool')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==================== Delete Confirm Modal ====================
function DeleteConfirmModal({ isDark, tool, onClose, onConfirm }) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    await onConfirm();
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className={`w-full max-w-sm rounded-2xl p-6 ${isDark ? 'bg-[#111113]' : 'bg-white'}`}>
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
            <Trash2 className="w-8 h-8 text-red-500" />
          </div>
          <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('integ.deleteTool')}</h3>
          <p className={`mb-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {t('integ.deleteConfirm').replace('{name}', tool.name)}
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} disabled={loading} className={`flex-1 py-3 rounded-xl font-medium ${isDark ? 'bg-[#1a1a1d] text-white' : 'bg-gray-100 text-gray-900'}`}>{t('common.cancel')}</button>
            <button onClick={handleConfirm} disabled={loading} className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              {t('common.delete')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}