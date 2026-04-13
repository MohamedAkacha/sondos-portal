import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

export default function Pagination({ page, totalPages, onChange, className = '' }) {
  const { isDark } = useTheme();
  if (totalPages <= 1) return null;
  const btnCls = `p-2 rounded-lg border disabled:opacity-30 transition ${isDark ? 'border-[#1f1f23] hover:bg-[#1a1a1d] text-gray-400' : 'border-gray-200 hover:bg-gray-50 text-gray-600'}`;
  return (
    <div className={`flex items-center justify-center gap-4 mt-6 ${className}`}>
      <button onClick={() => onChange(Math.max(1, page - 1))} disabled={page === 1} className={btnCls}><ChevronRight size={16} /></button>
      <span className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{page} / {totalPages}</span>
      <button onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page === totalPages} className={btnCls}><ChevronLeft size={16} /></button>
    </div>
  );
}
