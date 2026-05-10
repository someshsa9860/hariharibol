'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { Lock, Bell, Palette, Shield, Check, Monitor, Sun, Moon, Leaf, Waves, Flower2, Scroll } from 'lucide-react';
import { useThemeStore, THEMES, type ThemeKey } from '@/lib/theme-store';

/* ── Toggle ──────────────────────────────────────────────── */
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className="w-11 h-6 rounded-full relative transition-all duration-200 flex-shrink-0"
      style={{ background: checked ? 'var(--accent)' : 'var(--surface-2)', border: '1px solid var(--border-2)' }}>
      <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all duration-200"
        style={{ left: checked ? '22px' : '2px', boxShadow: '0 1px 4px rgba(0,0,0,0.4)' }} />
    </button>
  );
}

/* ── Section card ────────────────────────────────────────── */
function SectionCard({ icon: Icon, label, color, children }: {
  icon: any; label: string; color: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl overflow-hidden transition-all duration-300"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="px-6 py-4 flex items-center gap-3"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
          <Icon size={15} style={{ color }} />
        </div>
        <h2 className="font-bold text-sm" style={{ color: 'var(--text)' }}>{label}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

/* ── Divider ─────────────────────────────────────────────── */
function Divider() {
  return <div className="h-px" style={{ background: 'var(--border)' }} />;
}

/* ── Row ─────────────────────────────────────────────────── */
function Row({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6">
      <div>
        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{title}</p>
        {desc && <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{desc}</p>}
      </div>
      {children}
    </div>
  );
}

/* ── Theme icons ─────────────────────────────────────────── */
const THEME_ICONS: Record<ThemeKey, any> = {
  system:    Monitor,
  cosmic:    Moon,
  saffron:   Sun,
  midnight:  Moon,
  forest:    Leaf,
  ocean:     Waves,
  rose:      Flower2,
  light:     Sun,
  parchment: Scroll,
};

/* ── Theme card ──────────────────────────────────────────── */
function ThemeCard({ theme, active, onSelect }: {
  theme: typeof THEMES[number];
  active: boolean;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const Icon = THEME_ICONS[theme.key];

  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative w-full text-left rounded-2xl p-4 transition-all duration-200 group"
      style={{
        background: active ? `${theme.preview[1]}15` : hovered ? 'var(--surface-2)' : 'var(--surface)',
        border: active
          ? `1.5px solid ${theme.preview[1]}50`
          : `1px solid ${hovered ? 'var(--border-2)' : 'var(--border)'}`,
        transform: hovered && !active ? 'translateY(-1px)' : 'none',
        boxShadow: active ? `0 4px 20px ${theme.preview[1]}20` : 'none',
      }}
    >
      {/* Active check */}
      {active && (
        <div className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center"
          style={{ background: theme.preview[1] }}>
          <Check size={11} style={{ color: '#fff' }} />
        </div>
      )}

      {/* Colour swatches */}
      <div className="flex gap-1.5 mb-3">
        {theme.preview.map((c, i) => (
          <div key={i} className="rounded-md transition-all duration-200"
            style={{
              width: i === 0 ? 28 : 18,
              height: 28,
              background: c,
              boxShadow: active && i === 1 ? `0 0 8px ${c}60` : 'none',
            }} />
        ))}
        {/* Mini icon */}
        <div className="ml-auto w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${theme.preview[1]}20`, border: `1px solid ${theme.preview[1]}30` }}>
          <Icon size={13} style={{ color: theme.preview[1] }} />
        </div>
      </div>

      <p className="text-sm font-bold mb-0.5" style={{ color: active ? theme.preview[1] : 'var(--text)' }}>
        {theme.label}
      </p>
      <p className="text-[11px] leading-snug" style={{ color: 'var(--muted)' }}>{theme.desc}</p>
    </button>
  );
}

/* ── Page ────────────────────────────────────────────────── */
export default function SettingsPage() {
  const { themeKey, setTheme } = useThemeStore();
  const [notifyModeration, setNotifyModeration] = useState(true);
  const [notifyBans,       setNotifyBans]       = useState(true);
  const [saved,            setSaved]            = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  };

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <main className="flex-1 overflow-auto">

        {/* Header */}
        <header className="px-8 py-4 flex items-center justify-between sticky top-0 z-10"
          style={{ background: 'var(--header-bg)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(20px)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)' }}>
              <Shield size={15} style={{ color: 'var(--muted)' }} />
            </div>
            <div>
              <h1 className="text-xl font-black" style={{ color: 'var(--text)' }}>Settings</h1>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Platform configuration</p>
            </div>
          </div>

          <button onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300"
            style={{
              background: saved
                ? 'rgba(74,222,128,0.15)'
                : 'linear-gradient(135deg, var(--accent), var(--accent-2))',
              color: saved ? '#4ade80' : 'var(--bg)',
              border: saved ? '1px solid rgba(74,222,128,0.3)' : 'none',
              boxShadow: saved ? 'none' : '0 4px 15px var(--accent-glow)',
            }}>
            {saved ? <><Check size={14} /> Saved!</> : 'Save Changes'}
          </button>
        </header>

        <div className="p-8 max-w-3xl mx-auto space-y-5">

          {/* ── Appearance / Theme Picker ──────────────────── */}
          <SectionCard icon={Palette} label="Appearance & Theme" color="#a78bfa">
            <div className="space-y-6">

              {/* Theme grid */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>Choose Theme</p>
                  <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                    style={{ background: 'var(--surface-2)', color: 'var(--accent)', border: '1px solid var(--border-2)' }}>
                    {THEMES.find(t => t.key === themeKey)?.label ?? 'System'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {THEMES.map(theme => (
                    <ThemeCard
                      key={theme.key}
                      theme={theme}
                      active={themeKey === theme.key}
                      onSelect={() => setTheme(theme.key)}
                    />
                  ))}
                </div>

                {/* System note */}
                <div className="mt-4 flex items-start gap-2.5 px-4 py-3 rounded-xl"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <Monitor size={14} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--accent)' }} />
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
                    <span className="font-semibold" style={{ color: 'var(--text)' }}>System</span> automatically
                    switches between <span className="font-medium" style={{ color: 'var(--text)' }}>Cosmic (dark)</span> and{' '}
                    <span className="font-medium" style={{ color: 'var(--text)' }}>Light</span> based on your OS preference.
                    Changes apply instantly — no reload needed.
                  </p>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* ── Security ───────────────────────────────────── */}
          <SectionCard icon={Lock} label="Security" color="#60a5fa">
            <div className="space-y-5">
              <Row title="Two-Factor Authentication" desc="Add an extra layer of security to your account">
                <button className="px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 flex-shrink-0"
                  style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.25)', color: '#60a5fa' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(96,165,250,0.2)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(96,165,250,0.1)'; }}>
                  Enable 2FA
                </button>
              </Row>
              <Divider />
              <Row title="Change Password" desc="Update your admin account password">
                <button className="px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 flex-shrink-0"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface)'; filter: 'brightness(1.3)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}>
                  Change
                </button>
              </Row>
            </div>
          </SectionCard>

          {/* ── Notifications ──────────────────────────────── */}
          <SectionCard icon={Bell} label="Notifications" color="#fbbf24">
            <div className="space-y-5">
              <Row title="Moderation alerts" desc="Email when new items enter the moderation queue">
                <Toggle checked={notifyModeration} onChange={setNotifyModeration} />
              </Row>
              <Divider />
              <Row title="User ban alerts" desc="Notify when a user account is banned or unbanned">
                <Toggle checked={notifyBans} onChange={setNotifyBans} />
              </Row>
            </div>
          </SectionCard>

          <p className="text-center text-xs pb-4" style={{ color: 'var(--muted)', opacity: 0.5 }}>
            HariHariBol Admin · v1.0 · Theme preference is saved to local storage
          </p>
        </div>
      </main>
    </div>
  );
}
