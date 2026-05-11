export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="card p-5 space-y-3">
      <div className="skeleton h-40 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 14, width: `${80 - i * 15}%` }} />
      ))}
    </div>
  );
}

export function SkeletonVerse() {
  return (
    <div className="verse-card space-y-3">
      <div className="skeleton h-5 w-24" />
      <div className="skeleton h-7 w-full" />
      <div className="skeleton h-7 w-4/5" />
      <div className="skeleton h-4 w-full" />
      <div className="skeleton h-4 w-3/4" />
    </div>
  );
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}
