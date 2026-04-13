import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import analyticsAPI from '@/services/api/analyticsAPI';
import { BarChart3, CheckCircle, XCircle, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

export default function ExtractionsPage() {
  const { t } = useLanguage(); const { isDark } = useTheme(); const navigate = useNavigate();
  const [extractions, setExtractions] = useState([]); const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true); const [page, setPage] = useState(1);

  useEffect(() => { loadData(); }, [page]);
  const loadData = async () => {
    try { setLoading(true); const res = await analyticsAPI.listExtractions({ page, limit: 20 });
      setExtractions(res.data?.data?.extractions || []); setTotal(res.data?.data?.total || 0);
    } catch(e) { console.error(e); } finally { setLoading(false); }
  };

  const card = isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200';
  const text = isDark ? 'text-white' : 'text-gray-900';
  const textSec = isDark ? 'text-gray-400' : 'text-gray-600';
  const textMuted = isDark ? 'text-gray-500' : 'text-gray-500';
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className={`text-2xl font-bold mb-6 ${text}`}>المتغيرات المستخرجة</h1>
      {loading ? <div className="text-center py-16"><Loader2 className={`animate-spin mx-auto ${textSec}`} size={32}/></div>
      : extractions.length === 0 ? (
        <div className={`text-center py-16 rounded-2xl border ${card}`}>
          <BarChart3 className={`mx-auto mb-4 ${textMuted}`} size={48}/>
          <h3 className={`text-lg font-medium mb-2 ${text}`}>لا توجد استخراجات بعد</h3>
          <p className={textMuted}>ستظهر هنا المتغيرات المستخرجة تلقائياً بعد كل مكالمة</p>
        </div>
      ) : (<>
        <div className="space-y-3">{extractions.map(ext => (
          <div key={ext.id} className={`rounded-2xl p-5 border ${card} cursor-pointer ${isDark?'hover:bg-[#1a1a1d]':'hover:bg-gray-50'}`}
            onClick={() => ext.callId && navigate(`/calls/${ext.callId}`)}>
            <div className="flex items-center justify-between mb-3">
              <div className={`text-sm ${textMuted}`}>{new Date(ext.createdAt).toLocaleString('ar-SA')}</div>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${ext.status==='completed'?'bg-emerald-500/10 text-emerald-400 border-emerald-500/20':'bg-red-500/10 text-red-400 border-red-500/20'}`}>{ext.status}</span>
            </div>
            {ext.variables && Object.keys(ext.variables).length > 0 && (
              <div className="grid grid-cols-3 gap-2">{Object.entries(ext.variables).map(([k,v]) => (
                <div key={k} className={`flex items-center gap-2 p-2 rounded-xl text-sm ${isDark?'bg-[#0a0a0b]':'bg-gray-50'}`}>
                  {v!=null ? <CheckCircle size={14} className="text-emerald-400 shrink-0"/> : <XCircle size={14} className={`${textMuted} shrink-0`}/>}
                  <span className={textMuted}>{k}:</span>
                  <span className={`font-medium truncate ${text}`}>{v!=null?String(v):'—'}</span>
                </div>
              ))}</div>
            )}
            <div className={`text-xs mt-2 ${textMuted}`}>ثقة: {Math.round((ext.confidence||0)*100)}%</div>
          </div>
        ))}</div>
        {totalPages > 1 && <div className="flex items-center justify-center gap-4 mt-6">
          <button onClick={() => setPage(p=>Math.max(1,p-1))} disabled={page===1} className={`p-2 rounded-lg border disabled:opacity-30 ${isDark?'border-[#1f1f23]':'border-gray-200'}`}><ChevronRight size={16}/></button>
          <span className={`text-sm ${textMuted}`}>{page} / {totalPages}</span>
          <button onClick={() => setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} className={`p-2 rounded-lg border disabled:opacity-30 ${isDark?'border-[#1f1f23]':'border-gray-200'}`}><ChevronLeft size={16}/></button>
        </div>}
      </>)}
    </div>
  );
}
