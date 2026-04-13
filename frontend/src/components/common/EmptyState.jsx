import { Inbox } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

export default function EmptyState({ icon: Icon = Inbox, title, description, actionLabel, onAction, className = '' }) {
  const { isDark } = useTheme();
  return (
    <div className={`text-center py-16 rounded-2xl border ${isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200'} ${className}`}>
      <Icon className={`mx-auto mb-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} size={48} />
      {title && <h3 className={`text-lg font-medium mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>{title}</h3>}
      {description && <p className={`mb-6 max-w-md mx-auto ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{description}</p>}
      {actionLabel && onAction && (
        <button onClick={onAction} className="px-5 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white font-bold rounded-xl transition">
          {actionLabel}
        </button>
      )}
    </div>
  );
}
