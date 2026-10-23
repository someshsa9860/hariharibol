import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Flame, Clock, BookOpen, Sparkles, Smartphone } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useResource } from '@/lib/use-resource';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EntityAudit } from '@/components/entity-audit';
import { formatDate, formatDateOnly, formatMinorUnits } from '@/lib/utils';

type Overview = {
  user: {
    id: string; email: string; name: string | null; avatarUrl: string | null; authProvider: string; legacyUserId: number | null;
    appLanguage: string; mantraLanguage: string; readingLanguage: string; timezone: string; sampradaya: string | null;
    isPremium: boolean; premiumSince: string | null; premiumUntil: string | null;
    isBanned: boolean; bannedReason: string | null; bannedAt: string | null;
    createdAt: string; updatedAt: string; lastActiveAt: string | null;
    countryCode: string | null; country: string | null; state: string | null; district: string | null; city: string | null;
    locationUpdatedAt: string | null;
    role: { slug: string; name: string }; creatorProfile: { id: string; status: string; displayName: string } | null;
  };
  entitlement: { plan: string | null; slug: string | null; reason: string; until: string | null };
  sadhanaProfile: { dailyRoundTarget: number; reminderTime: string | null; startedAt: string; preferredMantra: { id: string; name: string } | null } | null;
  chanting: { rounds: number; sittings: number; minutes: number; daysChanted: number; current: number; best: number; favouriteMantra: { id: string; name: string; rounds: number } | null };
  activity: { activeDays: number; firstActive: string | null; lastActive: string | null };
  engagement: {
    favorites: number; notes: number; highlights: number; routineTasks: number;
    reels: { views: number; likes: number; comments: number; shares: number };
    sakha: { conversations: number; messages: number };
    notifications: { total: number; unread: number };
  };
  devices: { platform: string; appVersion: string | null; lastSeenAt: string; fcmToken: string | null }[];
  referrals: { made: Record<string, number>; referredBy: { status: string; attributedAt: string; referrer: { id: string; name: string | null; email: string } } | null };
};

type Chanting = {
  mantras: { mantraId: string | null; name: string; category: string | null; rounds: number; sittings: number; minutes: number; lastChantedAt: string | null }[];
  sessions: { id: string; rounds: number; beads: number; source: string; startedAt: string; endedAt: string | null; durationSeconds: number | null; date: string; mantra: { id: string; name: string } | null }[];
  page: number; pageSize: number; total: number;
};
type Daily = {
  days: number;
  rows: { date: string; roundTarget: number; roundsCompleted: number; tasksTotal: number; tasksDone: number; note: string | null; sittings: number; minutes: number; active: boolean; platform: string | null }[];
  totals: { activeDays: number; rounds: number; targetMetDays: number };
};
type Engagement = {
  reading: { cantoNumber: number | null; chapterNumber: number | null; verseNumber: number | null; versesRead: number; lastReadAt: string; book: { slug: string; title: string } }[];
  saved: { verses: number; mantras: number; books: number; reels: number };
  recentSaved: { at: string; label: string }[];
  notes: { id: string; text: string; updatedAt: string; verse: { verseId: string } }[];
  reelViews: { watchCount: number; completed: boolean; lastViewedAt: string; reel: { id: string; caption: string | null; creator: { displayName: string } } }[];
  sakha: { id: string; title: string; messageCount: number; tokensUsed: number; lastMessageAt: string }[];
  notifications: { id: string; type: string; title: string; sentAt: string | null; readAt: string | null; createdAt: string }[];
};
type Billing = {
  entitlement: { plan: string | null; reason: string; until: string | null };
  subscriptions: { id: string; plan: string; provider: string; status: string; startedAt: string; currentPeriodEnd: string; autoRenew: boolean }[];
  payments: { id: string; provider: string; purpose: string; status: string; amountMinor: number; currency: string; paidAt: string | null; refundedAt: string | null; createdAt: string }[];
  wallet: { balance: number; allocation: number; periodStart: string; periodEnd: string | null } | null;
  ledger: { id: string; type: string; tokens: number; source: string; note: string | null; balanceAfter: number; createdAt: string }[];
  dailyUsage: { date: string; tokens: number; bonusTokens: number }[];
  grants: { id: string; plan: string; source: string; note: string | null; startsAt: string; endsAt: string; revokedAt: string | null }[];
};

function Stat({ label, value, hint, icon: Icon }: { label: string; value: React.ReactNode; hint?: string; icon?: typeof Flame }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between py-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-0.5 text-xl font-semibold">{value}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        {Icon && <Icon className="h-5 w-5 text-muted-foreground" />}
      </CardContent>
    </Card>
  );
}

function KeyValues({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
      {items.map(([k, v]) => (
        <div className="contents" key={k}>
          <dt className="whitespace-nowrap text-xs font-medium uppercase tracking-wide text-muted-foreground">{k}</dt>
          <dd className="break-words">{v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

function Table({ head, rows, empty }: { head: string[]; rows: React.ReactNode[][]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>{head.map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="px-3 py-2 align-top">{c}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

const minutes = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} m` : `${m} m`);
const seconds = (s: number | null) => (s ? minutes(Math.round(s / 60)) : '—');

function OverviewTab({ id }: { id: string }) {
  const q = useResource<Overview>(['user-overview', id], `/api/admin/users/${id}/overview`);
  const d = q.data;
  if (q.isLoading || !d) return <Skeleton className="h-64 w-full" />;
  const u = d.user;
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Rounds chanted" value={d.chanting.rounds.toLocaleString()} hint={`${d.chanting.sittings} sittings · ${minutes(d.chanting.minutes)}`} icon={Sparkles} />
        <Stat label="Chanting streak" value={`${d.chanting.current} days`} hint={`Best ${d.chanting.best} · ${d.chanting.daysChanted} days chanted`} icon={Flame} />
        <Stat label="Active days" value={d.activity.activeDays} hint={d.activity.lastActive ? `Last ${formatDateOnly(d.activity.lastActive)}` : 'None recorded'} icon={Clock} />
        <Stat label="Saved & noted" value={d.engagement.favorites + d.engagement.notes} hint={`${d.engagement.favorites} saved · ${d.engagement.notes} notes · ${d.engagement.highlights} highlights`} icon={BookOpen} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Account</CardTitle></CardHeader>
          <CardContent>
            <KeyValues items={[
              ['Email', u.email], ['Name', u.name], ['Role', <Badge variant="outline">{u.role.name}</Badge>],
              ['Sign-in', u.authProvider + (u.legacyUserId ? ` (old app #${u.legacyUserId})` : '')],
              ['Joined', formatDate(u.createdAt)], ['Last active', u.lastActiveAt ? formatDate(u.lastActiveAt) : 'Never'],
              ['Location (from IP)', u.country
                ? `${[u.city, u.district, u.state].filter(Boolean).join(', ')}${u.city || u.district || u.state ? ', ' : ''}${u.country}${u.locationUpdatedAt ? ` · seen ${formatDate(u.locationUpdatedAt)}` : ''}`
                : 'Not known yet'],
              ['App language', u.appLanguage], ['Reading / mantra', `${u.readingLanguage} / ${u.mantraLanguage}`], ['Timezone', u.timezone],
              ['Tradition (from chanting)', u.sampradaya ?? 'Not yet known'],
              ['Status', (
                <div className="flex flex-wrap gap-1.5">
                  {u.isBanned ? <Badge variant="destructive">Banned</Badge> : <Badge variant="success">In good standing</Badge>}
                  {u.creatorProfile && <Badge variant="secondary">Creator · {u.creatorProfile.status}</Badge>}
                </div>
              )],
              ...(u.isBanned ? [['Ban reason', u.bannedReason] as [string, React.ReactNode], ['Banned at', u.bannedAt ? formatDate(u.bannedAt) : '—'] as [string, React.ReactNode]] : []),
              ['User ID', <span className="font-mono text-xs">{u.id}</span>],
            ]} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Practice</CardTitle></CardHeader>
          <CardContent>
            <KeyValues items={[
              ['Plan', <span>{d.entitlement.plan ?? 'Free'} <span className="text-xs text-muted-foreground">({d.entitlement.reason.toLowerCase()}{d.entitlement.until ? ` · until ${formatDateOnly(d.entitlement.until)}` : ''})</span></span>],
              ['Daily target', d.sadhanaProfile ? `${d.sadhanaProfile.dailyRoundTarget} rounds` : 'Not set'],
              ['Reminder', d.sadhanaProfile?.reminderTime ?? 'None'],
              ['Preferred mantra', d.sadhanaProfile?.preferredMantra?.name ?? '—'],
              ['Most chanted', d.chanting.favouriteMantra ? `${d.chanting.favouriteMantra.name} (${d.chanting.favouriteMantra.rounds} rounds)` : '—'],
              ['Reels', `${d.engagement.reels.views} watched · ${d.engagement.reels.likes} liked · ${d.engagement.reels.comments} comments · ${d.engagement.reels.shares} shares`],
              ['Ask Sakha', `${d.engagement.sakha.conversations} conversation(s) · ${d.engagement.sakha.messages} messages`],
              ['Notifications', `${d.engagement.notifications.total} sent · ${d.engagement.notifications.unread} unread`],
              ['Routine tasks', d.engagement.routineTasks],
              ['Referrals made', Object.entries(d.referrals.made).map(([k, v]) => `${v} ${k.toLowerCase()}`).join(', ') || 'None'],
              ['Invited by', d.referrals.referredBy ? <Link className="underline" to={`/users/${d.referrals.referredBy.referrer.id}`}>{d.referrals.referredBy.referrer.name || d.referrals.referredBy.referrer.email}</Link> : '—'],
            ]} />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Smartphone className="h-4 w-4" /> Devices</CardTitle></CardHeader>
        <CardContent>
          <Table head={['Platform', 'App version', 'Push', 'Last seen']} empty="No device has signed in."
            rows={d.devices.map((x) => [x.platform, x.appVersion ?? '—', x.fcmToken ? 'Registered' : 'No', formatDate(x.lastSeenAt)])} />
        </CardContent>
      </Card>
    </div>
  );
}

function ChantingTab({ id }: { id: string }) {
  const [page, setPage] = useState(1);
  const q = useResource<Chanting>(['user-chanting', id, page], `/api/admin/users/${id}/chanting`, { page, pageSize: 25 });
  const d = q.data;
  if (q.isLoading || !d) return <Skeleton className="h-64 w-full" />;
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader><CardTitle>By mantra</CardTitle></CardHeader>
        <CardContent>
          <Table head={['Mantra', 'Rounds', 'Sittings', 'Time', 'Last chanted']} empty="Has not chanted yet."
            rows={d.mantras.map((m) => [<span>{m.name}{m.category && <Badge variant="outline" className="ml-2">{m.category}</Badge>}</span>, m.rounds.toLocaleString(), m.sittings, minutes(m.minutes), m.lastChantedAt ? formatDate(m.lastChantedAt) : '—'])} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Sittings ({d.total})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Table head={['Started', 'Mantra', 'Rounds', 'Beads in progress', 'Time', 'Source']} empty="No sittings."
            rows={d.sessions.map((s) => [formatDate(s.startedAt), s.mantra?.name ?? 'Plain counter', s.rounds, s.beads, seconds(s.durationSeconds), s.source])} />
          {d.total > d.pageSize && (
            <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <span>Page {page} of {Math.ceil(d.total / d.pageSize)}</span>
              <Button variant="outline" size="sm" disabled={page * d.pageSize >= d.total} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DailyTab({ id }: { id: string }) {
  const [days, setDays] = useState(90);
  const q = useResource<Daily>(['user-daily', id, days], `/api/admin/users/${id}/daily`, { days });
  const d = q.data;
  if (q.isLoading || !d) return <Skeleton className="h-64 w-full" />;
  const chart = [...d.rows].reverse().map((r) => ({ date: r.date.slice(5), rounds: r.roundsCompleted, target: r.roundTarget }));
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {[30, 90, 180, 365].map((n) => <Button key={n} size="sm" variant={days === n ? 'default' : 'outline'} onClick={() => setDays(n)}>{n} days</Button>)}
        <span className="ml-2 text-sm text-muted-foreground">{d.totals.activeDays} active days · {d.totals.rounds} rounds · target met on {d.totals.targetMetDays} days</span>
      </div>
      <Card>
        <CardHeader><CardTitle>Rounds per day</CardTitle></CardHeader>
        <CardContent className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
              <Tooltip />
              <Area type="monotone" dataKey="rounds" stroke="var(--color-chart-1)" fill="var(--color-chart-1)" fillOpacity={0.2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Table head={['Day', 'Active', 'Rounds / target', 'Sittings', 'Time', 'Tasks', 'Note']} empty="No activity in this range."
        rows={d.rows.map((r) => [
          formatDateOnly(r.date),
          r.active ? <Badge variant="success">{r.platform ?? 'yes'}</Badge> : <span className="text-muted-foreground">—</span>,
          r.roundTarget ? <span className={r.roundsCompleted >= r.roundTarget ? 'font-medium text-emerald-600' : ''}>{r.roundsCompleted} / {r.roundTarget}</span> : r.roundsCompleted,
          r.sittings, r.minutes ? minutes(r.minutes) : '—', r.tasksTotal ? `${r.tasksDone} / ${r.tasksTotal}` : '—', r.note ?? '',
        ])} />
    </div>
  );
}

function ActivityTab({ id }: { id: string }) {
  const q = useResource<Engagement>(['user-engagement', id], `/api/admin/users/${id}/engagement`);
  const d = q.data;
  if (q.isLoading || !d) return <Skeleton className="h-64 w-full" />;
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader><CardTitle>Reading</CardTitle></CardHeader>
        <CardContent>
          <Table head={['Book', 'Where they stopped', 'Verses read', 'Last read']} empty="Has not read anything."
            rows={d.reading.map((r) => [r.book.title, [r.cantoNumber && `Canto ${r.cantoNumber}`, r.chapterNumber && `Chapter ${r.chapterNumber}`, r.verseNumber && `Verse ${r.verseNumber}`].filter(Boolean).join(' · ') || '—', r.versesRead, formatDate(r.lastReadAt)])} />
        </CardContent>
      </Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Saved ({d.saved.verses} verses · {d.saved.mantras} mantras · {d.saved.books} books · {d.saved.reels} reels)</CardTitle></CardHeader>
          <CardContent><Table head={['Item', 'Saved']} empty="Nothing saved." rows={d.recentSaved.map((s) => [s.label, formatDate(s.at)])} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
          <CardContent><Table head={['Verse', 'Note', 'Updated']} empty="No notes." rows={d.notes.map((n) => [n.verse.verseId, n.text, formatDate(n.updatedAt)])} /></CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Reels watched</CardTitle></CardHeader>
        <CardContent>
          <Table head={['Reel', 'Creator', 'Watched', 'Finished', 'Last']} empty="No reels watched."
            rows={d.reelViews.map((v) => [v.reel.caption?.slice(0, 80) ?? v.reel.id, v.reel.creator.displayName, `${v.watchCount}×`, v.completed ? 'Yes' : 'No', formatDate(v.lastViewedAt)])} />
        </CardContent>
      </Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Ask Sakha</CardTitle></CardHeader>
          <CardContent>
            <p className="mb-2 text-xs text-muted-foreground">Titles and counts only — what a person says to Sakha is private and is not shown here.</p>
            <Table head={['Conversation', 'Messages', 'Last message']} empty="Has not used Sakha." rows={d.sakha.map((c) => [c.title, c.messageCount, formatDate(c.lastMessageAt)])} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Notifications sent</CardTitle></CardHeader>
          <CardContent><Table head={['Type', 'Title', 'Sent', 'Read']} empty="None sent." rows={d.notifications.map((n) => [n.type, n.title, formatDate(n.sentAt ?? n.createdAt), n.readAt ? formatDate(n.readAt) : 'Unread'])} /></CardContent>
        </Card>
      </div>
    </div>
  );
}

function BillingTab({ id }: { id: string }) {
  const q = useResource<Billing>(['user-billing', id], `/api/admin/users/${id}/billing`);
  const d = q.data;
  if (q.isLoading || !d) return <Skeleton className="h-64 w-full" />;
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader><CardTitle>Plan: {d.entitlement.plan ?? 'Free'}</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">Access comes from {d.entitlement.reason.toLowerCase()}{d.entitlement.until ? `, until ${formatDateOnly(d.entitlement.until)}` : ''}.</p>
          <Table head={['Plan', 'Store', 'Status', 'Started', 'Period ends', 'Renews']} empty="No subscriptions."
            rows={d.subscriptions.map((s) => [s.plan, s.provider, <Badge variant="outline">{s.status}</Badge>, formatDateOnly(s.startedAt), formatDateOnly(s.currentPeriodEnd), s.autoRenew ? 'Yes' : 'No'])} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Free months and grants</CardTitle></CardHeader>
        <CardContent><Table head={['Plan', 'Source', 'From', 'To', 'Note']} empty="None." rows={d.grants.map((g) => [g.plan, g.source, formatDateOnly(g.startsAt), formatDateOnly(g.endsAt), g.revokedAt ? `Revoked ${formatDateOnly(g.revokedAt)}` : g.note ?? ''])} /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Payments and donations</CardTitle></CardHeader>
        <CardContent>
          <Table head={['When', 'Kind', 'Store', 'Amount', 'Status']} empty="No payments."
            rows={d.payments.map((p) => [formatDate(p.paidAt ?? p.createdAt), p.purpose, p.provider, formatMinorUnits(p.amountMinor, p.currency), <Badge variant="outline">{p.status}</Badge>])} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Ask Sakha wallet</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {d.wallet ? <p className="text-sm">Balance {d.wallet.balance.toLocaleString()} of {d.wallet.allocation.toLocaleString()} tokens ({Math.max(0, Math.round((d.wallet.balance / Math.max(1, d.wallet.allocation)) * 100))}%){d.wallet.periodEnd ? ` · renews ${formatDateOnly(d.wallet.periodEnd)}` : ''}</p> : <p className="text-sm text-muted-foreground">No wallet yet.</p>}
          <Table head={['When', 'Movement', 'Tokens', 'Source', 'Balance after', 'Note']} empty="No movements." rows={d.ledger.map((l) => [formatDate(l.createdAt), l.type, l.tokens.toLocaleString(), l.source, l.balanceAfter.toLocaleString(), l.note ?? ''])} />
        </CardContent>
      </Card>
    </div>
  );
}

/** One person, everything: `/users/:id`. The tabs each read their own endpoint, so opening the page costs one request. */
export function UserDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const q = useResource<Overview>(['user-overview', id], `/api/admin/users/${id}/overview`);
  const u = q.data?.user;

  return (
    <div>
      <Button variant="ghost" size="sm" className="-ml-2 mb-3" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/users'))}>
        <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to users
      </Button>
      {q.isError ? (
        <p className="text-sm text-destructive">This person could not be found.</p>
      ) : (
        <>
          <div className="mb-5 flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={u?.avatarUrl ?? undefined} />
              <AvatarFallback>{(u?.name || u?.email || '?')[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-xl font-semibold">{u ? u.name || u.email : <Skeleton className="h-6 w-40" />}</h2>
              <p className="text-sm text-muted-foreground">{u?.email}</p>
            </div>
            <div className="ml-2 flex gap-1.5">
              {u?.isPremium && <Badge variant="success">Premium</Badge>}
              {u?.isBanned && <Badge variant="destructive">Banned</Badge>}
            </div>
          </div>
          <Tabs defaultValue="overview">
            <TabsList className="flex-wrap">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="chanting">Chanting</TabsTrigger>
              <TabsTrigger value="daily">Daily record</TabsTrigger>
              <TabsTrigger value="activity">Reading &amp; activity</TabsTrigger>
              <TabsTrigger value="billing">Plan &amp; wallet</TabsTrigger>
              <TabsTrigger value="audit">Audit log</TabsTrigger>
            </TabsList>
            <TabsContent value="overview"><OverviewTab id={id} /></TabsContent>
            <TabsContent value="chanting"><ChantingTab id={id} /></TabsContent>
            <TabsContent value="daily"><DailyTab id={id} /></TabsContent>
            <TabsContent value="activity"><ActivityTab id={id} /></TabsContent>
            <TabsContent value="billing"><BillingTab id={id} /></TabsContent>
            <TabsContent value="audit">
              <EntityAudit scope={{ entityType: 'User', entityId: id, actorId: id, title: 'Staff actions on this account, and by it' }} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
