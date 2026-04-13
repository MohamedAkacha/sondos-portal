import { X } from 'lucide-react';

// ═══════════════ Modal ═══════════════
export function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  if (!isOpen) return null;
  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className={`bg-[#1a1a2e] border border-white/10 rounded-xl w-full ${sizes[size]} mx-4 max-h-[85vh] flex flex-col`}
        onClick={e => e.stopPropagation()}>
        {title && (
          <div className="flex items-center justify-between p-5 border-b border-white/10">
            <h3 className="font-semibold text-lg">{title}</h3>
            <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition"><X size={18} /></button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

// ═══════════════ Tabs ═══════════════
export function Tabs({ tabs, activeTab, onChange, className = '' }) {
  return (
    <div className={`flex gap-1 bg-white/5 p-1 rounded-lg w-fit ${className}`}>
      {tabs.map(tab => (
        <button key={tab.key} onClick={() => onChange(tab.key)}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${
            activeTab === tab.key ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
          }`}>
          {tab.icon && <tab.icon size={14} className="inline me-1.5" />}
          {tab.label}
          {tab.count !== undefined && <span className="ms-1.5 text-xs opacity-70">({tab.count})</span>}
        </button>
      ))}
    </div>
  );
}

// ═══════════════ Badge ═══════════════
const BADGE_VARIANTS = {
  default: 'bg-gray-500/20 text-gray-400',
  primary: 'bg-indigo-500/20 text-indigo-400',
  success: 'bg-green-500/20 text-green-400',
  warning: 'bg-yellow-500/20 text-yellow-400',
  danger: 'bg-red-500/20 text-red-400',
  info: 'bg-blue-500/20 text-blue-400',
};

export function Badge({ children, variant = 'default', className = '' }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${BADGE_VARIANTS[variant]} ${className}`}>
      {children}
    </span>
  );
}

// ═══════════════ Switch ═══════════════
export function Switch({ checked, onChange, label, description, disabled = false }) {
  return (
    <label className={`flex items-center justify-between gap-3 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
      <div>
        {label && <div className="text-sm font-medium">{label}</div>}
        {description && <div className="text-xs text-gray-500 mt-0.5">{description}</div>}
      </div>
      <button type="button" role="switch" aria-checked={checked} disabled={disabled}
        onClick={() => !disabled && onChange?.(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-indigo-600' : 'bg-white/20'}`}>
        <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </label>
  );
}
