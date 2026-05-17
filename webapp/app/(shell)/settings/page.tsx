'use client';

import { useState, useEffect, useRef } from 'react';
import { User, Bell, Palette, Globe, Upload, Sun, Moon, Check } from 'lucide-react';
import api from '@/lib/api';
import TopBar from '@/components/TopBar';
import { useAppStore } from '@/lib/store';

// ─── Toast ─────────────────────────────────────────────────────────
function Toast({ message, visible }: { message: string; visible: boolean }) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 88,
        left: '50%',
        transform: 'translateX(-50%)',
        background: '#15803d',
        color: '#fff',
        padding: '10px 20px',
        borderRadius: 12,
        fontSize: 14,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        boxShadow: '0 8px 24px rgba(21,128,61,0.35)',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s ease',
        pointerEvents: 'none',
        zIndex: 200,
        whiteSpace: 'nowrap',
      }}
    >
      <Check size={16} /> {message}
    </div>
  );
}

// ─── Section card ──────────────────────────────────────────────────
function SettingsCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="card"
      style={{
        padding: '1.25rem 1.5rem',
        marginBottom: '1.25rem',
        background: 'var(--bg)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.25rem' }}>
        <span
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(199,90,26,0.12)',
            color: 'var(--saffron)',
            flexShrink: 0,
          }}
        >
          {icon}
        </span>
        <h2
          style={{
            fontFamily: '"Playfair Display", Georgia, serif',
            fontSize: '1.05rem',
            fontWeight: 700,
            color: 'var(--text)',
          }}
        >
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}

// ─── Toggle switch ─────────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      style={{
        position: 'relative',
        width: 46,
        height: 26,
        borderRadius: 13,
        background: checked ? 'var(--saffron)' : 'var(--border-2)',
        border: 'none',
        cursor: 'pointer',
        transition: 'background 0.2s',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: checked ? 22 : 3,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
          transition: 'left 0.2s',
        }}
      />
    </button>
  );
}

// ─── Font size picker ──────────────────────────────────────────────
function FontSizePicker({
  value,
  onChange,
}: {
  value: 'sm' | 'md' | 'lg';
  onChange: (v: 'sm' | 'md' | 'lg') => void;
}) {
  const options: { key: 'sm' | 'md' | 'lg'; label: string }[] = [
    { key: 'sm', label: 'Small' },
    { key: 'md', label: 'Medium' },
    { key: 'lg', label: 'Large' },
  ];
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          style={{
            padding: '7px 18px',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s',
            background: value === o.key ? 'var(--saffron)' : 'var(--surface-2)',
            color: value === o.key ? '#fff' : 'var(--muted)',
            border: `1.5px solid ${value === o.key ? 'var(--saffron)' : 'var(--border)'}`,
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Main settings page ────────────────────────────────────────────
export default function SettingsPage() {
  const { user, setUser, darkMode, toggleDark, fontSize, setFontSize } = useAppStore();

  // Account
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Notifications
  const [notifVerseOfDay, setNotifVerseOfDay] = useState(true);
  const [notifAnnouncements, setNotifAnnouncements] = useState(true);
  const [notifLoading, setNotifLoading] = useState(true);

  // Language
  const [languages, setLanguages] = useState<{ id: string; name: string; code?: string }[]>([]);
  const [selectedLang, setSelectedLang] = useState('');
  const [langLoading, setLangLoading] = useState(true);

  // Save states
  const [savingAccount, setSavingAccount] = useState(false);
  const [savingNotif, setSavingNotif] = useState(false);
  const [savingLang, setSavingLang] = useState(false);

  // Toast
  const [toast, setToast] = useState({ visible: false, message: '' });
  function showToast(message: string) {
    setToast({ visible: true, message });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3000);
  }

  useEffect(() => {
    api
      .get('/users/me/notification-preferences')
      .then((res) => {
        const d = res.data;
        setNotifVerseOfDay(d?.verseOfDay ?? true);
        setNotifAnnouncements(d?.announcements ?? true);
      })
      .catch(() => {})
      .finally(() => setNotifLoading(false));

    api
      .get('/languages')
      .then((res) => {
        const list = (res.data?.data ?? res.data) as { id: string; name: string; code?: string }[];
        setLanguages(Array.isArray(list) ? list : []);
      })
      .catch(() => {})
      .finally(() => setLangLoading(false));
  }, []);

  // ── Account save ────────────────────────────────────────────────
  async function handleSaveAccount() {
    setSavingAccount(true);
    try {
      const res = await api.patch('/users/me', { displayName: displayName.trim() });
      setUser({
        ...user!,
        displayName: displayName.trim(),
        avatarUrl: res.data?.avatarUrl || avatarUrl,
      });
      showToast('Account updated successfully');
    } catch {
      showToast('Failed to save account');
    } finally {
      setSavingAccount(false);
    }
  }

  // ── Avatar upload ────────────────────────────────────────────────
  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await api.post('/users/me/upload-avatar', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = res.data?.url || res.data?.avatarUrl;
      if (url) {
        setAvatarUrl(url);
        setUser({ ...user!, avatarUrl: url });
        showToast('Avatar updated');
      }
    } catch {
      showToast('Failed to upload avatar');
    } finally {
      setAvatarUploading(false);
    }
  }

  // ── Notification prefs save ──────────────────────────────────────
  async function handleSaveNotifications() {
    setSavingNotif(true);
    try {
      await api.patch('/users/me/notification-preferences', {
        verseOfDay: notifVerseOfDay,
        announcements: notifAnnouncements,
      });
      showToast('Notification preferences saved');
    } catch {
      showToast('Failed to save notification preferences');
    } finally {
      setSavingNotif(false);
    }
  }

  // ── Language save ────────────────────────────────────────────────
  async function handleSaveLanguage() {
    if (!selectedLang) return;
    setSavingLang(true);
    try {
      await api.patch('/users/me', { preferredLanguageId: selectedLang });
      showToast('Language preference saved');
    } catch {
      showToast('Failed to save language preference');
    } finally {
      setSavingLang(false);
    }
  }

  const initials = (user?.displayName || 'ॐ')
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <TopBar title="Settings" />

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '1.5rem 1rem 6rem' }}>

        {/* ── Account ───────────────────────────────────────────── */}
        <SettingsCard icon={<User size={18} />} title="Account">
          {/* Avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: '1.25rem' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              {avatarUrl || user?.avatarUrl ? (
                <img
                  src={avatarUrl || user?.avatarUrl}
                  alt="avatar"
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '3px solid var(--accent-2)',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    background: 'var(--gradient-gold)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: 20,
                    fontWeight: 700,
                    fontFamily: '"Playfair Display", Georgia, serif',
                    border: '3px solid var(--accent-2)',
                  }}
                >
                  {initials}
                </div>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: 'var(--saffron)',
                  border: '2px solid var(--bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: avatarUploading ? 'not-allowed' : 'pointer',
                  color: '#fff',
                  padding: 0,
                }}
              >
                <Upload size={11} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleAvatarChange}
              />
            </div>
            <div>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 3 }}>
                {avatarUploading ? 'Uploading…' : 'Click the icon to change your avatar'}
              </p>
              <p style={{ fontSize: 11, color: 'var(--muted)', opacity: 0.65 }}>
                JPG, PNG, or WebP · max 5 MB
              </p>
            </div>
          </div>

          {/* Display name */}
          <div style={{ marginBottom: '1rem' }}>
            <label
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-2)',
                display: 'block',
                marginBottom: 6,
              }}
            >
              Display Name
            </label>
            <input
              className="input-field"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your spiritual name"
            />
          </div>

          <button
            className="btn-primary"
            onClick={handleSaveAccount}
            disabled={savingAccount}
            style={{ fontSize: 13 }}
          >
            {savingAccount ? 'Saving…' : 'Save Account'}
          </button>
        </SettingsCard>

        {/* ── Notifications ──────────────────────────────────────── */}
        <SettingsCard icon={<Bell size={18} />} title="Notifications">
          {notifLoading ? (
            <div className="skeleton" style={{ height: 80, borderRadius: 10 }} />
          ) : (
            <>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1rem',
                }}
              >
                <div>
                  <p
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--text)',
                      marginBottom: 2,
                    }}
                  >
                    Daily Verse of the Day
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--muted)' }}>
                    Receive a sacred verse each morning
                  </p>
                </div>
                <Toggle checked={notifVerseOfDay} onChange={setNotifVerseOfDay} />
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1.125rem',
                }}
              >
                <div>
                  <p
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--text)',
                      marginBottom: 2,
                    }}
                  >
                    Announcements
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--muted)' }}>
                    Platform news and spiritual events
                  </p>
                </div>
                <Toggle checked={notifAnnouncements} onChange={setNotifAnnouncements} />
              </div>

              <button
                className="btn-primary"
                onClick={handleSaveNotifications}
                disabled={savingNotif}
                style={{ fontSize: 13 }}
              >
                {savingNotif ? 'Saving…' : 'Save Notifications'}
              </button>
            </>
          )}
        </SettingsCard>

        {/* ── Appearance ─────────────────────────────────────────── */}
        <SettingsCard
          icon={darkMode ? <Moon size={18} /> : <Sun size={18} />}
          title="Appearance"
        >
          {/* Dark mode toggle */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.375rem',
              paddingBottom: '1.25rem',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
                Dark Mode
              </p>
              <p style={{ fontSize: 12, color: 'var(--muted)' }}>
                Switch between light and dark themes
              </p>
            </div>
            <Toggle checked={darkMode} onChange={() => toggleDark()} />
          </div>

          {/* Font size */}
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
              Font Size
            </p>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
              Affects verse and content readability
            </p>
            <FontSizePicker
              value={fontSize}
              onChange={(v) => {
                setFontSize(v);
                showToast('Font size updated');
              }}
            />
          </div>
        </SettingsCard>

        {/* ── Language ───────────────────────────────────────────── */}
        <SettingsCard icon={<Globe size={18} />} title="Language">
          {langLoading ? (
            <div className="skeleton" style={{ height: 44, borderRadius: 10 }} />
          ) : (
            <>
              <div style={{ marginBottom: '1rem' }}>
                <label
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--text-2)',
                    display: 'block',
                    marginBottom: 6,
                  }}
                >
                  Preferred Language
                </label>
                <select
                  className="input-field"
                  value={selectedLang}
                  onChange={(e) => setSelectedLang(e.target.value)}
                  style={{ cursor: 'pointer' }}
                >
                  <option value="">Select a language…</option>
                  {languages.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                className="btn-primary"
                onClick={handleSaveLanguage}
                disabled={savingLang || !selectedLang}
                style={{ fontSize: 13 }}
              >
                {savingLang ? 'Saving…' : 'Save Language'}
              </button>
            </>
          )}
        </SettingsCard>
      </div>

      <Toast message={toast.message} visible={toast.visible} />
    </div>
  );
}
