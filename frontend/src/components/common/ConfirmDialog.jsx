import { AlertTriangle, Loader2 } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useLanguage } from '@/hooks/useLanguage';
import { useState } from 'react';

export default function ConfirmDialog({ isOpen, onConfirm, onCancel, title, message, confirmLabel, danger = false }) {
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  if (!isOpen) return null;

  const handleConfirm = async () => {
    setLoading(true);
    try { await onConfirm(); } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCancel}>
      <div className={`w-full max-w-sm rounded-2xl p-6 ${isDark ? 'bg-[#111113] border border-[#1f1f23]' : 'bg-white border border-gray-200'}`} onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-4">
          <div className={`p-2 rounded-xl ${danger ? 'bg-red-500/10' : 'bg-yellow-500/10'}`}>
            <AlertTriangle size={20} className={danger ? 'text-red-400' : 'text-yellow-400'} />
          </div>
          <div>
            <h3 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>{title || t('common.confirm')}</h3>
            {message && <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{message}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3 mt-6">
          <button onClick={onCancel} disabled={loading} className={`flex-1 py-2.5 rounded-xl font-medium text-sm ${isDark ? 'bg-[#1a1a1d] text-white hover:bg-[#222225]' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`}>
            {t('common.cancel')}
          </button>
          <button onClick={handleConfirm} disabled={loading}
            className={`flex-1 py-2.5 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 ${danger ? 'bg-red-500 hover:bg-red-600' : 'bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400'}`}>
            {loading && <Loader2 size={14} className="animate-spin" />}
            {confirmLabel || t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
