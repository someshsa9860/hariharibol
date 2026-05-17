'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Users, Plus, Clock, X } from 'lucide-react';
import api from '@/lib/api';
import TopBar from '@/components/TopBar';

type Group = {
  id: string;
  name: string;
  description?: string;
  sampradayaName?: string;
  memberCount: number;
  lastActivity?: string;
  isJoined?: boolean;
};

function timeAgo(iso?: string): string | null {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function GroupCard({
  group,
  onToggle,
}: {
  group: Group;
  onToggle: (id: string, joined: boolean) => void;
}) {
  const [toggling, setToggling] = useState(false);

  const handleJoinLeave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setToggling(true);
    try {
      if (group.isJoined) {
        await api.delete(`/groups/${group.id}/members`);
      } else {
        await api.post(`/groups/${group.id}/members`);
      }
      onToggle(group.id, !group.isJoined);
    } catch {}
    setToggling(false);
  };

  const ago = timeAgo(group.lastActivity);

  return (
    <Link href={`/groups/${group.id}`} style={{ textDecoration: 'none', display: 'block' }}>
      <div
        className="card-hover rounded-2xl p-4 mb-3"
        style={{ background: 'var(--surface)' }}
      >
        <div className="flex items-start gap-3">
          {/* Group icon */}
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: 'var(--gradient-sacred)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Users size={22} style={{ color: '#fff' }} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3
                  className="font-bold text-sm truncate"
                  style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}
                >
                  {group.name}
                </h3>
                {group.sampradayaName && (
                  <span
                    className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold mt-1"
                    style={{
                      background: 'rgba(0,107,107,0.12)',
                      color: 'var(--peacock)',
                      border: '1px solid rgba(0,107,107,0.18)',
                    }}
                  >
                    {group.sampradayaName}
                  </span>
                )}
              </div>

              <button
                onClick={handleJoinLeave}
                disabled={toggling}
                className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-full transition-all"
                style={{
                  background: group.isJoined ? 'var(--surface-2)' : 'var(--saffron)',
                  color: group.isJoined ? 'var(--muted)' : '#fff',
                  border: group.isJoined ? '1px solid var(--border-2)' : 'none',
                  opacity: toggling ? 0.55 : 1,
                  cursor: toggling ? 'not-allowed' : 'pointer',
                  minWidth: 58,
                }}
              >
                {group.isJoined ? 'Leave' : 'Join'}
              </button>
            </div>

            {group.description && (
              <p
                className="text-xs mt-1.5"
                style={{
                  color: 'var(--muted)',
                  lineHeight: 1.55,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {group.description}
              </p>
            )}

            <div className="flex items-center gap-3 mt-2">
              <span
                className="flex items-center gap-1 text-xs font-semibold"
                style={{ color: 'var(--peacock)' }}
              >
                <Users size={11} />
                {group.memberCount.toLocaleString()} members
              </span>
              {ago && (
                <span
                  className="flex items-center gap-1 text-xs"
                  style={{ color: 'var(--muted)' }}
                >
                  <Clock size={10} />
                  {ago}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div
      className="animate-pulse rounded-2xl p-4 mb-3"
      style={{ background: 'var(--surface)' }}
    >
      <div className="flex gap-3">
        <div
          className="rounded-xl flex-shrink-0"
          style={{ width: 48, height: 48, background: 'var(--surface-2)' }}
        />
        <div className="flex-1">
          <div className="h-4 rounded w-1/2 mb-2" style={{ background: 'var(--surface-2)' }} />
          <div className="h-3 rounded w-1/4 mb-3" style={{ background: 'var(--surface-2)' }} />
          <div className="h-3 rounded w-3/4" style={{ background: 'var(--surface-2)' }} />
        </div>
      </div>
    </div>
  );
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'joined'>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchGroups = useCallback(async () => {
    try {
      const r = await api.get('/groups?take=50');
      setGroups(r.data?.data || r.data || []);
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const handleToggle = (id: string, joined: boolean) => {
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, isJoined: joined } : g)));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const r = await api.post('/groups', { name: newName.trim() });
      setGroups((prev) => [{ ...r.data, memberCount: 1, isJoined: true }, ...prev]);
      setNewName('');
      setShowCreate(false);
    } catch {}
    setCreating(false);
  };

  const displayed = filter === 'joined' ? groups.filter((g) => g.isJoined) : groups;

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', paddingBottom: 88 }}>
      <TopBar title="Groups" />

      {/* Page header */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(0,107,107,0.13), rgba(45,90,39,0.16))',
          borderBottom: '1px solid var(--border)',
          padding: '20px 20px 22px',
        }}
      >
        <div
          className="flex items-center justify-between mb-4"
          style={{ maxWidth: 560, margin: '0 auto 16px' }}
        >
          <div>
            <h1
              style={{
                fontFamily: 'Playfair Display, serif',
                fontWeight: 700,
                fontSize: '1.4rem',
                color: 'var(--text)',
                lineHeight: 1.2,
              }}
            >
              Community
            </h1>
            <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 3 }}>
              Join groups, share wisdom, grow together
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-xl"
            style={{ background: 'var(--saffron)', color: '#fff', flexShrink: 0 }}
          >
            <Plus size={15} /> Create
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2" style={{ maxWidth: 560, margin: '0 auto' }}>
          {(['all', 'joined'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-5 py-1.5 rounded-full text-sm font-semibold transition-all"
              style={{
                background: filter === f ? 'var(--peacock)' : 'var(--surface-2)',
                color: filter === f ? '#fff' : 'var(--muted)',
                border: filter === f ? 'none' : '1px solid var(--border)',
              }}
            >
              {f === 'all' ? 'All Groups' : 'Joined'}
            </button>
          ))}
        </div>
      </div>

      {/* Create group modal */}
      {showCreate && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            background: 'rgba(0,0,0,0.52)',
          }}
          onClick={() => setShowCreate(false)}
        >
          <form
            onSubmit={handleCreate}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg)',
              borderRadius: 20,
              padding: '28px 24px',
              width: '100%',
              maxWidth: 400,
              border: '1px solid var(--border)',
              boxShadow: '0 24px 60px rgba(0,0,0,0.32)',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2
                style={{
                  fontFamily: 'Playfair Display, serif',
                  fontSize: '1.15rem',
                  fontWeight: 700,
                  color: 'var(--text)',
                }}
              >
                Create a Group
              </h2>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--muted)',
                  padding: 4,
                }}
              >
                <X size={18} />
              </button>
            </div>
            <input
              type="text"
              placeholder="Group name…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="input-field w-full mb-4"
              autoFocus
              maxLength={80}
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{
                  background: 'var(--surface-2)',
                  color: 'var(--muted)',
                  border: '1px solid var(--border)',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newName.trim() || creating}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                style={{
                  background: 'var(--saffron)',
                  color: '#fff',
                  opacity: !newName.trim() || creating ? 0.55 : 1,
                  cursor: !newName.trim() || creating ? 'not-allowed' : 'pointer',
                }}
              >
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Groups list */}
      <div className="p-4" style={{ maxWidth: 560, margin: '0 auto' }}>
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
        ) : displayed.length > 0 ? (
          displayed.map((g) => (
            <GroupCard key={g.id} group={g} onToggle={handleToggle} />
          ))
        ) : (
          <div className="text-center py-20" style={{ color: 'var(--muted)' }}>
            <Users
              size={42}
              className="mx-auto mb-4"
              style={{ opacity: 0.2, color: 'var(--peacock)' }}
            />
            <p
              className="font-bold text-base mb-1"
              style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}
            >
              {filter === 'joined' ? 'No joined groups yet' : 'No groups yet'}
            </p>
            <p className="text-sm">
              {filter === 'joined'
                ? 'Join a group to connect with devotees'
                : 'Be the first to create a spiritual community'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
