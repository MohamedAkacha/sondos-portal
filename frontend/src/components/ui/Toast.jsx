// =====================================================
// Toast System — إشعارات مؤقتة
// ─────────────────────────────────────────────────────
// Zero dependency — uses React context + portal
// Usage: const { toast } = useToast();
//        toast.success('تم بنجاح');
//        toast.error('حدث خطأ');
// =====================================================
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const ICONS = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const STYLES = {
  success: 'border-emerald-500/25 bg-[#0a0a0b]/95 shadow-emerald-500/10',
  error:   'border-red-500/25 bg-[#0a0a0b]/95 shadow-red-500/10',
  warning: 'border-amber-500/25 bg-[#0a0a0b]/95 shadow-amber-500/10',
  info:    'border-teal-500/25 bg-[#0a0a0b]/95 shadow-teal-500/10',
};

const ICON_COLORS = {
  success: 'text-emerald-400',
  error:   'text-red-400',
  warning: 'text-amber-400',
  info:    'text-teal-400',
};

// ── Single Toast ──
function ToastItem({ toast: t, onRemove }) {
  const [exiting, setExiting] = useState(false);
  const Icon = ICONS[t.type] || ICONS.info;

  useEffect(() => {
    const dur = t.duration || 4000;
    const fadeTimer = setTimeout(() => setExiting(true), dur - 300);
    const removeTimer = setTimeout(() => onRemove(t.id), dur);
    return () => { clearTimeout(fadeTimer); clearTimeout(removeTimer); };
  }, [t.id, t.duration, onRemove]);

  return (
    <div
      role="alert"
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-xl max-w-sm w-full transition-all duration-300 ${
        STYLES[t.type] || STYLES.info
      } ${exiting ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`}
      style={{ animation: 'toast-in 0.3s ease-out' }}
    >
      <Icon className={`w-5 h-5 shrink-0 ${ICON_COLORS[t.type] || ICON_COLORS.info}`} />
      <p className="text-sm font-medium flex-1 text-gray-200">{t.message}</p>
      <button
        onClick={() => onRemove(t.id)}
        className="p-0.5 rounded text-gray-600 hover:text-gray-400 transition-colors shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── Provider ──
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((type, message, duration) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev.slice(-4), { id, type, message, duration }]); // max 5
    return id;
  }, []);

  const toast = {
    success: (msg, dur) => addToast('success', msg, dur),
    error:   (msg, dur) => addToast('error', msg, dur || 6000),
    warning: (msg, dur) => addToast('warning', msg, dur),
    info:    (msg, dur) => addToast('info', msg, dur),
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {typeof document !== 'undefined' && createPortal(
        <>
          {/* Keyframe injected once */}
          <style>{`@keyframes toast-in { from { opacity: 0; transform: translateY(12px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }`}</style>
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col-reverse gap-2 items-center pointer-events-none">
            {toasts.map(t => (
              <div key={t.id} className="pointer-events-auto">
                <ToastItem toast={t} onRemove={removeToast} />
              </div>
            ))}
          </div>
        </>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

// ── Hook ──
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
