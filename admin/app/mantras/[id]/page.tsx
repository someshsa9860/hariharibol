'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';
import { ArrowLeft, Save, Upload, Music } from 'lucide-react';

interface MantraDetail {
  id: string;
  name: string;
  nameHi?: string;
  nameSa?: string;
  sanskrit?: string;
  transliteration?: string;
  meaning?: string;
  meaningHi?: string;
  category?: string;
  deity?: string;
  audioUrl?: string;
  recommendationCount?: number;
  isPublic: boolean;
  isPublished?: boolean;
  sampradayId?: string;
  sampraday?: { id: string; nameKey: string };
}

interface Sampraday { id: string; nameKey: string; }

const CATEGORIES = ['Devotional', 'Meditation', 'Healing', 'Prosperity', 'Protection', 'Liberation', 'Invocation'];

function ToggleSwitch({ checked, onChange, label, subLabel, color = '#4ade80' }: {
  checked: boolean; onChange: (v: boolean) => void;
  label: string; subLabel?: string; color?: string;
}) {
  return (
    <div className="rounded-2xl px-5 py-4 flex items-center justify-between"
      style={{
        background: checked ? `${color}14` : 'var(--surface)',
        border: `1px solid ${checked ? `${color}33` : 'var(--border)'}`,
      }}>
      <div>
        <p className="text-sm font-semibold" style={{ color: checked ? color : 'var(--text)' }}>{label}</p>
        {subLabel && <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{subLabel}</p>}
      </div>
      <button type="button" onClick={() => onChange(!checked)}
        className="w-10 h-5 rounded-full relative transition-all duration-200 flex-shrink-0"
        style={{ background: checked ? color : 'var(--border-2)' }}>
        <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200"
          style={{ left: checked ? '22px' : '2px', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
      </button>
    </div>
  );
}

export default function MantraEditorPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const isNew = id === 'new';

  const [mantra, setMantra] = useState<MantraDetail>({
    id: '', name: '', isPublic: true,
  });
  const [sampradayas, setSampradayas] = useState<Sampraday[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const audioRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSampradayas();
    if (!isNew) fetchMantra();
  }, [id]);

  const fetchSampradayas = async () => {
    try {
      const r = await api.get('/sampradayas');
      setSampradayas(Array.isArray(r.data) ? r.data : r.data?.data || []);
    } catch { }
  };

  const fetchMantra = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/mantras/${id}`);
      setMantra(r.data);
    } catch { } finally { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { id: _, sampraday: __, audioUrl: ___, ...body } = mantra as any;
      let savedId = id;
      if (isNew) {
        const r = await api.post('/mantras', body);
        savedId = r.data?.id || r.data?.data?.id;
      } else {
        await api.patch(`/mantras/${id}`, body);
      }
      if (audioFile && savedId) {
        const fd = new FormData();
        fd.append('file', audioFile);
        await api.post(`/mantras/${savedId}/upload-audio`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      if (isNew) router.push(`/mantras/${savedId}`);
    } catch { } finally { setSaving(false); }
  };

  const update = (key: keyof MantraDetail, val: string | boolean | number) =>
    setMantra(m => ({ ...m, [key]: val }));

  if (loading) {
    return (
      <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="space-y-4 max-w-4xl mx-auto">
            {[1,2,3,4].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <header className="px-8 py-4 flex items-center justify-between sticky top-0 z-10"
          style={{ background: 'var(--header-bg)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(20px)' }}>
          <div className="flex items-center gap-3">
            <Link href="/mantras"
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--muted)' }}>
              <ArrowLeft size={14} />
            </Link>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)' }}>
              <Music size={15} style={{ color: '#fbbf24' }} />
            </div>
            <div>
              <h1 className="text-xl font-black text-theme">{isNew ? 'New Mantra' : (mantra.name || 'Edit Mantra')}</h1>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                {isNew ? 'Create a new mantra' : 'Edit mantra details'}
              </p>
            </div>
          </div>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', color: 'var(--bg)', boxShadow: '0 4px 15px var(--accent-glow)' }}>
            <Save size={14} />
            {saving ? 'Saving…' : 'Save Mantra'}
          </button>
        </header>

        <div className="p-8 max-w-4xl mx-auto space-y-6">

          {/* Names & Sampraday */}
          <div className="rounded-2xl p-6 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h2 className="font-bold text-theme text-sm">Basic Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>Name (English) *</label>
                <input value={mantra.name} onChange={e => update('name', e.target.value)}
                  className="input-field" placeholder="Mantra name in English" required />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>Name (Hindi)</label>
                <input value={mantra.nameHi || ''} onChange={e => update('nameHi', e.target.value)}
                  className="input-field" placeholder="हिंदी में नाम" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>Name (Sanskrit)</label>
                <input value={mantra.nameSa || ''} onChange={e => update('nameSa', e.target.value)}
                  className="input-field" placeholder="संस्कृत में नाम" style={{ fontFamily: 'serif' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>Sampraday</label>
                <select value={mantra.sampradayId || ''} onChange={e => update('sampradayId', e.target.value)}
                  className="select-field">
                  <option value="">No Sampraday</option>
                  {sampradayas.map(s => (
                    <option key={s.id} value={s.id}>{s.nameKey}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Sanskrit content */}
          <div className="rounded-2xl p-6 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h2 className="font-bold text-theme text-sm">Sanskrit Text</h2>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>Sanskrit</label>
              <textarea value={mantra.sanskrit || ''} onChange={e => update('sanskrit', e.target.value)}
                rows={4} className="input-field" style={{ fontFamily: 'serif', fontSize: '16px' }}
                placeholder="Sanskrit mantra text…" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>Transliteration</label>
              <textarea value={mantra.transliteration || ''} onChange={e => update('transliteration', e.target.value)}
                rows={3} className="input-field" placeholder="IAST transliteration…" />
            </div>
          </div>

          {/* Meaning */}
          <div className="rounded-2xl p-6 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h2 className="font-bold text-theme text-sm">Meaning</h2>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>Meaning (English)</label>
              <textarea value={mantra.meaning || ''} onChange={e => update('meaning', e.target.value)}
                rows={3} className="input-field" placeholder="English meaning and explanation…" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>Meaning (Hindi)</label>
              <textarea value={mantra.meaningHi || ''} onChange={e => update('meaningHi', e.target.value)}
                rows={3} className="input-field" placeholder="हिंदी में अर्थ…" />
            </div>
          </div>

          {/* Meta */}
          <div className="rounded-2xl p-6 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h2 className="font-bold text-theme text-sm">Classification</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>Category</label>
                <select value={mantra.category || ''} onChange={e => update('category', e.target.value)} className="select-field">
                  <option value="">Select category</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>Deity</label>
                <input value={mantra.deity || ''} onChange={e => update('deity', e.target.value)}
                  className="input-field" placeholder="e.g. Vishnu, Shiva, Devi" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>Recommendation Count</label>
                <input type="number" min={0} value={mantra.recommendationCount ?? 0}
                  onChange={e => update('recommendationCount', parseInt(e.target.value) || 0)}
                  className="input-field" />
              </div>
            </div>
          </div>

          {/* Audio upload */}
          <div className="rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h2 className="font-bold text-theme text-sm mb-4">Audio</h2>
            {mantra.audioUrl && (
              <div className="mb-4">
                <audio controls src={mantra.audioUrl} className="w-full rounded-lg" />
              </div>
            )}
            <button type="button" onClick={() => audioRef.current?.click()}
              className="flex items-center gap-2 px-4 py-3 rounded-xl w-full text-sm font-semibold transition-all duration-200"
              style={{ background: 'var(--surface-2)', border: '1.5px dashed var(--border-2)', color: 'var(--muted)' }}>
              <Upload size={14} />
              {audioFile ? audioFile.name : 'Click to upload audio file (MP3, WAV)'}
            </button>
            <input ref={audioRef} type="file" accept="audio/*" className="hidden"
              onChange={e => e.target.files && setAudioFile(e.target.files[0])} />
          </div>

          {/* Toggles */}
          <div className="space-y-3">
            <ToggleSwitch
              checked={mantra.isPublic}
              onChange={v => update('isPublic', v)}
              label={mantra.isPublic ? 'Public' : 'Private'}
              subLabel={mantra.isPublic ? 'Visible to all users' : 'Restricted access'}
              color="#4ade80"
            />
            <ToggleSwitch
              checked={mantra.isPublished || false}
              onChange={v => update('isPublished', v)}
              label={mantra.isPublished ? 'Published' : 'Draft'}
              subLabel={mantra.isPublished ? 'Live on the platform' : 'Not visible to users'}
              color="#60a5fa"
            />
          </div>
        </div>
      </main>
    </div>
  );
}
