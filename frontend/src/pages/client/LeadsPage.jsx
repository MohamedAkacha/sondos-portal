import { useState, useEffect, useRef } from "react";
import { 
  Search, Edit, Trash2, Eye, UserPlus,
  Users, UserCheck, Star, Ban, X, Loader2,
  AlertCircle, ChevronLeft, ChevronRight, Filter, ChevronDown,
  Play, Square
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import leadAPI from "@/services/api/leadAPI";
// v2: Compatibility wrappers
const _fetch = async (url, opts = {}) => { const token = localStorage.getItem('auth_token'); const res = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...opts.headers } }); return res.json(); };
const leadsAPI = {
  getAll: async (params = {}) => { const res = await leadAPI.getAll(params); const d = res.data?.data || {}; return { data: d.leads || [], total: d.total || 0, current_page: d.page || 1, last_page: d.totalPages || 1 }; },
  delete: async (id) => leadAPI.delete(id),
  update: async (id, data) => leadAPI.update(id, data),
  create: async (data) => leadAPI.create(data),
};
const campaignsAPI = {
  getAll: async () => { const d = await _fetch('/api/campaigns'); return { data: d.data || d.campaigns || [] }; },
  start: async (id) => _fetch(`/api/campaigns/${id}/start`, { method: 'POST' }),
  stop: async (id) => _fetch(`/api/campaigns/${id}/stop`, { method: 'POST' }),
};
const hasApiKey = () => true;

const formatValue = (value, key) => {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : '-';
  if (typeof value === 'object') {
    if (value.name) return value.name;
    return JSON.stringify(value);
  }
  if (key?.includes('_at') || key?.includes('date')) {
    try { return new Date(value).toLocaleDateString(); } catch { return value; }
  }
  return String(value);
};

const getPrimaryField = (lead) => {
  const nameFields = ['name', 'full_name', 'customer_name'];
  for (const field of nameFields) {
    if (lead[field]) return lead[field];
    if (lead.variables?.[field]) return lead.variables[field];
  }
  return lead.phone_number || lead.phone || `Lead #${lead.id}`;
};

const hiddenFields = ['id', 'variables', 'secondary_contacts', 'campaign_id'];

export default function LeadsPage() {
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [columns, setColumns] = useState([]);
  
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [showCampaignDropdown, setShowCampaignDropdown] = useState(false);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [campaignActionLoading, setCampaignActionLoading] = useState(false);
  
  const pagesCache = useRef({});
  const hasFetched = useRef(false);
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => { loadCampaigns(); }, []);
  useEffect(() => { if (!hasFetched.current) { hasFetched.current = true; loadLeads(); } }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
          buttonRef.current && !buttonRef.current.contains(event.target)) {
        setShowCampaignDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadCampaigns = async () => {
    setLoadingCampaigns(true);
    try {
      const response = await campaignsAPI.getAll();
      let campaignsData = response.data && Array.isArray(response.data) ? response.data : Array.isArray(response) ? response : [];
      setCampaigns(campaignsData);
    } catch (err) { console.error('Error loading campaigns:', err); }
    finally { setLoadingCampaigns(false); }
  };

  const getCacheKey = (page, campaignId) => `${campaignId || 'all'}_${page}`;

  const loadLeads = async (page = 1, forceRefresh = false, campaignId = selectedCampaign) => {
    const cacheKey = getCacheKey(page, campaignId);
    if (!forceRefresh && pagesCache.current[cacheKey]) {
      const cached = pagesCache.current[cacheKey];
      setLeads(cached.data); setLastPage(cached.lastPage); setTotal(cached.total); setCurrentPage(page);
      return;
    }
    setLoading(true); setError(null);
    try {
      const params = { page };
      if (campaignId) params.campaign_id = campaignId;
      const response = await leadsAPI.getAll(params);
      let leadsData = [], pageLastPage = 1, pageTotal = 0;
      if (response.data && Array.isArray(response.data)) {
        leadsData = response.data; pageLastPage = response.last_page || 1; pageTotal = response.total || response.data.length;
      } else if (Array.isArray(response)) { leadsData = response; pageTotal = response.length; }
      setLeads(leadsData); setCurrentPage(page); setLastPage(pageLastPage); setTotal(pageTotal);
      pagesCache.current[cacheKey] = { data: leadsData, lastPage: pageLastPage, total: pageTotal };
      if (leadsData.length > 0 && columns.length === 0) setColumns(detectColumns(leadsData));
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleCampaignChange = (campaignId) => {
    setSelectedCampaign(campaignId);
    setShowCampaignDropdown(false);
    setCurrentPage(1);
    loadLeads(1, false, campaignId);
  };

  const detectColumns = (data) => {
    const allKeys = new Set();
    data.forEach(item => {
      Object.keys(item).forEach(key => {
        if (!hiddenFields.includes(key) && item[key] !== null && item[key] !== undefined && typeof item[key] !== 'object') allKeys.add(key);
      });
    });
    const priority = ['phone_number', 'phone', 'email', 'status', 'city', 'company'];
    const sorted = [...allKeys].sort((a, b) => {
      const aIndex = priority.indexOf(a), bIndex = priority.indexOf(b);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return 0;
    });
    return sorted.slice(0, 4);
  };

  const goToNextPage = () => { if (currentPage < lastPage) loadLeads(currentPage + 1, false, selectedCampaign); };
  const goToPrevPage = () => { if (currentPage > 1) loadLeads(currentPage - 1, false, selectedCampaign); };

  const filteredLeads = leads.filter(lead => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return Object.values(lead).some(value => {
      if (typeof value === 'string') return value.toLowerCase().includes(query);
      if (typeof value === 'object' && value !== null) return Object.values(value).some(v => typeof v === 'string' && v.toLowerCase().includes(query));
      return false;
    });
  });

  const stats = {
    total: total,
    active: leads.filter(l => l.status === "active" || l.status === "completed").length,
    vip: leads.filter(l => l.status === "vip").length,
    blocked: leads.filter(l => l.status === "blocked" || l.status === "failed").length,
  };

  const handleView = (lead) => { setSelectedLead(lead); setShowViewModal(true); };
  const handleEdit = (lead) => { setSelectedLead(lead); setShowAddModal(true); };
  const handleDelete = (lead) => { setSelectedLead(lead); setShowDeleteConfirm(true); };

  const confirmDelete = async () => {
    try {
      await leadsAPI.delete(selectedLead.id);
      pagesCache.current = {};
      loadLeads(currentPage, true, selectedCampaign);
      setShowDeleteConfirm(false); setSelectedLead(null);
    } catch (err) { alert(err.message); }
  };

  const handleSave = async (leadData) => {
    try {
      if (selectedLead) await leadsAPI.update(selectedLead.id, leadData);
      else await leadsAPI.create(leadData);
      pagesCache.current = {};
      loadLeads(currentPage, true, selectedCampaign);
      setShowAddModal(false); setSelectedLead(null);
    } catch (err) { throw err; }
  };

  const getSelectedCampaignObj = () => campaigns.find(c => c.id === selectedCampaign);

  const handleCampaignAction = async (action) => {
    if (!selectedCampaign) return;
    setCampaignActionLoading(true);
    try {
      if (action === 'start') await campaignsAPI.start(selectedCampaign);
      else await campaignsAPI.stop(selectedCampaign);
      // Update local campaign status
      setCampaigns(prev => prev.map(c => 
        c.id === selectedCampaign ? { ...c, status: action === 'start' ? 'running' : 'stopped' } : c
      ));
    } catch (err) {
      setError(err.message || 'Failed to update campaign');
    } finally {
      setCampaignActionLoading(false);
    }
  };

  const getSelectedCampaignName = () => {
    if (!selectedCampaign) return t('lead.allCampaigns');
    const campaign = campaigns.find(c => c.id === selectedCampaign);
    return campaign?.name || t('lead.unknown');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('lead.title')}</h1>
          <p className={`mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('lead.subtitle')}</p>
        </div>
        <button onClick={() => { setSelectedLead(null); setShowAddModal(true); }} className="px-5 py-2.5 bg-gradient-to-l from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-teal-500/25">
          <UserPlus className="w-5 h-5" />
          {t('lead.addLead')}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={Users} label={t("lead.total")} value={stats.total} color="teal" isDark={isDark} />
        <StatCard icon={UserCheck} label={t("lead.active")} value={stats.active} color="emerald" isDark={isDark} />
        <StatCard icon={Star} label={t("lead.vip")} value={stats.vip} color="yellow" isDark={isDark} />
        <StatCard icon={Ban} label={t("lead.blocked")} value={stats.blocked} color="red" isDark={isDark} />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Campaign Filter */}
        <div className="relative">
          <button 
            ref={buttonRef}
            onClick={() => setShowCampaignDropdown(!showCampaignDropdown)} 
            className={`px-4 py-2.5 rounded-xl border flex items-center gap-2 min-w-[200px] justify-between ${isDark ? 'bg-[#111113] border-[#1f1f23] text-white hover:bg-[#1a1a1d]' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'} ${selectedCampaign ? 'ring-2 ring-teal-500/50' : ''}`}
          >
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-teal-500" />
              <span className="truncate">{getSelectedCampaignName()}</span>
            </div>
            <ChevronDown className={`w-4 h-4 transition-transform ${showCampaignDropdown ? 'rotate-180' : ''}`} />
          </button>
          
          {showCampaignDropdown && (
            <div 
              ref={dropdownRef}
              className={`absolute top-full left-0 mt-2 w-72 max-h-80 overflow-y-auto rounded-xl border shadow-2xl ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white border-gray-200'}`}
              style={{ zIndex: 9999 }}
            >
              <div 
                onClick={() => handleCampaignChange(null)} 
                className={`px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-teal-500/10 ${!selectedCampaign ? 'bg-teal-500/10 text-teal-500' : isDark ? 'text-white' : 'text-gray-900'}`}
              >
                <span>{t('lead.allCampaigns')}</span>
                {!selectedCampaign && <span className="text-teal-500">✓</span>}
              </div>
              <div className={`border-t ${isDark ? 'border-[#27272a]' : 'border-gray-200'}`} />
              {loadingCampaigns ? (
                <div className="flex items-center justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-teal-500" /></div>
              ) : campaigns.length === 0 ? (
                <div className={`px-4 py-3 text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t('lead.noCampaigns')}</div>
              ) : (
                campaigns.map(campaign => (
                  <div 
                    key={campaign.id} 
                    onClick={() => handleCampaignChange(campaign.id)} 
                    className={`px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-teal-500/10 ${selectedCampaign === campaign.id ? 'bg-teal-500/10 text-teal-500' : isDark ? 'text-white' : 'text-gray-900'}`}
                  >
                    <div className="flex flex-col">
                      <span className="truncate">{campaign.name}</span>
                      {campaign.status && <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{campaign.status}</span>}
                    </div>
                    {selectedCampaign === campaign.id && <span className="text-teal-500">✓</span>}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className={`absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
          <input type="text" placeholder={t("common.search")} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className={`w-full pl-4 pr-11 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-teal-500/50 ${isDark ? 'bg-[#111113] border-[#1f1f23] text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`} />
        </div>

        {/* Refresh */}
        <button onClick={() => loadLeads(currentPage, true, selectedCampaign)} disabled={loading} className={`px-4 py-2.5 rounded-xl border flex items-center gap-2 ${isDark ? 'bg-[#111113] border-[#1f1f23] text-white hover:bg-[#1a1a1d]' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
          <Loader2 className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>

        {/* Campaign Start/Stop */}
        {selectedCampaign && (() => {
          const camp = getSelectedCampaignObj();
          const isRunning = camp?.status === 'running' || camp?.status === 'active' || camp?.status === 'in_progress';
          return (
            <div className="flex items-center gap-2">
              {!isRunning ? (
                <button
                  onClick={() => handleCampaignAction('start')}
                  disabled={campaignActionLoading}
                  className="px-4 py-2.5 rounded-xl flex items-center gap-2 font-medium text-white bg-emerald-500 hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-50"
                >
                  {campaignActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  {t('lead.startCampaign')}
                </button>
              ) : (
                <button
                  onClick={() => handleCampaignAction('stop')}
                  disabled={campaignActionLoading}
                  className="px-4 py-2.5 rounded-xl flex items-center gap-2 font-medium text-white bg-red-500 hover:bg-red-400 transition-all shadow-lg shadow-red-500/25 disabled:opacity-50"
                >
                  {campaignActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
                  {t('lead.stopCampaign')}
                </button>
              )}
            </div>
          );
        })()}

        <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>{filteredLeads.length} {t('lead.leadsCount')}</span>
      </div>

      {/* Error */}
      {error && (
        <div className={`flex items-center gap-3 p-4 rounded-xl ${isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className={isDark ? 'text-red-400' : 'text-red-600'}>{error}</span>
        </div>
      )}

      {/* Table */}
      <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200'}`}>
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-teal-500' : 'text-teal-600'}`} /></div>
        ) : filteredLeads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Users className={`w-16 h-16 mb-4 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
            <p className={`text-lg font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('lead.noLeads')}</p>
            {selectedCampaign && <button onClick={() => handleCampaignChange(null)} className="mt-2 text-teal-500 hover:underline">{t('lead.showAll')}</button>}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className={`border-b ${isDark ? 'border-[#1f1f23]' : 'border-gray-200'}`}>
                <th className={`text-right px-6 py-4 text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t("lead.lead")}</th>
                {columns.map(col => (<th key={col} className={`text-right px-6 py-4 text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{col}</th>))}
                <th className={`text-right px-6 py-4 text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t("lead.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead) => (
                <tr key={lead.id} className={`border-b transition-colors ${isDark ? 'border-[#1f1f23]/50 hover:bg-[#1a1a1d]' : 'border-gray-100 hover:bg-gray-50'}`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-white font-bold">{getPrimaryField(lead).charAt(0)}</div>
                      <div>
                        <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{getPrimaryField(lead)}</p>
                        {lead.campaign?.name && <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{lead.campaign.name}</p>}
                      </div>
                    </div>
                  </td>
                  {columns.map(col => (<td key={col} className="px-6 py-4"><span className={isDark ? 'text-gray-300' : 'text-gray-600'} dir="ltr">{formatValue(lead[col], col)}</span></td>))}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleView(lead)} className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-[#222225]' : 'hover:bg-gray-100'}`}><Eye className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} /></button>
                      <button onClick={() => handleEdit(lead)} className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-[#222225]' : 'hover:bg-gray-100'}`}><Edit className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} /></button>
                      <button onClick={() => handleDelete(lead)} className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-red-500/20' : 'hover:bg-red-50'}`}><Trash2 className="w-4 h-4 text-red-500" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {lastPage > 1 && (
          <div className={`flex items-center justify-between px-6 py-4 border-t ${isDark ? 'border-[#1f1f23]' : 'border-gray-200'}`}>
            <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('lead.page')} {currentPage} {t('lead.of')} {lastPage}</span>
            <div className="flex items-center gap-2">
              <button onClick={goToPrevPage} disabled={currentPage === 1 || loading} className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${isDark ? 'hover:bg-[#1a1a1d]' : 'hover:bg-gray-100'}`}><ChevronRight className="w-5 h-5" /></button>
              <button onClick={goToNextPage} disabled={currentPage === lastPage || loading} className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${isDark ? 'hover:bg-[#1a1a1d]' : 'hover:bg-gray-100'}`}><ChevronLeft className="w-5 h-5" /></button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showViewModal && selectedLead && <DynamicViewModal isDark={isDark} lead={selectedLead} onClose={() => { setShowViewModal(false); setSelectedLead(null); }} />}
      {showAddModal && <DynamicEditModal isDark={isDark} lead={selectedLead} campaigns={campaigns} selectedCampaign={selectedCampaign} onClose={() => { setShowAddModal(false); setSelectedLead(null); }} onSave={handleSave} />}
      {showDeleteConfirm && <DeleteConfirmModal isDark={isDark} lead={selectedLead} onClose={() => { setShowDeleteConfirm(false); setSelectedLead(null); }} onConfirm={confirmDelete} />}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, isDark }) {
  const colors = { teal: 'bg-teal-500/10 text-teal-500', emerald: 'bg-emerald-500/10 text-emerald-500', yellow: 'bg-yellow-500/10 text-yellow-500', red: 'bg-red-500/10 text-red-500' };
  return (
    <div className={`rounded-xl p-4 border ${isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200'}`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[color]}`}><Icon className="w-5 h-5" /></div>
        <div>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{label}</p>
          <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{value}</p>
        </div>
      </div>
    </div>
  );
}

function DynamicViewModal({ isDark, lead, onClose }) {
  const { t } = useLanguage();
  const flattenObject = (obj, prefix = '') => {
    const result = [];
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (value !== null && value !== undefined) {
        if (typeof value === 'object' && !Array.isArray(value)) result.push(...flattenObject(value, fullKey));
        else result.push({ key: fullKey, value });
      }
    }
    return result;
  };
  const fields = flattenObject(lead);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className={`w-full max-w-lg max-h-[80vh] overflow-hidden rounded-2xl ${isDark ? 'bg-[#111113]' : 'bg-white'}`}>
        <div className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-[#1f1f23]' : 'border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-white text-xl font-bold">{getPrimaryField(lead).charAt(0)}</div>
            <div>
              <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{getPrimaryField(lead)}</h2>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>ID: {lead.id}</p>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 rounded-lg ${isDark ? 'hover:bg-[#1a1a1d]' : 'hover:bg-gray-100'}`}><X className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} /></button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-180px)]">
          <div className="space-y-3">
            {fields.map(({ key, value }) => (
              <div key={key} className={`p-3 rounded-xl ${isDark ? 'bg-[#0a0a0b]' : 'bg-gray-50'}`}>
                <p className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{key}</p>
                <p className={isDark ? 'text-white' : 'text-gray-900'} dir="ltr">{formatValue(value, key)}</p>
              </div>
            ))}
          </div>
        </div>
        <div className={`p-6 border-t ${isDark ? 'border-[#1f1f23]' : 'border-gray-200'}`}>
          <button onClick={onClose} className={`w-full py-3 rounded-xl font-medium ${isDark ? 'bg-[#1a1a1d] text-white hover:bg-[#222225]' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`}>{t('common.close')}</button>
        </div>
      </div>
    </div>
  );
}

function DynamicEditModal({ isDark, lead, campaigns, selectedCampaign, onClose, onSave }) {
  const { t } = useLanguage();
  const systemFields = ['id', 'created_at', 'updated_at', 'campaign', 'campaign_id', 'secondary_contacts'];
  const getEditableFields = () => {
    if (lead) return Object.entries(lead).filter(([key, value]) => !systemFields.includes(key) && typeof value !== 'object').map(([key, value]) => ({ key, value: value || '' }));
    return [{ key: 'phone_number', value: '' }, { key: 'name', value: '' }, { key: 'email', value: '' }];
  };

  const [fields, setFields] = useState(getEditableFields());
  const [campaignId, setCampaignId] = useState(lead?.campaign_id || selectedCampaign || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const updateField = (key, value) => setFields(prev => prev.map(f => f.key === key ? { ...f, value } : f));
  const addField = () => { const newKey = prompt(t('lead.newFieldName')); if (newKey && !fields.find(f => f.key === newKey)) setFields([...fields, { key: newKey, value: '' }]); };
  const removeField = (key) => setFields(fields.filter(f => f.key !== key));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const data = {};
      fields.forEach(({ key, value }) => { if (value) data[key] = value; });
      if (campaignId) data.campaign_id = campaignId;
      await onSave(data);
    } catch (err) { setError(err.message || "Error"); } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className={`w-full max-w-lg max-h-[80vh] overflow-hidden rounded-2xl ${isDark ? 'bg-[#111113]' : 'bg-white'}`}>
        <div className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-[#1f1f23]' : 'border-gray-200'}`}>
          <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{lead ? t('lead.editLead') : t('lead.addNewLead')}</h2>
          <button onClick={onClose} className={`p-2 rounded-lg ${isDark ? 'hover:bg-[#1a1a1d]' : 'hover:bg-gray-100'}`}><X className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6 overflow-y-auto max-h-[calc(80vh-200px)] space-y-4">
            {campaigns.length > 0 && (
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{t('lead.campaign')}</label>
                <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className={`w-full px-4 py-3 rounded-xl border ${isDark ? 'bg-[#0a0a0b] border-[#1f1f23] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}>
                  <option value="">{t('lead.selectCampaign')}</option>
                  {campaigns.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
              </div>
            )}
            {fields.map(({ key, value }) => (
              <div key={key}>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{key}</label>
                <div className="flex gap-2">
                  <input type={key.includes('email') ? 'email' : key.includes('phone') ? 'tel' : 'text'} value={value} onChange={(e) => updateField(key, e.target.value)} className={`flex-1 px-4 py-3 rounded-xl border ${isDark ? 'bg-[#0a0a0b] border-[#1f1f23] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`} dir="ltr" />
                  {!['phone_number', 'name', 'email'].includes(key) && (<button type="button" onClick={() => removeField(key)} className="p-3 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20"><X className="w-5 h-5" /></button>)}
                </div>
              </div>
            ))}
            <button type="button" onClick={addField} className={`w-full py-3 rounded-xl border-2 border-dashed ${isDark ? 'border-[#1f1f23] text-gray-400 hover:border-teal-500 hover:text-teal-500' : 'border-gray-200 text-gray-400 hover:border-teal-500 hover:text-teal-500'}`}>{t('lead.addField')}</button>
            {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">{error}</div>}
          </div>
          <div className={`flex gap-3 p-6 border-t ${isDark ? 'border-[#1f1f23]' : 'border-gray-200'}`}>
            <button type="button" onClick={onClose} className={`flex-1 py-3 rounded-xl font-medium ${isDark ? 'bg-[#1a1a1d] text-white' : 'bg-gray-100 text-gray-900'}`}>{t('common.cancel')}</button>
            <button type="submit" disabled={loading} className="flex-1 py-3 bg-gradient-to-l from-teal-500 to-cyan-500 text-white font-bold rounded-xl flex items-center justify-center gap-2">{loading && <Loader2 className="w-5 h-5 animate-spin" />}{lead ? t('common.save') : t('common.add')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirmModal({ isDark, lead, onClose, onConfirm }) {
  const { t } = useLanguage();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className={`w-full max-w-sm rounded-2xl p-6 ${isDark ? 'bg-[#111113]' : 'bg-white'}`}>
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center"><Trash2 className="w-8 h-8 text-red-500" /></div>
          <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('lead.deleteLead')}</h3>
          <p className={`mb-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('lead.deleteConfirm').replace('{name}', getPrimaryField(lead))}</p>
          <div className="flex gap-3">
            <button onClick={onClose} className={`flex-1 py-3 rounded-xl font-medium ${isDark ? 'bg-[#1a1a1d] text-white' : 'bg-gray-100 text-gray-900'}`}>{t('common.cancel')}</button>
            <button onClick={onConfirm} className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl">{t('common.delete')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}