'use client';

import { useEffect, useState, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';
import {
  Lock, Bell, Palette, Shield, Check, Monitor, Sun, Moon, Leaf, Waves,
  Flower2, Scroll, Wand2, Eye, EyeOff, AlertCircle, Database, Upload,
  Server, CheckCircle, XCircle, Clock,
} from 'lucide-react';
import { useThemeStore, THEMES, type ThemeKey } from '@/lib/theme-store';

/* ── Types ─────────────────────────────────────────────── */
interface VodConfig {
  aiProvider: 'gemini' | 'openai' | 'none';
  apiKey?: string;
  autoGenerate: boolean;
  generateImage: boolean;
  autoGenerateTime?: string;
}

interface StorageConfig {
  provider: 'local' | 's3';
  s3Region?: string;
  s3Bucket?: string;
  s3CloudfrontUrl?: string;
}

interface SecurityConfig {
  sessionTimeoutMinutes: number;
  maxLoginAttempts: number;
}

interface FcmConfig {
  projectId?: string;
  serviceAccountJson?: string;
}

/* ── Small reusable components ──────────────────────────── */
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

function SectionCard({ icon: Icon, label, color, children }: {
  icon: React.ElementType; label: string; color: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
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

function Divider() {
  return <div className="h-px" style={{ background: 'var(--border)' }} />;
}

function Row({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{title}</p>
        {desc && <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{desc}</p>}
      </div>
      {children}
    </div>
  );
}

/* ── Theme helpers ──────────────────────────────────────── */
const THEME_ICONS: Record<ThemeKey, React.ElementType> = {
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

function ThemeCard({ theme, active, onSelect }: {
  theme: typeof THEMES[number]; active: boolean; onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const Icon = THEME_ICONS[theme.key];
  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative w-full text-left rounded-2xl p-4 transition-all duration-200"
      style={{
        background: active ? `${theme.preview[1]}15` : hovered ? 'var(--surface-2)' : 'var(--surface)',
        border: active ? `1.5px solid ${theme.preview[1]}50` : `1px solid ${hovered ? 'var(--border-2)' : 'var(--border)'}`,
        transform: hovered && !active ? 'translateY(-1px)' : 'none',
        boxShadow: active ? `0 4px 20px ${theme.preview[1]}20` : 'none',
      }}>
      {active && (
        <div className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center"
          style={{ background: theme.preview[1] }}>
          <Check size={11} style={{ color: '#fff' }} />
        </div>
      )}
      <div className="flex gap-1.5 mb-3">
        {theme.preview.map((c, i) => (
          <div key={i} className="rounded-md"
            style={{ width: i === 0 ? 28 : 18, height: 28, background: c, boxShadow: active && i === 1 ? `0 0 8px ${c}60` : 'none' }} />
        ))}
        <div className="ml-auto w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${theme.preview[1]}20`, border: `1px solid ${theme.preview[1]}30` }}>
          <Icon size={13} style={{ color: theme.preview[1] }} />
        </div>
      </div>
      <p className="text-sm font-bold mb-0.5" style={{ color: active ? theme.preview[1] : 'var(--text)' }}>{theme.label}</p>
      <p className="text-[11px] leading-snug" style={{ color: 'var(--muted)' }}>{theme.desc}</p>
    </button>
  );
}

/* ── Page ────────────────────────────────────────────────── */
export default function SettingsPage() {
  const { themeKey, setTheme } = useThemeStore();

  const [vodConfig,     setVodConfig]     = useState<VodConfig>({ aiProvider: 'none', autoGenerate: false, generateImage: false, autoGenerateTime: '06:00' });
  const [storageConfig, setStorageConfig] = useState<StorageConfig>({ provider: 'local' });
  const [securityConfig,setSecurityConfig]= useState<SecurityConfig>({ sessionTimeoutMinutes: 60, maxLoginAttempts: 5 });
  const [fcmConfig,     setFcmConfig]     = useState<FcmConfig>({});
  const [notifyModeration, setNotifyModeration] = useState(true);
  const [notifyBans,       setNotifyBans]       = useState(true);

  const [vodLoading,    setVodLoading]    = useState(true);
  const [showApiKey,    setShowApiKey]    = useState(false);
  const [testingConn,   setTestingConn]   = useState(false);
  const [connResult,    setConnResult]    = useState<'ok' | 'fail' | null>(null);

  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadAll = async () => {
      try {
        const [vodRes, settingsRes] = await Promise.allSettled([
          api.get('/verses/of-day/admin/config'),
          api.get('/admin/settings'),
        ]);
        if (vodRes.status === 'fulfilled') {
          const d = vodRes.value.data ?? {};
          setVodConfig({
            aiProvider:        d.aiProvider        ?? 'none',
            apiKey:            d.apiKey            ?? '',
            autoGenerate:      d.autoGenerate      ?? false,
            generateImage:     d.generateImage     ?? false,
            autoGenerateTime:  d.autoGenerateTime  ?? '06:00',
          });
        }
        if (settingsRes.status === 'fulfilled') {
          const s = settingsRes.value.data ?? {};
          if (s.storage)  setStorageConfig(s.storage);
          if (s.security) setSecurityConfig(s.security);
          if (s.fcm)      setFcmConfig(s.fcm);
        }
      } catch { } finally { setVodLoading(false); }
    };
    loadAll();
  }, []);

  const handleTestConnection = async () => {
    setTestingConn(true);
    setConnResult(null);
    try {
      await api.post('/verses/of-day/admin/test-connection', {
        provider: vodConfig.aiProvider,
        apiKey:   vodConfig.apiKey,
      });
      setConnResult('ok');
    } catch {
      setConnResult('fail');
    } finally {
      setTestingConn(false);
      setTimeout(() => setConnResult(null), 4000);
    }
  };

  const handleFcmFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        setFcmConfig(c => ({ ...c, serviceAccountJson: JSON.stringify(json), projectId: json.project_id }));
      } catch { }
    };
    reader.readAsText(file);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveErr('');
    try {
      await Promise.all([
        api.patch('/verses/of-day/admin/config', {
          aiProvider:       vodConfig.aiProvider,
          apiKey:           vodConfig.apiKey || undefined,
          autoGenerate:     vodConfig.autoGenerate,
          generateImage:    vodConfig.generateImage,
          autoGenerateTime: vodConfig.autoGenerateTime,
        }),
        api.patch('/admin/settings', {
          storage:  storageConfig,
          security: securityConfig,
          fcm:      fcmConfig,
        }).catch(() => {}),
      ]);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to save settings';
      setSaveErr(typeof msg === 'string' ? msg : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
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
          <div className="flex items-center gap-3">
            {saveErr && (
              <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl"
                style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}>
                <AlertCircle size={12} /> {saveErr}
              </div>
            )}
            <button
              onClick={handleSave}
              disabled={saving || vodLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 disabled:opacity-50"
              style={{
                background: saved
                  ? 'rgba(74,222,128,0.15)'
                  : 'linear-gradient(135deg, var(--accent), var(--accent-2))',
                color: saved ? '#4ade80' : 'var(--bg)',
                border: saved ? '1px solid rgba(74,222,128,0.3)' : 'none',
                boxShadow: saved ? 'none' : '0 4px 15px var(--accent-glow)',
              }}>
              {saving
                ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                : saved
                  ? <><Check size={14} /> Saved!</>
                  : 'Save Changes'}
            </button>
          </div>
        </header>

        <div className="p-8 max-w-3xl mx-auto space-y-5">

          {/* ── Appearance ────────────────────────────────── */}
          <SectionCard icon={Palette} label="Appearance & Theme" color="#a78bfa">
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
                  <ThemeCard key={theme.key} theme={theme} active={themeKey === theme.key} onSelect={() => setTheme(theme.key)} />
                ))}
              </div>
              <div className="mt-4 flex items-start gap-2.5 px-4 py-3 rounded-xl"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <Monitor size={14} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--accent)' }} />
                <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
                  <span className="font-semibold" style={{ color: 'var(--text)' }}>System</span> follows your OS dark/light mode.
                  Theme preference is saved locally — no reload needed.
                </p>
              </div>
            </div>
          </SectionCard>

          {/* ── AI Configuration ───────────────────────────── */}
          <SectionCard icon={Wand2} label="AI Configuration" color="#f59e0b">
            {vodLoading ? (
              <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="skeleton h-10 rounded-xl" />)}</div>
            ) : (
              <div className="space-y-5">
                <Row title="AI Provider" desc="Model used for verse selection and explanations">
                  <select
                    value={vodConfig.aiProvider}
                    onChange={e => setVodConfig(c => ({ ...c, aiProvider: e.target.value as VodConfig['aiProvider'] }))}
                    className="input-field text-sm py-1.5 px-3 rounded-xl"
                    style={{ minWidth: 150 }}>
                    <option value="none">None (manual only)</option>
                    <option value="gemini">Google Gemini</option>
                    <option value="openai">OpenAI GPT</option>
                  </select>
                </Row>

                {vodConfig.aiProvider !== 'none' && (
                  <>
                    <Divider />
                    <Row title="API Key" desc={`Your ${vodConfig.aiProvider === 'gemini' ? 'Google AI' : 'OpenAI'} API key`}>
                      <div className="flex items-center gap-2">
                        <div className="relative flex items-center" style={{ minWidth: 200 }}>
                          <input
                            type={showApiKey ? 'text' : 'password'}
                            value={vodConfig.apiKey ?? ''}
                            onChange={e => setVodConfig(c => ({ ...c, apiKey: e.target.value }))}
                            placeholder="sk-… or AI…"
                            className="input-field text-sm pr-9 w-full"
                          />
                          <button
                            type="button"
                            onClick={() => setShowApiKey(v => !v)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2"
                            style={{ color: 'var(--muted)' }}>
                            {showApiKey ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                        </div>
                        <button
                          onClick={handleTestConnection}
                          disabled={testingConn || !vodConfig.apiKey}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 flex-shrink-0 disabled:opacity-40"
                          style={{
                            background: connResult === 'ok'
                              ? 'rgba(74,222,128,0.12)'
                              : connResult === 'fail'
                                ? 'rgba(248,113,113,0.12)'
                                : 'var(--surface-2)',
                            border: connResult === 'ok'
                              ? '1px solid rgba(74,222,128,0.25)'
                              : connResult === 'fail'
                                ? '1px solid rgba(248,113,113,0.25)'
                                : '1px solid var(--border-2)',
                            color: connResult === 'ok' ? '#4ade80' : connResult === 'fail' ? '#f87171' : 'var(--text)',
                          }}>
                          {testingConn
                            ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                            : connResult === 'ok'
                              ? <CheckCircle size={12} />
                              : connResult === 'fail'
                                ? <XCircle size={12} />
                                : null}
                          {connResult === 'ok' ? 'Connected' : connResult === 'fail' ? 'Failed' : 'Test'}
                        </button>
                      </div>
                    </Row>
                  </>
                )}

                <Divider />
                <Row title="Auto-generate daily verse" desc="Automatically pick a new verse each day using AI">
                  <Toggle checked={vodConfig.autoGenerate} onChange={v => setVodConfig(c => ({ ...c, autoGenerate: v }))} />
                </Row>

                {vodConfig.autoGenerate && (
                  <>
                    <Divider />
                    <Row title="Daily generation time" desc="When to automatically generate (server local time)">
                      <div className="flex items-center gap-2">
                        <Clock size={13} style={{ color: 'var(--muted)' }} />
                        <input
                          type="time"
                          value={vodConfig.autoGenerateTime ?? '06:00'}
                          onChange={e => setVodConfig(c => ({ ...c, autoGenerateTime: e.target.value }))}
                          className="input-field text-sm py-1.5 px-3 rounded-xl"
                          style={{ minWidth: 110 }}
                        />
                      </div>
                    </Row>
                  </>
                )}

                <Divider />
                <Row title="Generate verse image" desc="Create AI artwork for each verse of the day">
                  <Toggle checked={vodConfig.generateImage} onChange={v => setVodConfig(c => ({ ...c, generateImage: v }))} />
                </Row>
              </div>
            )}
          </SectionCard>

          {/* ── Storage ────────────────────────────────────── */}
          <SectionCard icon={Database} label="Storage" color="#34d399">
            <div className="space-y-5">
              <Row title="Storage Provider" desc="Where uploaded files and generated images are stored">
                <select
                  value={storageConfig.provider}
                  onChange={e => setStorageConfig(c => ({ ...c, provider: e.target.value as 'local' | 's3' }))}
                  className="input-field text-sm py-1.5 px-3 rounded-xl"
                  style={{ minWidth: 140 }}>
                  <option value="local">Local Filesystem</option>
                  <option value="s3">Amazon S3</option>
                </select>
              </Row>

              {storageConfig.provider === 's3' && (
                <>
                  <Divider />
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted)' }}>
                        AWS Region
                      </label>
                      <input
                        type="text"
                        placeholder="us-east-1"
                        value={storageConfig.s3Region ?? ''}
                        onChange={e => setStorageConfig(c => ({ ...c, s3Region: e.target.value }))}
                        className="input-field text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted)' }}>
                        S3 Bucket Name
                      </label>
                      <input
                        type="text"
                        placeholder="my-hariharibol-bucket"
                        value={storageConfig.s3Bucket ?? ''}
                        onChange={e => setStorageConfig(c => ({ ...c, s3Bucket: e.target.value }))}
                        className="input-field text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted)' }}>
                        CloudFront URL <span className="normal-case font-normal">(optional CDN prefix)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="https://d1234.cloudfront.net"
                        value={storageConfig.s3CloudfrontUrl ?? ''}
                        onChange={e => setStorageConfig(c => ({ ...c, s3CloudfrontUrl: e.target.value }))}
                        className="input-field text-sm"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </SectionCard>

          {/* ── Notifications / FCM ────────────────────────── */}
          <SectionCard icon={Bell} label="Notifications & FCM" color="#fbbf24">
            <div className="space-y-5">
              <Row title="Moderation alerts" desc="Notify when new items enter the moderation queue">
                <Toggle checked={notifyModeration} onChange={setNotifyModeration} />
              </Row>
              <Divider />
              <Row title="User ban alerts" desc="Notify when a user is banned or unbanned">
                <Toggle checked={notifyBans} onChange={setNotifyBans} />
              </Row>
              <Divider />
              <div>
                <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>Firebase Service Account</p>
                <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
                  Upload your Firebase Admin SDK JSON to enable push notifications.
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}>
                    <Upload size={14} /> Upload serviceAccount.json
                  </button>
                  {fcmConfig.projectId && (
                    <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
                      style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)', color: '#4ade80' }}>
                      <CheckCircle size={11} /> {fcmConfig.projectId}
                    </span>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFcmFileUpload} />
                {fcmConfig.projectId && (
                  <div className="mt-3">
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted)' }}>
                      Firebase Project ID
                    </label>
                    <input
                      type="text"
                      value={fcmConfig.projectId}
                      onChange={e => setFcmConfig(c => ({ ...c, projectId: e.target.value }))}
                      className="input-field text-sm"
                      placeholder="my-firebase-project"
                    />
                  </div>
                )}
              </div>
            </div>
          </SectionCard>

          {/* ── Security ───────────────────────────────────── */}
          <SectionCard icon={Lock} label="Security" color="#60a5fa">
            <div className="space-y-5">
              <Row title="Session Timeout" desc="Automatically sign out after this many minutes of inactivity">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={5}
                    max={1440}
                    value={securityConfig.sessionTimeoutMinutes}
                    onChange={e => setSecurityConfig(c => ({ ...c, sessionTimeoutMinutes: Number(e.target.value) }))}
                    className="input-field text-sm py-1.5 px-3 rounded-xl text-right"
                    style={{ width: 80 }}
                  />
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>min</span>
                </div>
              </Row>
              <Divider />
              <Row title="Max Login Attempts" desc="Lock account after this many failed sign-in attempts">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={securityConfig.maxLoginAttempts}
                    onChange={e => setSecurityConfig(c => ({ ...c, maxLoginAttempts: Number(e.target.value) }))}
                    className="input-field text-sm py-1.5 px-3 rounded-xl text-right"
                    style={{ width: 70 }}
                  />
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>attempts</span>
                </div>
              </Row>
              <Divider />
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
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}>
                  Change
                </button>
              </Row>
            </div>
          </SectionCard>

          <p className="text-center text-xs pb-4" style={{ color: 'var(--muted)', opacity: 0.4 }}>
            HariHariBol Admin · v1.0 · Theme preference saved to local storage
          </p>
        </div>
      </main>
    </div>
  );
}
