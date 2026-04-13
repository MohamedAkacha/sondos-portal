import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

export default function SearchInput({ value = '', onChange, placeholder = 'بحث...', debounce = 300, className = '' }) {
  const [local, setLocal] = useState(value);
  const timerRef = useRef(null);

  useEffect(() => { setLocal(value); }, [value]);

  const handleChange = (val) => {
    setLocal(val);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange?.(val), debounce);
  };

  return (
    <div className={`relative ${className}`}>
      <Search size={16} className="absolute top-1/2 -translate-y-1/2 start-3 text-gray-500" />
      <input value={local} onChange={e => handleChange(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-lg ps-9 pe-9 py-2.5 text-sm focus:border-indigo-500 focus:outline-none"
        placeholder={placeholder} />
      {local && (
        <button onClick={() => handleChange('')} className="absolute top-1/2 -translate-y-1/2 end-3 text-gray-500 hover:text-white">
          <X size={14} />
        </button>
      )}
    </div>
  );
}
