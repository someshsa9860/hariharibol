'use client';

import { useState, useEffect } from 'react';
import { RotateCcw, Plus, Minus } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import TopBar from '@/components/TopBar';
import api from '@/lib/api';

const MALA_SIZE = 108;
const MALAS_PRESETS = [1, 2, 4, 8, 16, 32, 64, 108];

export default function ChantingPage() {
  const { chantCount, incrementChant, resetChant } = useAppStore();
  const [target, setTarget] = useState(108);
  const [sessions, setSessions] = useState<any[]>([]);
  const malas = Math.floor(chantCount / MALA_SIZE);
  const beads = chantCount % MALA_SIZE;
  const progress = Math.min((chantCount / target) * 100, 100);

  useEffect(() => {
    api.get('/chanting/logs?take=10').then(r => setSessions(r.data?.data || r.data || [])).catch(() => {});
  }, []);

  const handleReset = () => {
    if (chantCount > 0) {
      api.post('/chanting/logs', { count: chantCount, mantra: 'Hare Krishna' }).catch(() => {});
    }
    resetChant();
  };

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <TopBar title="Japa Counter" />
      <div className="p-4 max-w-md mx-auto">
        {/* Counter ring */}
        <div className="flex flex-col items-center py-8">
          <div
            className="relative w-56 h-56 rounded-full flex flex-col items-center justify-center mb-6 cursor-pointer active:scale-95 transition-transform"
            style={{
              background: `conic-gradient(var(--accent) ${progress * 3.6}deg, var(--surface-2) 0deg)`,
              boxShadow: '0 0 40px var(--accent-glow)',
            }}
            onClick={() => incrementChant()}
          >
            <div className="absolute inset-3 rounded-full flex flex-col items-center justify-center"
              style={{ background: 'var(--bg)' }}>
              <span className="text-5xl font-black gradient-text">{chantCount}</span>
              <span className="text-xs mt-1" style={{ color: 'var(--muted)' }}>chants</span>
              {malas > 0 && (
                <span className="text-xs font-semibold mt-1" style={{ color: 'var(--accent-2)' }}>
                  {malas} mala{malas !== 1 ? 's' : ''} + {beads}
                </span>
              )}
            </div>
          </div>

          <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>Tap the circle to count each chant</p>

          {/* Controls */}
          <div className="flex items-center gap-4 mb-6">
            <button onClick={() => incrementChant(-1)} disabled={chantCount === 0}
              className="w-12 h-12 rounded-full flex items-center justify-center btn-secondary disabled:opacity-30">
              <Minus size={18} />
            </button>
            <button onClick={() => incrementChant()}
              className="w-16 h-16 rounded-full flex items-center justify-center btn-primary text-lg font-black">
              +1
            </button>
            <button onClick={handleReset}
              className="w-12 h-12 rounded-full flex items-center justify-center btn-ghost">
              <RotateCcw size={18} />
            </button>
          </div>

          {/* Target */}
          <div className="w-full">
            <p className="text-xs font-semibold mb-2 text-center" style={{ color: 'var(--muted)' }}>
              Target: {target} ({Math.round(progress)}% complete)
            </p>
            <div className="progress-bar rounded-full mb-4">
              <div className="progress-fill rounded-full" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {MALAS_PRESETS.map((t) => (
                <button key={t} onClick={() => setTarget(t)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                  style={{
                    background: target === t ? 'var(--accent)' : 'var(--surface-2)',
                    color: target === t ? '#fff' : 'var(--muted)',
                    border: '1px solid var(--border)',
                  }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Quick add */}
        <div className="grid grid-cols-4 gap-2 mb-8">
          {[8, 27, 54, 108].map((n) => (
            <button key={n} onClick={() => incrementChant(n)}
              className="py-3 rounded-xl text-sm font-bold transition-all"
              style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}>
              +{n}
            </button>
          ))}
        </div>

        {/* Recent sessions */}
        {sessions.length > 0 && (
          <div>
            <h3 className="font-bold text-sm mb-3" style={{ color: 'var(--text)' }}>Recent Sessions</h3>
            {sessions.slice(0, 5).map((s: any, i) => (
              <div key={i} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{s.count || 0} chants</span>
                <span className="text-xs" style={{ color: 'var(--muted)' }}>{s.mantra || 'Hare Krishna'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
