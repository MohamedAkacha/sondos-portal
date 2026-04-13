import { useState, useEffect, useRef } from "react";
import { 
  Database, Search, Plus, Edit, Trash2, Eye, FileText, 
  Loader2, AlertCircle, X, File, Calendar, Hash, CheckCircle, XCircle, RefreshCw,
  Link, Globe, ChevronDown, ChevronRight, ExternalLink, Type, List, Upload, FileUp
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import knowledgeAPI from "@/services/api/knowledgeAPI";
// v2: Compatibility wrapper mapping old API to new
const knowledgebasesAPI = {
  getAll: async () => { const res = await knowledgeAPI.getAllBases(); return { data: (res.data?.data || []).map(b => ({ id: b.id, name: b.name, description: b.description, documents_count: b.totalDocuments, ...b })) }; },
  getDocuments: async (kbId) => { const res = await knowledgeAPI.getDocuments(kbId); return { data: (res.data?.data || []).map(d => ({ id: d.id, name: d.fileName || d.faqQuestion || d.sourceUrl, type: d.sourceType, status: d.status, ...d })) }; },
  delete: async (id) => knowledgeAPI.deleteBase(id),
  update: async (id, data) => knowledgeAPI.updateBase(id, data),
  create: async (data) => { const res = await knowledgeAPI.createBase(data); return { data: res.data?.data }; },
  deleteDocument: async (kbId, docId) => knowledgeAPI.deleteDocument(docId),
  updateDocument: async (kbId, docId, data) => { /* v2: not implemented yet */ },
  uploadDocument: async (kbId, fileName, content, fileType, file) => knowledgeAPI.uploadDocument(kbId, file),
  createDocument: async (kbId, data) => { if (data.type === 'url') return knowledgeAPI.addUrl(kbId, data.url || data.content); if (data.type === 'faq') return knowledgeAPI.addFaq(kbId, data.question || data.name, data.answer || data.content); return knowledgeAPI.addUrl(kbId, data.content); },
};

export default function KnowledgePage() {
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const [knowledgebases, setKnowledgebases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // KB Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedKB, setSelectedKB] = useState(null);
  
  // Document Modals
  const [showDocModal, setShowDocModal] = useState(false);
  const [showDocDeleteConfirm, setShowDocDeleteConfirm] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [docParentKB, setDocParentKB] = useState(null);
  
  // Expanded KBs (to show documents)
  const [expandedKBs, setExpandedKBs] = useState({});
  const [kbDocuments, setKbDocuments] = useState({});
  const [loadingDocs, setLoadingDocs] = useState({});
  
  // Toast notification
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  useEffect(() => {
    loadKnowledgebases();
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

  const loadKnowledgebases = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await knowledgebasesAPI.getAll();
      console.log('📦 Knowledgebases response:', response);
      
      let kbData = [];
      if (response.data && Array.isArray(response.data)) {
        kbData = response.data;
      } else if (Array.isArray(response)) {
        kbData = response;
      }
      
      setKnowledgebases(kbData);
    } catch (err) {
      console.error('❌ Error loading knowledgebases:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadDocuments = async (kbId) => {
    setLoadingDocs(prev => ({ ...prev, [kbId]: true }));
    try {
      const response = await knowledgebasesAPI.getDocuments(kbId);
      console.log(`📄 Documents for KB ${kbId}:`, response);
      
      let docs = [];
      if (response.data && Array.isArray(response.data)) {
        docs = response.data;
      } else if (Array.isArray(response)) {
        docs = response;
      }
      
      setKbDocuments(prev => ({ ...prev, [kbId]: docs }));
    } catch (err) {
      console.error('❌ Error loading documents:', err);
      showToast(err.message || 'Failed to load documents', 'error');
    } finally {
      setLoadingDocs(prev => ({ ...prev, [kbId]: false }));
    }
  };

  const toggleExpand = (kbId) => {
    const newExpanded = !expandedKBs[kbId];
    setExpandedKBs(prev => ({ ...prev, [kbId]: newExpanded }));
    if (newExpanded && !kbDocuments[kbId]) {
      loadDocuments(kbId);
    }
  };

  // KB Handlers
  const handleView = (kb) => {
    setSelectedKB(kb);
    setShowViewModal(true);
  };

  const handleEdit = (kb) => {
    setSelectedKB(kb);
    setShowAddModal(true);
  };

  const handleDelete = (kb) => {
    setSelectedKB(kb);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    try {
      console.log('🗑️ Deleting KB:', selectedKB.id);
      await knowledgebasesAPI.delete(selectedKB.id);
      showToast('Knowledge base deleted successfully', 'success');
      sendNotification('تم حذف قاعدة المعرفة 🗑️', `تم حذف قاعدة المعرفة "${selectedKB.name || selectedKB.id}" بنجاح`, 'warning');
      loadKnowledgebases();
      setShowDeleteConfirm(false);
      setSelectedKB(null);
    } catch (err) {
      console.error('❌ Delete error:', err);
      showToast(err.message || 'Failed to delete', 'error');
    }
  };

  const handleSave = async (kbData) => {
    try {
      if (selectedKB) {
        console.log('📝 Updating KB:', selectedKB.id, kbData);
        await knowledgebasesAPI.update(selectedKB.id, kbData);
        showToast('Knowledge base updated successfully', 'success');
        sendNotification('تم تحديث قاعدة المعرفة ✏️', `تم تحديث قاعدة المعرفة "${kbData.name || selectedKB.name}" بنجاح`, 'success');
      } else {
        console.log('➕ Creating KB:', kbData);
        await knowledgebasesAPI.create(kbData);
        showToast('Knowledge base created successfully', 'success');
        sendNotification('تم إنشاء قاعدة معرفة جديدة 📚', `تم إنشاء قاعدة المعرفة "${kbData.name}" بنجاح`, 'success');
      }
      loadKnowledgebases();
      setShowAddModal(false);
      setSelectedKB(null);
    } catch (err) {
      console.error('❌ Save error:', err);
      throw err;
    }
  };

  // Document Handlers
  const handleAddDoc = (kb) => {
    setDocParentKB(kb);
    setSelectedDoc(null);
    setShowDocModal(true);
  };

  const handleEditDoc = (kb, doc) => {
    setDocParentKB(kb);
    setSelectedDoc(doc);
    setShowDocModal(true);
  };

  const handleDeleteDoc = (kb, doc) => {
    setDocParentKB(kb);
    setSelectedDoc(doc);
    setShowDocDeleteConfirm(true);
  };

  const confirmDeleteDoc = async () => {
    try {
      console.log('🗑️ Deleting document:', selectedDoc.id, 'from KB:', docParentKB.id);
      await knowledgebasesAPI.deleteDocument(docParentKB.id, selectedDoc.id);
      showToast('Document deleted successfully', 'success');
      sendNotification('تم حذف مستند 🗑️', `تم حذف المستند "${selectedDoc.name || selectedDoc.id}" من قاعدة المعرفة`, 'warning');
      loadDocuments(docParentKB.id);
      setShowDocDeleteConfirm(false);
      setSelectedDoc(null);
      setDocParentKB(null);
    } catch (err) {
      console.error('❌ Delete doc error:', err);
      showToast(err.message || 'Failed to delete document', 'error');
    }
  };

  const handleSaveDoc = async (docData, file = null) => {
    try {
      if (selectedDoc) {
        // Update existing document
        console.log('📝 Updating document:', selectedDoc.id, docData);
        await knowledgebasesAPI.updateDocument(docParentKB.id, selectedDoc.id, docData);
        showToast('Document updated successfully', 'success');
        sendNotification('تم تحديث مستند ✏️', `تم تحديث المستند "${docData.name || selectedDoc.name}" بنجاح`, 'success');
      } else if (file) {
        // Upload file document using uploadDocument
        const fileExt = file.name.split('.').pop().toLowerCase();
        let fileType = 'txt';
        if (fileExt === 'pdf') fileType = 'pdf';
        else if (fileExt === 'doc' || fileExt === 'docx') fileType = 'docx';
        else if (fileExt === 'txt') fileType = 'txt';
        
        const fileName = file.name.split('.').slice(0, -1).join('.') || file.name;
        console.log('📤 Uploading file document:', file.name, 'type:', fileType, 'to KB:', docParentKB.id);
        await knowledgebasesAPI.uploadDocument(docParentKB.id, fileName, '', fileType, file);
        showToast('File uploaded successfully', 'success');
        sendNotification('تم رفع ملف جديد 📄', `تم رفع الملف "${file.name}" بنجاح إلى قاعدة المعرفة`, 'success');
      } else {
        // Create new document (website type for url/links)
        console.log('➕ Creating document in KB:', docParentKB.id, docData);
        // Map type for API: 'url' and 'links' should be 'website'
        if (docData.type === 'url' || docData.type === 'links') {
          docData.type = 'website';
        }
        await knowledgebasesAPI.createDocument(docParentKB.id, docData);
        showToast('Document created successfully', 'success');
        sendNotification('تم إضافة مستند جديد 📝', `تم إضافة المستند "${docData.name}" بنجاح إلى قاعدة المعرفة`, 'success');
      }
      loadDocuments(docParentKB.id);
      loadKnowledgebases(); // Refresh to update documents_count
      setShowDocModal(false);
      setSelectedDoc(null);
      setDocParentKB(null);
    } catch (err) {
      console.error('❌ Save doc error:', err);
      throw err;
    }
  };

  // Filter knowledgebases
  const filteredKBs = knowledgebases.filter(kb => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (kb.name || '').toLowerCase().includes(query) ||
           (kb.description || '').toLowerCase().includes(query);
  });

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
          <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('kb.title')}</h1>
          <p className={`mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('kb.subtitle')}</p>
        </div>
        <button
          onClick={() => { setSelectedKB(null); setShowAddModal(true); }}
          className="px-5 py-2.5 bg-gradient-to-l from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-teal-500/25"
        >
          <Plus className="w-5 h-5" />
          {t('kb.addKB')}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className={`rounded-xl p-4 border ${isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-teal-500/10 text-teal-500">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('kb.totalKBs')}</p>
              <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{knowledgebases.length}</p>
            </div>
          </div>
        </div>
        <div className={`rounded-xl p-4 border ${isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-500/10 text-emerald-500">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('kb.documents')}</p>
              <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {knowledgebases.reduce((acc, kb) => acc + (kb.documents_count || kb.files_count || 0), 0)}
              </p>
            </div>
          </div>
        </div>
        <div className={`rounded-xl p-4 border ${isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-purple-500/10 text-purple-500">
              <Hash className="w-5 h-5" />
            </div>
            <div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('kb.chunks')}</p>
              <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {knowledgebases.reduce((acc, kb) => acc + (kb.chunks_count || 0), 0)}
              </p>
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
            placeholder={t("common.search")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-4 pr-11 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-teal-500/50 ${isDark ? 'bg-[#111113] border-[#1f1f23] text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`}
          />
        </div>
        <button 
          onClick={loadKnowledgebases} 
          disabled={loading} 
          className={`px-4 py-2.5 rounded-xl border flex items-center gap-2 ${isDark ? 'bg-[#111113] border-[#1f1f23] text-white hover:bg-[#1a1a1d]' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
        <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>{filteredKBs.length} {t("kb.items")}</span>
      </div>

      {/* Error */}
      {error && (
        <div className={`flex items-center gap-3 p-4 rounded-xl ${isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className={isDark ? 'text-red-400' : 'text-red-600'}>{error}</span>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
        </div>
      ) : filteredKBs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Database className={`w-16 h-16 mb-4 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
          <p className={`text-lg font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('kb.noKBs')}</p>
          <button onClick={() => setShowAddModal(true)} className="mt-4 text-teal-500 hover:underline">{t("kb.createFirst")}</button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredKBs.map((kb) => (
            <KBCard 
              key={kb.id} 
              kb={kb} 
              isDark={isDark}
              expanded={expandedKBs[kb.id]}
              documents={kbDocuments[kb.id] || []}
              loadingDocs={loadingDocs[kb.id]}
              onToggle={() => toggleExpand(kb.id)}
              onView={() => handleView(kb)}
              onEdit={() => handleEdit(kb)}
              onDelete={() => handleDelete(kb)}
              onAddDoc={() => handleAddDoc(kb)}
              onEditDoc={(doc) => handleEditDoc(kb, doc)}
              onDeleteDoc={(doc) => handleDeleteDoc(kb, doc)}
              onRefreshDocs={() => loadDocuments(kb.id)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showViewModal && selectedKB && (
        <ViewKBModal isDark={isDark} kb={selectedKB} onClose={() => { setShowViewModal(false); setSelectedKB(null); }} />
      )}
      
      {showAddModal && (
        <EditKBModal isDark={isDark} kb={selectedKB} onClose={() => { setShowAddModal(false); setSelectedKB(null); }} onSave={handleSave} />
      )}
      
      {showDeleteConfirm && selectedKB && (
        <DeleteConfirmModal isDark={isDark} item={selectedKB} type="knowledge base" onClose={() => { setShowDeleteConfirm(false); setSelectedKB(null); }} onConfirm={confirmDelete} />
      )}

      {showDocModal && docParentKB && (
        <EditDocModal isDark={isDark} doc={selectedDoc} kb={docParentKB} onClose={() => { setShowDocModal(false); setSelectedDoc(null); setDocParentKB(null); }} onSave={handleSaveDoc} />
      )}

      {showDocDeleteConfirm && selectedDoc && (
        <DeleteConfirmModal isDark={isDark} item={selectedDoc} type="document" onClose={() => { setShowDocDeleteConfirm(false); setSelectedDoc(null); setDocParentKB(null); }} onConfirm={confirmDeleteDoc} />
      )}
    </div>
  );
}

// ==================== KB Card ====================
function KBCard({ kb, isDark, expanded, documents, loadingDocs, onToggle, onView, onEdit, onDelete, onAddDoc, onEditDoc, onDeleteDoc, onRefreshDocs }) {
  const { t } = useLanguage();
  const name = kb.name || `KB #${kb.id}`;
  const desc = kb.description || t('kb.noDescription');
  const docsCount = kb.documents_count || documents?.length || 0;

  return (
    <div className={`rounded-xl border overflow-hidden ${isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200'}`}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <button onClick={onToggle} className={`p-1 rounded hover:bg-teal-500/10 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {expanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            </button>
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-white">
              <Database className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className={`font-bold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{name}</h3>
              <p className={`text-sm truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{desc}</p>
            </div>
            <div className="flex items-center gap-4 mr-4">
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                <FileText className="w-4 h-4 inline mr-1" />{docsCount} {t('kb.docs')}
              </div>
              <div className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                ID: {kb.id}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
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

      {/* Documents Section */}
      {expanded && (
        <div className={`border-t ${isDark ? 'border-[#1f1f23] bg-[#0a0a0b]' : 'border-gray-200 bg-gray-50'}`}>
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{t('kb.documents')}</h4>
              <div className="flex items-center gap-2">
                <button onClick={onRefreshDocs} disabled={loadingDocs} className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-[#1a1a1d] text-gray-400' : 'hover:bg-gray-200 text-gray-500'}`}>
                  <RefreshCw className={`w-4 h-4 ${loadingDocs ? 'animate-spin' : ''}`} />
                </button>
                <button onClick={onAddDoc} className="px-3 py-1.5 bg-teal-500 hover:bg-teal-400 text-white text-sm rounded-lg flex items-center gap-1">
                  <Plus className="w-4 h-4" />{t("kb.addDocument")}
                </button>
              </div>
            </div>

            {loadingDocs ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
              </div>
            ) : documents.length === 0 ? (
              <div className={`text-center py-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>{t('kb.noDocs')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <DocRow key={doc.id} doc={doc} isDark={isDark} onEdit={() => onEditDoc(doc)} onDelete={() => onDeleteDoc(doc)} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== Document Row ====================
function DocRow({ doc, isDark, onEdit, onDelete }) {
  const { t } = useLanguage();
  const typeIcon = {
    url: <Globe className="w-4 h-4" />,
    links: <List className="w-4 h-4" />,
    text: <Type className="w-4 h-4" />,
    file: <File className="w-4 h-4" />,
  };

  // Determine type display
  const docType = doc.type || (doc.file_name ? 'file' : 'text');
  const docName = doc.name || doc.file_name || `Doc #${doc.id}`;

  return (
    <div className={`flex items-center justify-between p-3 rounded-lg ${isDark ? 'bg-[#111113]' : 'bg-white'}`}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className={`p-2 rounded-lg ${isDark ? 'bg-[#1a1a1d]' : 'bg-gray-100'}`}>
          {typeIcon[docType] || <FileText className="w-4 h-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{docName}</p>
          <p className={`text-xs truncate ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            {docType} • {doc.description || doc.file_size || t('kb.noDescription')}
          </p>
        </div>
        {doc.url && (
          <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-teal-500 hover:text-teal-400">
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>
      <div className="flex items-center gap-1 ml-2">
        <button onClick={onEdit} className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-[#1a1a1d] text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
          <Edit className="w-4 h-4" />
        </button>
        <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ==================== View KB Modal ====================
function ViewKBModal({ isDark, kb, onClose }) {
  const { t } = useLanguage();
  const fields = [
    { key: 'id', label: t('kb.id'), value: kb.id },
    { key: 'name', label: t('kb.name'), value: kb.name },
    { key: 'description', label: t('kb.description'), value: kb.description },
    { key: 'documents_count', label: t('kb.documents'), value: kb.documents_count },
    { key: 'chunks_count', label: t('kb.chunks'), value: kb.chunks_count },
    { key: 'created_at', label: t('kb.created'), value: kb.created_at },
    { key: 'updated_at', label: t('kb.updated'), value: kb.updated_at },
  ].filter(f => f.value !== undefined && f.value !== null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className={`w-full max-w-lg rounded-2xl ${isDark ? 'bg-[#111113]' : 'bg-white'}`}>
        <div className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-[#1f1f23]' : 'border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-white">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{kb.name || `KB #${kb.id}`}</h2>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('kb.kbDetails')}</p>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 rounded-lg ${isDark ? 'hover:bg-[#1a1a1d]' : 'hover:bg-gray-100'}`}>
            <X className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
          </button>
        </div>
        <div className="p-6 space-y-3">
          {fields.map(({ key, label, value }) => (
            <div key={key} className={`p-3 rounded-xl ${isDark ? 'bg-[#0a0a0b]' : 'bg-gray-50'}`}>
              <p className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{label}</p>
              <p className={isDark ? 'text-white' : 'text-gray-900'}>{String(value)}</p>
            </div>
          ))}
        </div>
        <div className={`p-6 border-t ${isDark ? 'border-[#1f1f23]' : 'border-gray-200'}`}>
          <button onClick={onClose} className={`w-full py-3 rounded-xl font-medium ${isDark ? 'bg-[#1a1a1d] text-white hover:bg-[#222225]' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`}>{t('common.close')}</button>
        </div>
      </div>
    </div>
  );
}

// ==================== Edit KB Modal ====================
function EditKBModal({ isDark, kb, onClose, onSave }) {
  const { t } = useLanguage();
  const [name, setName] = useState(kb?.name || '');
  const [description, setDescription] = useState(kb?.description || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(t('kb.nameRequired'));
      return;
    }
    
    setLoading(true);
    setError("");
    try {
      const submitData = { name: name.trim(), description: description.trim() || '' };
      console.log('📤 Submitting KB:', JSON.stringify(submitData, null, 2));
      await onSave(submitData);
    } catch (err) {
      console.error('❌ KB Error:', err);
      setError(err.message || t("kb.errorOccurred"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className={`w-full max-w-lg rounded-2xl ${isDark ? 'bg-[#111113]' : 'bg-white'}`}>
        <div className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-[#1f1f23]' : 'border-gray-200'}`}>
          <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {kb ? t('kb.editKB') : t('kb.createKB')}
          </h2>
          <button onClick={onClose} className={`p-2 rounded-lg ${isDark ? 'hover:bg-[#1a1a1d]' : 'hover:bg-gray-100'}`}>
            <X className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{t('kb.name')} *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("kb.enterKBName")} className={`w-full px-4 py-3 rounded-xl border ${isDark ? 'bg-[#0a0a0b] border-[#1f1f23] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`} />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{t('kb.description')}</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("kb.enterDescription")} rows={4} className={`w-full px-4 py-3 rounded-xl border resize-none ${isDark ? 'bg-[#0a0a0b] border-[#1f1f23] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`} />
            </div>
            {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">{error}</div>}
          </div>
          <div className={`flex gap-3 p-6 border-t ${isDark ? 'border-[#1f1f23]' : 'border-gray-200'}`}>
            <button type="button" onClick={onClose} className={`flex-1 py-3 rounded-xl font-medium ${isDark ? 'bg-[#1a1a1d] text-white' : 'bg-gray-100 text-gray-900'}`}>{t('common.cancel')}</button>
            <button type="submit" disabled={loading} className="flex-1 py-3 bg-gradient-to-l from-teal-500 to-cyan-500 text-white font-bold rounded-xl flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              {kb ? t('common.save') : t('common.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==================== Edit Document Modal ====================
function EditDocModal({ isDark, doc, kb, onClose, onSave }) {
  const { t } = useLanguage();
  const [name, setName] = useState(doc?.name || '');
  const [description, setDescription] = useState(doc?.description || '');
  const [type, setType] = useState(doc?.type || 'file');
  const [url, setUrl] = useState(doc?.url || '');
  const [links, setLinks] = useState(doc?.links?.map(l => l.link || l) || ['']);
  const [relativeLinksLimit, setRelativeLinksLimit] = useState(doc?.relative_links_limit || 10);
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const isEdit = !!doc;

  const addLink = () => setLinks([...links, '']);
  const removeLink = (idx) => setLinks(links.filter((_, i) => i !== idx));
  const updateLink = (idx, val) => {
    const newLinks = [...links];
    newLinks[idx] = val;
    setLinks(newLinks);
  };

  // File handling
  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      if (!name.trim()) {
        setName(selectedFile.name.split('.').slice(0, -1).join('.') || selectedFile.name);
      }
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      setFile(droppedFile);
      if (!name.trim()) {
        setName(droppedFile.name.split('.').slice(0, -1).join('.') || droppedFile.name);
      }
    }
  };

  const removeFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (type === 'file' && !isEdit) {
      if (!file) {
        setError(t('kb.selectFile'));
        return;
      }
    } else {
      if (!name.trim()) {
        setError(t('kb.nameRequired'));
        return;
      }
    }
    
    setLoading(true);
    setError("");
    try {
      if (type === 'file' && !isEdit && file) {
        // File upload
        console.log('📤 Uploading file:', file.name);
        await onSave(null, file);
      } else {
        // Document creation/update
        let submitData = { name: name.trim(), description: description.trim() || '' };
        
        if (!isEdit) {
          submitData.type = type;
          if (type === 'url' && url.trim()) {
            submitData.url = url.trim();
          }
          if (type === 'links') {
            const validLinks = links.filter(l => l.trim()).map(l => ({ link: l.trim() }));
            if (validLinks.length > 0) {
              submitData.links = validLinks;
              submitData.relative_links_limit = parseInt(relativeLinksLimit) || 10;
            }
          }
        }
        
        console.log('📤 Submitting Doc:', JSON.stringify(submitData, null, 2));
        await onSave(submitData);
      }
    } catch (err) {
      console.error('❌ Doc Error:', err);
      setError(err.message || t("kb.errorOccurred"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
      <div className={`w-full max-w-lg my-8 rounded-2xl ${isDark ? 'bg-[#111113]' : 'bg-white'}`}>
        <div className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-[#1f1f23]' : 'border-gray-200'}`}>
          <div>
            <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {isEdit ? t('kb.editDoc') : t('kb.addDoc')}
            </h2>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('kb.inKB')} {kb.name}</p>
          </div>
          <button onClick={onClose} className={`p-2 rounded-lg ${isDark ? 'hover:bg-[#1a1a1d]' : 'hover:bg-gray-100'}`}>
            <X className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
            
            {/* Type selection - only for new documents */}
            {!isEdit && (
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{t('common.type')}</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { value: 'file', icon: Upload, label: t('kb.upload') },
                    { value: 'text', icon: Type, label: t('knowledge.text') },
                    { value: 'url', icon: Globe, label: 'URL' },
                    { value: 'links', icon: List, label: t('knowledge.links') },
                  ].map((opt) => (
                    <button key={opt.value} type="button" onClick={() => setType(opt.value)} className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${type === opt.value ? 'border-teal-500 bg-teal-500/10' : isDark ? 'border-[#1f1f23] hover:border-gray-600' : 'border-gray-200 hover:border-gray-300'}`}>
                      <opt.icon className={`w-5 h-5 ${type === opt.value ? 'text-teal-500' : isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                      <span className={`text-xs ${type === opt.value ? 'text-teal-500 font-medium' : isDark ? 'text-gray-400' : 'text-gray-600'}`}>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* File Upload */}
            {type === 'file' && !isEdit && (
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{t('kb.uploadFile')}</label>
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                    dragActive 
                      ? 'border-teal-500 bg-teal-500/10' 
                      : isDark 
                        ? 'border-[#1f1f23] hover:border-gray-600 bg-[#0a0a0b]' 
                        : 'border-gray-300 hover:border-gray-400 bg-gray-50'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileSelect}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.txt"
                  />
                  
                  {file ? (
                    <div className="space-y-2">
                      <div className="w-12 h-12 mx-auto rounded-xl bg-teal-500/10 flex items-center justify-center">
                        <FileText className="w-6 h-6 text-teal-500" />
                      </div>
                      <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{file.name}</p>
                      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{formatFileSize(file.size)}</p>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeFile(); }}
                        className="text-red-500 text-sm hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="w-12 h-12 mx-auto rounded-xl bg-teal-500/10 flex items-center justify-center">
                        <FileUp className={`w-6 h-6 ${dragActive ? 'text-teal-500' : isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                      </div>
                      <p className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                        <span className="text-teal-500 font-medium">{t("kb.clickToUpload")}</span> {t("kb.orDragDrop")}
                      </p>
                      <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        {t('kb.maxSize')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Name - show for non-file types or when editing */}
            {(type !== 'file' || isEdit) && (
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{t('kb.name')} *</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("kb.docName")} className={`w-full px-4 py-3 rounded-xl border ${isDark ? 'bg-[#0a0a0b] border-[#1f1f23] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`} />
              </div>
            )}

            {/* Description - show for non-file types or when editing */}
            {(type !== 'file' || isEdit) && (
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{t('kb.description')}</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("kb.docDescription")} rows={2} className={`w-full px-4 py-3 rounded-xl border resize-none ${isDark ? 'bg-[#0a0a0b] border-[#1f1f23] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`} />
              </div>
            )}

            {/* URL input */}
            {type === 'url' && !isEdit && (
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{t("knowledge.url")} *</label>
                <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/page" className={`w-full px-4 py-3 rounded-xl border ${isDark ? 'bg-[#0a0a0b] border-[#1f1f23] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`} dir="ltr" />
              </div>
            )}

            {/* Links input */}
            {type === 'links' && !isEdit && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{t("knowledge.links")}</label>
                  <button type="button" onClick={addLink} className="text-teal-500 text-sm flex items-center gap-1 hover:text-teal-400">
                    <Plus className="w-4 h-4" />{t('kb.addLink')}
                  </button>
                </div>
                {links.map((link, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input type="url" value={link} onChange={(e) => updateLink(idx, e.target.value)} placeholder={`https://example.com/page${idx + 1}`} className={`flex-1 px-4 py-2 rounded-xl border ${isDark ? 'bg-[#0a0a0b] border-[#1f1f23] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`} dir="ltr" />
                    {links.length > 1 && (
                      <button type="button" onClick={() => removeLink(idx)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <div>
                  <label className={`block text-sm mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('kb.relativeLinksLimit')}</label>
                  <input type="number" value={relativeLinksLimit} onChange={(e) => setRelativeLinksLimit(e.target.value)} min={1} max={100} className={`w-32 px-4 py-2 rounded-xl border ${isDark ? 'bg-[#0a0a0b] border-[#1f1f23] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`} />
                </div>
              </div>
            )}

            {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">{error}</div>}
          </div>
          <div className={`flex gap-3 p-6 border-t ${isDark ? 'border-[#1f1f23]' : 'border-gray-200'}`}>
            <button type="button" onClick={onClose} className={`flex-1 py-3 rounded-xl font-medium ${isDark ? 'bg-[#1a1a1d] text-white' : 'bg-gray-100 text-gray-900'}`}>{t('common.cancel')}</button>
            <button type="submit" disabled={loading} className="flex-1 py-3 bg-gradient-to-l from-teal-500 to-cyan-500 text-white font-bold rounded-xl flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              {type === 'file' && !isEdit ? t('kb.upload') : isEdit ? t('common.save') : t('common.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==================== Delete Confirm Modal ====================
function DeleteConfirmModal({ isDark, item, type, onClose, onConfirm }) {
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
          <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('common.delete')} {type}</h3>
          <p className={`mb-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {t('kb.deleteConfirm').replace('{name}', item.name || `#${item.id}`)}
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