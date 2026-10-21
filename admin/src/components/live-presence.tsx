import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Radio } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useResource } from '@/lib/use-resource';
import { useOnReconnect, useSocketEvent, useSocketStatus } from '@/lib/socket';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type Person = { id: string; name: string | null; email: string; avatarUrl: string | null; seenAt?: number };
type Live = { online: number; last15m: number; lastHour: number; people: Person[]; at: number };
type Update = { online: number; last15m: number; lastHour: number; sockets: number; joined: Person[]; left: Person[]; at: number };
type FeedItem = { key: string; kind: 'joined' | 'left'; person: Person; at: number };

const ago = (ms: number) => {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  return `${Math.round(s / 60)} min ago`;
};

/**
 * People using the app right now, updated live. The first numbers come from `/system/live`; after that the server
 * pushes `presence.update` every time someone appears or goes quiet (and every twenty seconds regardless), so the
 * count and the "who" list move without a refresh. If the socket is down, the numbers are polled instead.
 */
export function LivePresence() {
  const queryClient = useQueryClient();
  const socket = useSocketStatus();
  const live = useResource<Live>(['presence-live'], '/api/admin/system/live', undefined, {
    refetchInterval: socket === 'live' ? false : 15_000,
  });
  const [update, setUpdate] = useState<Update | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const seq = useRef(0);

  useSocketEvent<Update>('presence.update', (u) => {
    setUpdate(u);
    const items: FeedItem[] = [
      ...u.joined.map((person) => ({ key: `j${seq.current++}`, kind: 'joined' as const, person, at: u.at })),
      ...u.left.map((person) => ({ key: `l${seq.current++}`, kind: 'left' as const, person, at: u.at })),
    ];
    if (items.length) setFeed((f) => [...items, ...f].slice(0, 30));
    // Someone new appeared: the list of names comes from the server, so ask for it once.
    if (u.joined.length) void queryClient.invalidateQueries({ queryKey: ['presence-live'] });
  });
  useOnReconnect(useCallback(() => void queryClient.invalidateQueries({ queryKey: ['presence-live'] }), [queryClient]));

  const numbers = update ?? live.data;
  const people = live.data?.people ?? [];

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className={`absolute inline-flex h-full w-full rounded-full ${socket === 'live' ? 'animate-ping bg-emerald-400/70' : ''}`} />
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${socket === 'live' ? 'bg-emerald-500' : 'bg-muted-foreground/50'}`} />
          </span>
          Live now
        </CardTitle>
        <Badge variant={socket === 'live' ? 'success' : 'secondary'} className="gap-1"><Radio className="h-3 w-3" />{socket === 'live' ? 'Live' : socket === 'connecting' ? 'Connecting' : 'Polling'}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {!numbers ? <Skeleton className="h-16 w-full" /> : (
          <div className="grid grid-cols-3 gap-3 text-center">
            <div><p className="text-3xl font-semibold tabular-nums">{numbers.online}</p><p className="text-xs text-muted-foreground">online (5 min)</p></div>
            <div><p className="text-xl font-semibold tabular-nums">{numbers.last15m}</p><p className="text-xs text-muted-foreground">last 15 min</p></div>
            <div><p className="text-xl font-semibold tabular-nums">{numbers.lastHour}</p><p className="text-xs text-muted-foreground">last hour</p></div>
          </div>
        )}
        {update && <p className="text-xs text-muted-foreground">{update.sockets} open live connection(s) · updated {ago(update.at)}</p>}

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Active recently</p>
            {people.length === 0 && <p className="text-sm text-muted-foreground">Nobody in the last five minutes.</p>}
            <ul className="space-y-1">
              {people.slice(0, 8).map((p) => (
                <li key={p.id}>
                  <Link to={`/users/${p.id}`} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-muted">
                    <Avatar className="h-6 w-6"><AvatarImage src={p.avatarUrl ?? undefined} /><AvatarFallback className="text-[10px]">{(p.name || p.email)[0]?.toUpperCase()}</AvatarFallback></Avatar>
                    <span className="truncate">{p.name || p.email}</span>
                    {p.seenAt && <span className="ml-auto shrink-0 text-xs text-muted-foreground">{ago(p.seenAt)}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Changes as they happen</p>
            {feed.length === 0 && <p className="text-sm text-muted-foreground">Waiting for someone to arrive or leave…</p>}
            <ul className="max-h-48 space-y-1 overflow-y-auto">
              {feed.map((f) => (
                <li key={f.key} className="flex items-center gap-2 text-sm">
                  <span className={f.kind === 'joined' ? 'text-emerald-600' : 'text-muted-foreground'}>{f.kind === 'joined' ? '● came online' : '○ went quiet'}</span>
                  <Link to={`/users/${f.person.id}`} className="truncate underline-offset-2 hover:underline">{f.person.name || f.person.email}</Link>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">{ago(f.at)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
