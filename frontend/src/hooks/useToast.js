import { useState, useCallback } from 'react';

/**
 * useToast — shared toast hook
 * Usage:
 *   const { toasts, showToast, ToastContainer } = useToast();
 *   showToast('تم الحفظ بنجاح', 'success');
 *   // In JSX: <ToastContainer />
 */
export default function useToast() {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'success', duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  function ToastContainer() {
    if (toasts.length === 0) return null;
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] space-y-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            onClick={() => dismissToast(toast.id)}
            className={`px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 cursor-pointer animate-[slideDown_0.3s_ease] ${
              toast.type === 'success' ? 'bg-emerald-500 text-white'
              : toast.type === 'error' ? 'bg-red-500 text-white'
              : toast.type === 'warning' ? 'bg-yellow-500 text-white'
              : 'bg-cyan-500 text-white'
            }`}
          >
            <span className="text-lg">
              {toast.type === 'success' ? '✓' : toast.type === 'error' ? '✗' : toast.type === 'warning' ? '⚠' : 'ℹ'}
            </span>
            {toast.message}
          </div>
        ))}
      </div>
    );
  }

  return { toasts, showToast, dismissToast, ToastContainer };
}
