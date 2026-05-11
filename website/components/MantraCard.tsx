'use client';

import { Music2, Play } from 'lucide-react';

interface Mantra {
  id: string;
  name?: string;
  category?: string;
  text?: string;
  transliteration?: string;
  meaning?: string;
  audioUrl?: string;
}

export default function MantraCard({ mantra }: { mantra: Mantra }) {
  return (
    <div className="card-hover p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-bold text-base" style={{ color: 'var(--text)', fontFamily: 'Playfair Display, serif' }}>
            {mantra.name || 'Mantra'}
          </h3>
          {mantra.category && (
            <span className="badge text-xs mt-1 inline-block">{mantra.category}</span>
          )}
        </div>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--surface-2)' }}
        >
          <Music2 size={18} style={{ color: 'var(--accent)' }} />
        </div>
      </div>

      {mantra.text && (
        <p className="verse-sanskrit text-base mb-2 whitespace-pre-line">{mantra.text}</p>
      )}
      {mantra.transliteration && (
        <p className="verse-iast text-sm mb-2">{mantra.transliteration}</p>
      )}
      {mantra.meaning && (
        <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>{mantra.meaning}</p>
      )}

      {mantra.audioUrl && (
        <button
          className="mt-4 flex items-center gap-2 text-sm font-semibold"
          style={{ color: 'var(--accent)' }}
        >
          <Play size={14} fill="currentColor" /> Play Mantra
        </button>
      )}
    </div>
  );
}
