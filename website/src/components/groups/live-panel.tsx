'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';
import { useToast } from '@/components/ui/toast';
import { api, describeError } from '@/lib/api/client';
import { ApiError } from '@/lib/api/core';
import { LiveRoom, type RoomPeer } from '@/lib/groups/live-room';
import { isAdmin, type Group } from '@/lib/groups/types';

const PEER_LINE = { connecting: 'Connecting…', connected: 'Chanting', failed: 'Connection lost' } as const;

/** The group's room: who is chanting, and the buttons to start, join, mute and leave. */
export function LivePanel({ group, me, onChange }: { group: Group; me: string; onChange: () => void }) {
  const toast = useToast();
  const stage = useRef<HTMLDivElement>(null);
  const room = useRef<LiveRoom | null>(null);
  const [inRoom, setInRoom] = useState(false);
  const [busy, setBusy] = useState(false);
  const [muted, setMuted] = useState(false);
  const [peers, setPeers] = useState<RoomPeer[]>([]);

  const admin = isAdmin(group.myRole);
  const live = group.live;

  const close = useCallback(() => {
    room.current = null;
    setInRoom(false);
    setPeers([]);
    setMuted(false);
    onChange();
  }, [onChange]);

  // Leaving the page leaves the room.
  useEffect(() => () => void room.current?.leave(), []);

  async function enter(how: 'start' | 'join') {
    if (!stage.current || !navigator.mediaDevices?.getUserMedia) {
      toast('This browser cannot use a microphone here.');
      return;
    }
    setBusy(true);
    const next = new LiveRoom(group.id, me, { onPeers: setPeers, onClosed: close }, stage.current);
    try {
      await next.enter(how);
      room.current = next;
      setInRoom(true);
      onChange();
    } catch (failure) {
      if (failure instanceof DOMException && (failure.name === 'NotAllowedError' || failure.name === 'SecurityError')) {
        toast('Allow the microphone to chant together.');
      } else if (failure instanceof DOMException && failure.name === 'NotFoundError') {
        toast('No microphone was found.');
      } else if (failure instanceof ApiError && failure.status === 410) {
        toast('The room has just closed.');
        onChange();
      } else toast(describeError(failure));
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    await room.current?.leave();
    close();
  }

  async function end() {
    if (!window.confirm('End the chanting for everyone?')) return;
    try {
      await room.current?.leave();
      await api(`/groups/${group.id}/live/end`, { method: 'POST', auth: 'required' });
      close();
    } catch (failure) {
      toast(describeError(failure));
    }
  }

  const others = inRoom ? peers : (live?.participants.filter((p) => p.id !== me) ?? []).map((p) => ({ ...p, state: 'connected' as const }));

  return (
    <section className="card live-panel" aria-label="Chanting room">
      <div className="live-head">
        <h2 className="group-h2">
          {live || inRoom ? <><span className="live-badge"><i aria-hidden="true" /> Chanting now</span></> : 'Chanting room'}
        </h2>
      </div>

      {(live || inRoom) && (
        <ul className="member-list live-people">
          {inRoom && (
            <li className="member">
              <Avatar name="You" size={34} />
              <span className="member-name"><strong>You</strong><small className="muted">{muted ? 'Muted' : 'Chanting'}</small></span>
            </li>
          )}
          {others.map((person) => (
            <li key={person.id} className="member">
              <Avatar name={person.name} url={person.avatarUrl} size={34} />
              <span className="member-name"><strong>{person.name ?? 'Devotee'}</strong><small className="muted">{inRoom ? PEER_LINE[person.state] : 'In the room'}</small></span>
            </li>
          ))}
        </ul>
      )}

      {!live && !inRoom && <p className="muted">{admin ? 'Start the room and everyone in the group is told. Use headphones to avoid echo.' : 'Nobody is chanting right now. You will be told when an admin starts.'}</p>}

      <div className="live-actions">
        {!inRoom && live && <button className="btn btn-primary" disabled={busy} onClick={() => enter('join')}><Icon name="mic" size={18} /> Join the chanting</button>}
        {!inRoom && !live && admin && <button className="btn btn-primary" disabled={busy} onClick={() => enter('start')}><Icon name="mic" size={18} /> Start chanting together</button>}
        {inRoom && (
          <>
            <button className={muted ? 'btn btn-ghost is-on' : 'btn btn-ghost'} aria-pressed={muted} onClick={() => setMuted(room.current?.setMuted(!muted) ?? false)}>
              <Icon name={muted ? 'mute' : 'mic'} size={18} /> {muted ? 'Unmute' : 'Mute'}
            </button>
            <button className="btn btn-danger" onClick={leave}>Leave</button>
            {admin && <button className="btn btn-quiet" onClick={end}>End for everyone</button>}
          </>
        )}
      </div>

      {/* The remote voices play from here. */}
      <div ref={stage} className="live-stage" aria-hidden="true" />
    </section>
  );
}
