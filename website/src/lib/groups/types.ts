// The shapes of `/api/app/groups` (truth: backend/controllers/app/group.js).

export type GroupRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export interface Person {
  id: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface GroupMember extends Person {
  role: GroupRole;
  status: 'ACTIVE' | 'INVITED';
  joinedAt: string | null;
}

export interface LiveState {
  sessionId: string;
  startedAt: string;
  startedBy: string;
  participants: Person[];
}

export interface Group {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  mantra: { id: string; slug: string; name: string } | null;
  myRole: GroupRole;
  memberCount: number;
  live: LiveState | null;
  createdAt: string;
  members?: GroupMember[];
}

export interface Invitation {
  groupId: string;
  name: string;
  description: string | null;
  invitedBy: Person | null;
  invitedAt: string;
}

export interface GroupList {
  groups: Group[];
  invitations: Invitation[];
}

export interface RoomInfo {
  sessionId: string;
  iceServers: RTCIceServer[];
  participants: Person[];
  maxParticipants: number;
}

export const isAdmin = (role: GroupRole) => role === 'OWNER' || role === 'ADMIN';
