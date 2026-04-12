import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/hooks/useLanguage';
import knowledgeAPI from '@/services/api/knowledgeAPI';
import { ArrowLeft, Upload, Link, HelpCircle, Trash2, Search, FileText, Globe, MessageCircle, Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';

const STATUS_ICONS = {
  pending: <Clock size={16} className="text-yellow-400" />,
  processing: <Loader2 size={16} className="text-blue-400 animate-spin" />,
  ready: <CheckCircle size={16} className="text-green-400" />,
  failed: <XCircle size={16} className="text-red-400" />,
};

const SOURCE_ICONS = {
  file: <FileText size={16} />,
  url: <Globe size={16} />,
  faq: <MessageCircle size={16} />,
  text: <FileText size={16} />,
};

export default function KnowledgeBasePage() {
  const { id } = useParams();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [base, setBase] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('documents');

  // FAQ form
  const [faqQuestion, setFaqQuestion] = useState('');
  const [faqAnswer, setFaqAnswer] = useState('');

  // URL form
  const [urlInput, setUrlInput] = useState('');

  // Search tester
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [baseRes, docsRes] = await Promise.all([
        knowledgeAPI.getBase(id),
        knowledgeAPI.getDocuments(id),
      ]);
      setBase(baseRes.data?.data);
      setDocuments(docsRes.data?.data || []);
    } catch (err) {
      console.error('Failed to load KB:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── File Upload ──
  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files?.length) return;

    setUploading(true);
    try {
      for (const file of files) {
        const res = await knowledgeAPI.uploadDocument(id, file);
        setDocuments(prev => [res.data?.data, ...prev]);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── Add URL ──
  const handleAddUrl = async () => {
    if (!urlInput.trim()) return;
    try {
      const res = await knowledgeAPI.addUrl(id, urlInput.trim());
      setDocuments(prev => [res.data?.data, ...prev]);
      setUrlInput('');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed');
    }
  };

  // ── Add FAQ ──
  const handleAddFaq = async () => {
    if (!faqQuestion.trim() || !faqAnswer.trim()) return;
    try {
      const res = await knowledgeAPI.addFaq(id, faqQuestion.trim(), faqAnswer.trim());
      setDocuments(prev => [res.data?.data, ...prev]);
      setFaqQuestion('');
      setFaqAnswer('');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed');
    }
  };

  // ── Delete Document ──
  const handleDeleteDoc = async (docId) => {
    if (!confirm(t('common.confirm'))) return;
    try {
      await knowledgeAPI.deleteDocument(docId);
      setDocuments(prev => prev.filter(d => d.id !== docId));
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  // ── Search ──
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await knowledgeAPI.search(searchQuery.trim(), 5);
      setSearchResults(res.data?.data || []);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setSearching(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-gray-400">{t('common.loading')}</div></div>;
  }

  if (!base) {
    return <div className="p-6 text-center text-gray-400">{t('knowledge.empty.title')}</div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/knowledge')} className="p-2 hover:bg-white/10 rounded-lg"><ArrowLeft size={20} /></button>
        <div>
          <h1 className="text-2xl font-bold">{base.name}</h1>
          {base.description && <p className="text-gray-400 text-sm">{base.description}</p>}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold">{base.totalDocuments}</div>
          <div className="text-sm text-gray-400">{t('knowledge.documents.title')}</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold">{base.totalChunks}</div>
          <div className="text-sm text-gray-400">{t('knowledge.documents.chunks', { count: base.totalChunks })}</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold">{base.totalTokens?.toLocaleString()}</div>
          <div className="text-sm text-gray-400">{t('knowledge.documents.tokens', { count: base.totalTokens })}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white/5 p-1 rounded-lg w-fit">
        {['documents', 'upload', 'url', 'faq', 'search'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === tab ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            {tab === 'documents' && t('knowledge.documents.title')}
            {tab === 'upload' && t('knowledge.documents.upload')}
            {tab === 'url' && t('knowledge.documents.addUrl')}
            {tab === 'faq' && t('knowledge.documents.addFaq')}
            {tab === 'search' && t('knowledge.search.title')}
          </button>
        ))}
      </div>

      {/* ═══ Documents List ═══ */}
      {activeTab === 'documents' && (
        <div className="space-y-3">
          {documents.length === 0 ? (
            <div className="text-center py-12 text-gray-500">{t('common.noData')}</div>
          ) : (
            documents.map(doc => (
              <div key={doc.id} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <span className="text-gray-400">{SOURCE_ICONS[doc.sourceType]}</span>
                  <div>
                    <div className="font-medium">{doc.fileName || doc.sourceUrl || doc.faqQuestion || 'Document'}</div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                      {STATUS_ICONS[doc.status]}
                      <span>{doc.status}</span>
                      {doc.totalChunks > 0 && <span>• {doc.totalChunks} chunks</span>}
                      {doc.fileSize > 0 && <span>• {(doc.fileSize / 1024).toFixed(0)} KB</span>}
                    </div>
                    {doc.errorMessage && <div className="text-xs text-red-400 mt-1">{doc.errorMessage}</div>}
                  </div>
                </div>
                <button onClick={() => handleDeleteDoc(doc.id)} className="p-2 hover:bg-red-500/20 rounded-lg"><Trash2 size={16} className="text-red-400" /></button>
              </div>
            ))
          )}
        </div>
      )}

      {/* ═══ File Upload ═══ */}
      {activeTab === 'upload' && (
        <div className="bg-white/5 border-2 border-dashed border-white/20 rounded-xl p-12 text-center">
          <Upload className="mx-auto mb-4 text-gray-400" size={48} />
          <p className="text-gray-300 mb-2">{t('knowledge.documents.dragDrop')}</p>
          <p className="text-gray-500 text-sm mb-6">{t('knowledge.documents.supportedFormats', { size: '10' })}</p>
          <input ref={fileInputRef} type="file" multiple accept=".pdf,.docx,.txt,.csv" onChange={handleFileUpload} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg transition">
            {uploading ? t('common.loading') : t('knowledge.documents.upload')}
          </button>
        </div>
      )}

      {/* ═══ Add URL ═══ */}
      {activeTab === 'url' && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <div className="flex gap-3">
            <input value={urlInput} onChange={e => setUrlInput(e.target.value)}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 focus:border-indigo-500 focus:outline-none"
              placeholder={t('knowledge.url.placeholder')} dir="ltr" />
            <button onClick={handleAddUrl} disabled={!urlInput.trim()}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg transition">
              {t('knowledge.url.crawl')}
            </button>
          </div>
        </div>
      )}

      {/* ═══ Add FAQ ═══ */}
      {activeTab === 'faq' && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">{t('knowledge.faq.question')}</label>
            <input value={faqQuestion} onChange={e => setFaqQuestion(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 focus:border-indigo-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">{t('knowledge.faq.answer')}</label>
            <textarea value={faqAnswer} onChange={e => setFaqAnswer(e.target.value)} rows={4}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 focus:border-indigo-500 focus:outline-none resize-none" />
          </div>
          <button onClick={handleAddFaq} disabled={!faqQuestion.trim() || !faqAnswer.trim()}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg transition">
            {t('knowledge.faq.add')}
          </button>
        </div>
      )}

      {/* ═══ Search Tester ═══ */}
      {activeTab === 'search' && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 focus:border-indigo-500 focus:outline-none"
              placeholder={t('knowledge.search.placeholder')} />
            <button onClick={handleSearch} disabled={searching || !searchQuery.trim()}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg transition">
              {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              {t('common.search')}
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-medium text-gray-300">{t('knowledge.search.results')} ({searchResults.length})</h3>
              {searchResults.map((result, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500">{t('knowledge.search.source')}: {result.source}</span>
                    <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded">
                      {t('knowledge.search.score')}: {(result.score * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-sm text-gray-300 leading-relaxed">{result.text}</p>
                </div>
              ))}
            </div>
          )}

          {searchResults.length === 0 && searchQuery && !searching && (
            <div className="text-center py-8 text-gray-500">{t('knowledge.search.noResults')}</div>
          )}
        </div>
      )}
    </div>
  );
}
