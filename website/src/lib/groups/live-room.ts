'use client';

// The audio room of a chanting group: WebRTC, browser to browser, one connection to each other person (a mesh — the
// server limits a room to eight). The API only records who is in the room and relays the handshake.
//
// Who offers: the person who just arrived offers to everyone already there; the others only answer. If two people
// arrive at once and offer to each other, "perfect negotiation" settles it — the one with the larger id is polite and
// rolls its own offer back.

import { api } from '@/lib/api/client';
import { onSocketEvent } from '@/lib/socket';
import type { Person, RoomInfo } from './types';

export type PeerState = 'connecting' | 'connected' | 'failed';

export interface RoomPeer extends Person {
  state: PeerState;
}

export interface RoomHandlers {
  /** The people in the room besides me, with how each connection is doing. */
  onPeers: (peers: RoomPeer[]) => void;
  /** The room closed (an admin ended it) or this person was dropped from it. */
  onClosed: () => void;
}

interface Signal {
  groupId: string;
  from: string;
  kind: 'offer' | 'answer' | 'candidate';
  data: Record<string, unknown>;
}

interface Peer {
  person: Person;
  pc: RTCPeerConnection;
  audio: HTMLAudioElement;
  state: PeerState;
  polite: boolean;
  makingOffer: boolean;
  queued: RTCIceCandidateInit[];
}

const HEARTBEAT_MS = 20_000;

export class LiveRoom {
  private peers = new Map<string, Peer>();
  /** Names learned from the room and from arrivals, so a peer made from a bare id still has one. */
  private known = new Map<string, Person>();
  private stream: MediaStream | null = null;
  private servers: RTCIceServer[] = [];
  private stops: (() => void)[] = [];
  private beat: ReturnType<typeof setInterval> | null = null;
  private over = false;

  constructor(
    private readonly groupId: string,
    private readonly me: string,
    private readonly handlers: RoomHandlers,
    /** Where the remote audio elements live. They must be in the document for some browsers to play them. */
    private readonly stage: HTMLElement,
  ) {}

  /** Asks for the microphone, enters the room (`start` for an admin opening it, `join` otherwise) and calls everyone in it. */
  async enter(how: 'start' | 'join'): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });

    let room: RoomInfo;
    try {
      room = await api<RoomInfo>(`/groups/${this.groupId}/live/${how}`, { method: 'POST', auth: 'required' });
    } catch (error) {
      this.release();
      throw error;
    }
    this.servers = room.iceServers;

    this.stops = [
      onSocketEvent('group.signal', (payload) => void this.onSignal(payload as Signal)),
      onSocketEvent('group.participant', (payload) => this.onParticipant(payload as { groupId: string; userId?: string; joined: boolean; person?: Person })),
      onSocketEvent('group.live', (payload) => {
        const live = payload as { groupId: string; live: boolean };
        if (live.groupId === this.groupId && !live.live) this.close(true);
      }),
      onSocketEvent('group.changed', (payload) => {
        const change = payload as { groupId: string; what: string };
        if (change.groupId === this.groupId && (change.what === 'removed' || change.what === 'deleted')) this.close(true);
      }),
    ];
    this.beat = setInterval(() => void this.heartbeat(), HEARTBEAT_MS);

    for (const person of room.participants) {
      this.known.set(person.id, person);
      this.peerFor(person.id, true);
    }
    this.publish();
  }

  /** Mutes or unmutes the microphone. Returns whether it is now muted. */
  setMuted(muted: boolean): boolean {
    this.stream?.getAudioTracks().forEach((track) => { track.enabled = !muted; });
    return muted;
  }

  /** Leaves the room and tells the server. */
  async leave(): Promise<void> {
    if (this.over) return;
    this.close(false);
    await api(`/groups/${this.groupId}/live/leave`, { method: 'POST', auth: 'required' }).catch(() => undefined);
  }

  private async heartbeat() {
    try {
      const status = await api<{ open: boolean; joined?: boolean }>(`/groups/${this.groupId}/live/heartbeat`, { method: 'POST', auth: 'required' });
      if (!status.open || status.joined === false) this.close(true);
    } catch {
      /* a lost connection is not the end of the room; the next beat tries again */
    }
  }

  private publish() {
    if (this.over) return;
    this.handlers.onPeers([...this.peers.values()].map(({ person, state }) => ({ ...person, state })));
  }

  private release() {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }

  private close(notify: boolean) {
    if (this.over) return;
    this.over = true;
    if (this.beat) clearInterval(this.beat);
    this.stops.forEach((stop) => stop());
    for (const peer of this.peers.values()) this.drop(peer);
    this.peers.clear();
    this.release();
    if (notify) this.handlers.onClosed();
  }

  private drop(peer: Peer) {
    peer.pc.close();
    peer.audio.srcObject = null;
    peer.audio.remove();
  }

  private send(to: string, kind: Signal['kind'], data: unknown) {
    return api(`/groups/${this.groupId}/live/signal`, { method: 'POST', auth: 'required', body: { to, kind, data } }).catch(() => undefined);
  }

  /**
   * The connection to one person, made when first needed. `offering`: I arrived after them, so I add my microphone now
   * and the offer follows. An answerer adds it once the offer is in (`onSignal`).
   */
  private peerFor(id: string, offering: boolean): Peer {
    const existing = this.peers.get(id);
    if (existing) return existing;

    const person = this.known.get(id) ?? { id, name: null, avatarUrl: null };
    const pc = new RTCPeerConnection({ iceServers: this.servers });
    const audio = document.createElement('audio');
    audio.autoplay = true;
    audio.setAttribute('playsinline', '');
    this.stage.appendChild(audio);

    const peer: Peer = { person, pc, audio, state: 'connecting', polite: this.me > id, makingOffer: false, queued: [] };
    this.peers.set(id, peer);

    pc.ontrack = ({ track, streams }) => {
      // Some browsers deliver the track without the stream it was sent in; the track is what matters.
      audio.srcObject = streams[0] ?? new MediaStream([track]);
      void audio.play().catch(() => undefined);
    };
    pc.onicecandidate = ({ candidate }) => { if (candidate) void this.send(id, 'candidate', candidate.toJSON()); };
    pc.onconnectionstatechange = () => {
      peer.state = pc.connectionState === 'connected' ? 'connected' : pc.connectionState === 'failed' ? 'failed' : 'connecting';
      if (pc.connectionState === 'failed') pc.restartIce();
      this.publish();
    };
    pc.onnegotiationneeded = async () => {
      try {
        peer.makingOffer = true;
        await pc.setLocalDescription();
        await this.send(id, 'offer', { sdp: pc.localDescription?.sdp });
      } finally {
        peer.makingOffer = false;
      }
    };

    if (offering) this.addMicrophone(peer);
    this.publish();
    return peer;
  }

  private addMicrophone(peer: Peer) {
    const stream = this.stream;
    if (!stream || peer.pc.getSenders().some((sender) => sender.track)) return;
    stream.getTracks().forEach((track) => peer.pc.addTrack(track, stream));
  }

  private onParticipant(event: { groupId: string; userId?: string; joined: boolean; person?: Person }) {
    if (event.groupId !== this.groupId) return;
    if (event.joined) {
      // They will offer to me; remember who they are for the list.
      if (event.person) {
        this.known.set(event.person.id, event.person);
        const peer = this.peers.get(event.person.id);
        if (peer) { peer.person = event.person; this.publish(); }
      }
      return;
    }
    if (!event.userId) return;
    const peer = this.peers.get(event.userId);
    if (!peer) return;
    this.drop(peer);
    this.peers.delete(event.userId);
    this.publish();
  }

  private async onSignal({ groupId, from, kind, data }: Signal) {
    if (groupId !== this.groupId || this.over) return;

    // A candidate can overtake its offer on the way; the peer is made now and the candidate waits for the offer.
    const peer = this.peerFor(from, false);
    const pc = peer.pc;

    if (kind === 'candidate') {
      const candidate = data as unknown as RTCIceCandidateInit;
      if (pc.remoteDescription) await pc.addIceCandidate(candidate).catch(() => undefined);
      else peer.queued.push(candidate);
      return;
    }

    const sdp = String(data.sdp ?? '');
    if (kind === 'offer') {
      const collision = peer.makingOffer || pc.signalingState !== 'stable';
      if (collision && !peer.polite) return;
      await pc.setRemoteDescription({ type: 'offer', sdp });
      this.addMicrophone(peer);
      await pc.setLocalDescription();
      await this.send(from, 'answer', { sdp: pc.localDescription?.sdp });
    } else if (pc.signalingState === 'have-local-offer') {
      await pc.setRemoteDescription({ type: 'answer', sdp });
    }

    for (const candidate of peer.queued.splice(0)) await pc.addIceCandidate(candidate).catch(() => undefined);
  }
}
