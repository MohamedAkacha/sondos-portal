export default function SkeletonLoader({ lines = 3, className = '' }) {
  return (
    <div className={`animate-pulse space-y-3 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 bg-white/10 rounded" style={{ width: `${Math.random() * 40 + 60}%` }} />
      ))}
    </div>
  );
}

export function SkeletonCard({ count = 3 }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-5 animate-pulse">
          <div className="h-5 bg-white/10 rounded w-1/3 mb-3" />
          <div className="h-4 bg-white/10 rounded w-2/3 mb-2" />
          <div className="h-3 bg-white/10 rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="animate-pulse">
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-4 bg-white/10 rounded" />
        ))}
      </div>
      <div className="mt-4 space-y-3">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {Array.from({ length: cols }).map((_, c) => (
              <div key={c} className="h-4 bg-white/5 rounded" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
