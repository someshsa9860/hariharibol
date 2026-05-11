import Link from 'next/link';
import { Users } from 'lucide-react';

interface Sampraday {
  id: string;
  slug?: string;
  name?: string;
  description?: string;
  followerCount?: number;
  thumbnailUrl?: string;
  heroImageUrl?: string;
}

export default function SampradayaCard({ s }: { s: Sampraday }) {
  return (
    <Link href={`/sampradayas/${s.id}`} className="card-hover block overflow-hidden group">
      {/* Hero image */}
      <div
        className="w-full h-36 flex items-center justify-center relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, var(--surface-2), var(--surface))' }}
      >
        {s.thumbnailUrl ? (
          <img src={s.thumbnailUrl} alt={s.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <span style={{ fontSize: '3rem', opacity: 0.4 }}>🪷</span>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-bold text-base mb-1" style={{ color: 'var(--text)', fontFamily: 'Playfair Display, serif' }}>
          {s.name || s.slug || 'Sampraday'}
        </h3>
        {s.description && (
          <p className="text-xs leading-relaxed line-clamp-2 mb-3" style={{ color: 'var(--muted)' }}>{s.description}</p>
        )}
        {s.followerCount != null && (
          <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--muted)' }}>
            <Users size={12} /> {s.followerCount.toLocaleString()} followers
          </div>
        )}
      </div>
    </Link>
  );
}
