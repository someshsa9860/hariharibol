'use client';

import { useState, useEffect, useRef } from 'react';
import { RotateCcw } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import TopBar from '@/components/TopBar';
import api from '@/lib/api';

const MALA_SIZE = 108;
const TARGETS = [108, 216, 432, 1008];

const MANTRAS = [
  { name: 'Hare Krishna', deity: '🦚', key: 'hare-krishna' },
  { name: 'Om Namah Shivaya', deity: '🔱', key: 'om-namah-shivaya' },
  { name: 'Gayatri Mantra', deity: '☀️', key: 'gayatri' },
  { name: 'Om Ganeshaya', deity: '🐘', key: 'om-ganeshaya' },
  { name: 'Om Namo Narayanaya', deity: '🪷', key: 'om-namo-narayanaya' },
];

// SVG ring dimensions
const R = 85;
const STROKE = 14;
const CX = R + STROKE / 2 + 2;
const SIZE = CX * 2;
const CIRC = 2 * Math.PI * R;
const INNER_D = (R - STROKE / 2) * 2 - 10;

export default function ChantingPage() {
  const { chantCount, incrementChant, resetChant } = useAppStore();
  const [target, setTarget] = useState(108);
  const [mantra, setMantra] = useState(MANTRAS[0]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [ripple, setRipple] = useState(false);
  const rippleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const malas = Math.floor(chantCount / MALA_SIZE);
  const beads = chantCount % MALA_SIZE;
  const progress = Math.min((chantCount / target) * 100, 100);
  const dashOffset = CIRC * (1 - progress / 100);

  useEffect(() => {
    api.get('/chanting/logs?take=10')
      .then(r => setSessions(r.data?.data || r.data || []))
      .catch(() => {});
  }, []);

  const handleTap = () => {
    incrementChant();
    setRipple(true);
    if (rippleRef.current) clearTimeout(rippleRef.current);
    rippleRef.current = setTimeout(() => setRipple(false), 420);
  };

  const handleReset = () => {
    if (chantCount > 0) {
      api.post('/chanting/logs', { count: chantCount, mantra: mantra.name }).catch(() => {});
    }
    resetChant();
  };

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <TopBar title="Japa Counter" />
      <div className="p-4 max-w-md mx-auto">

        {/* Mantra selector */}
        <div className="mb-6">
          <select
            value={mantra.key}
            onChange={e => setMantra(MANTRAS.find(m => m.key === e.target.value) || MANTRAS[0])}
            className="input-field w-full text-sm"
            style={{ color: 'var(--text)' }}
          >
            {MANTRAS.map(m => (
              <option key={m.key} value={m.key}>{m.deity} {m.name}</option>
            ))}
          </select>
        </div>

        {/* SVG progress ring + tap button */}
        <div className="flex flex-col items-center py-2">
          <div className="relative" style={{ width: SIZE, height: SIZE }}>
            <svg width={SIZE} height={SIZE} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
              {/* Maroon track */}
              <circle
                cx={CX} cy={CX} r={R}
                fill="none"
                stroke="#5C1A1A"
                strokeWidth={STROKE}
              />
              {/* Saffron progress arc */}
              <circle
                cx={CX} cy={CX} r={R}
                fill="none"
                stroke="#C75A1A"
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDasharray={CIRC}
                strokeDashoffset={dashOffset}
                style={{ transition: 'stroke-dashoffset 0.3s ease' }}
              />
            </svg>

            {/* Centre tap button */}
            <div className="absolute inset-0 flex items-center justify-center">
              <button
                onClick={handleTap}
                className="relative flex flex-col items-center justify-center rounded-full active:scale-95 transition-transform select-none"
                style={{
                  width: INNER_D,
                  height: INNER_D,
                  background: 'linear-gradient(135deg, #C75A1A 0%, #8B2FC9 100%)',
                  boxShadow: '0 0 0 4px #D4AF37, 0 8px 32px rgba(199,90,26,0.45)',
                }}
              >
                {/* Ripple */}
                {ripple && (
                  <span
                    className="absolute inset-0 rounded-full animate-ping"
                    style={{ background: 'rgba(199,90,26,0.35)', animationDuration: '420ms' }}
                  />
                )}
                {/* Om symbol */}
                <span
                  className="text-3xl leading-none"
                  style={{ color: 'rgba(255,255,255,0.85)', fontFamily: 'serif' }}
                >
                  ॐ
                </span>
                {/* Count */}
                <span
                  className="text-4xl font-black leading-none mt-1"
                  style={{ color: '#fff', fontFamily: 'Playfair Display, serif' }}
                >
                  {chantCount}
                </span>
              </button>
            </div>
          </div>

          {/* Mantra name */}
          <p
            className="text-sm font-semibold mt-4 mb-1"
            style={{ color: '#C75A1A', fontFamily: 'Playfair Display, serif' }}
          >
            {mantra.deity} {mantra.name}
          </p>
          <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>Tap the circle to count each chant</p>

          {/* Gold mala counter */}
          {malas > 0 && (
            <div
              className="px-4 py-2 rounded-full text-xs font-bold mb-2"
              style={{
                background: 'rgba(212,175,55,0.14)',
                color: '#D4AF37',
                border: '1px solid rgba(212,175,55,0.3)',
              }}
            >
              📿 {malas} mala{malas !== 1 ? 's' : ''} complete · {beads} beads
            </div>
          )}
        </div>

        {/* Reset */}
        <div className="flex justify-center my-4">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold"
            style={{ background: 'var(--surface-2)', color: 'var(--muted)', border: '1px solid var(--border)' }}
          >
            <RotateCcw size={12} /> Save & Reset
          </button>
        </div>

        {/* Target selector pills */}
        <div className="mb-6">
          <p className="text-xs font-semibold mb-3 text-center" style={{ color: 'var(--muted)' }}>
            Target: {target} · {Math.round(progress)}% complete
          </p>
          <div className="flex gap-2 justify-center">
            {TARGETS.map((t) => (
              <button
                key={t}
                onClick={() => setTarget(t)}
                className="px-4 py-2 rounded-full text-xs font-bold transition-all"
                style={{
                  background: target === t ? '#C75A1A' : 'var(--surface-2)',
                  color: target === t ? '#fff' : 'var(--muted)',
                  border: target === t ? 'none' : '1px solid var(--border)',
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Quick add */}
        <div className="grid grid-cols-4 gap-2 mb-8">
          {[8, 27, 54, 108].map((n) => (
            <button
              key={n}
              onClick={() => incrementChant(n)}
              className="py-3 rounded-xl text-sm font-bold transition-all"
              style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
            >
              +{n}
            </button>
          ))}
        </div>

        {/* Session history */}
        {sessions.length > 0 && (
          <div>
            <h3
              className="font-bold text-sm mb-3"
              style={{ color: 'var(--text)', fontFamily: 'Playfair Display, serif' }}
            >
              Recent Sessions
            </h3>
            <div className="space-y-2">
              {sessions.slice(0, 5).map((s: any, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-3 py-2 rounded-xl"
                  style={{ background: 'var(--surface)' }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                      {s.count || 0} chants
                    </span>
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>
                      {s.mantra || 'Hare Krishna'}
                    </span>
                  </div>
                  {s.createdAt && (
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0"
                      style={{ background: 'rgba(13,148,136,0.15)', color: '#0D9488' }}
                    >
                      {new Date(s.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
