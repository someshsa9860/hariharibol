import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useState } from 'react';
import { LivePresence } from '@/components/live-presence';
import { Button } from '@/components/ui/button';
import { Users, Music, Video } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useResource } from '@/lib/use-resource';

type Analytics = {
  activeUsers: { daily: number; weekly: number; monthly: number };
  sadhanaActivity: { date: string; activeUsers: number }[];
  topMantras: { mantraId: string; name: string; sessions: number; rounds: number }[];
  topReels: { id: string; caption: string | null; creatorName: string; viewCount: number; likeCount: number; commentCount: number; shareCount: number }[];
};

type Activity = {
  days: number;
  series: { date: string; active: number; signups: number; wau: number; mau: number; stickiness: number }[];
  today: { active: number; newUsers: number; byPlatform: { platform: string; n: number }[] };
  retention: { d1: number | null; d7: number | null; d30: number | null; cohortSize: number };
  historySince: string | null;
};

const shortDate = (v: unknown) => new Date(String(v)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const tooltipStyle = { background: 'var(--color-popover)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 };
const pct = (v: number | null) => (v === null ? '—' : `${v}%`);

function ActivitySection() {
  const [days, setDays] = useState(30);
  const q = useResource<Activity>(['activity', days], '/api/admin/system/activity', { days });
  const d = q.data;
  const latest = d?.series[d.series.length - 1];
  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {[14, 30, 90, 180].map((n) => <Button key={n} size="sm" variant={days === n ? 'default' : 'outline'} onClick={() => setDays(n)}>{n} days</Button>)}
        {d?.historySince && <span className="text-xs text-muted-foreground">Daily record starts {new Date(d.historySince).toLocaleDateString('en-IN', { dateStyle: 'medium' })}; earlier days are rebuilt from other activity and are approximate.</span>}
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="py-4"><p className="text-xs font-medium text-muted-foreground">Active today</p><p className="mt-0.5 text-xl font-semibold">{d?.today.active ?? '…'}</p><p className="text-xs text-muted-foreground">{d?.today.newUsers ?? 0} new today</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs font-medium text-muted-foreground">Stickiness (DAU ÷ MAU)</p><p className="mt-0.5 text-xl font-semibold">{latest ? `${latest.stickiness}%` : '…'}</p><p className="text-xs text-muted-foreground">Share of monthly users who come daily</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs font-medium text-muted-foreground">Came back (day 1 · 7 · 30)</p><p className="mt-0.5 text-xl font-semibold">{d ? `${pct(d.retention.d1)} · ${pct(d.retention.d7)} · ${pct(d.retention.d30)}` : '…'}</p><p className="text-xs text-muted-foreground">Of people who joined in the last 60 days</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs font-medium text-muted-foreground">Today by platform</p><div className="mt-1 flex flex-wrap gap-1.5">{(d?.today.byPlatform ?? []).map((p) => <Badge key={p.platform} variant="secondary">{p.platform} {p.n}</Badge>)}{d && d.today.byPlatform.length === 0 && <span className="text-sm text-muted-foreground">—</span>}</div></CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Daily active users and new sign-ups</CardTitle></CardHeader>
        <CardContent className="h-64">
          {q.isLoading ? <Skeleton className="h-full w-full" /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d?.series ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDate} fontSize={11} stroke="var(--color-muted-foreground)" tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} fontSize={11} stroke="var(--color-muted-foreground)" tickLine={false} axisLine={false} width={32} />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => new Date(String(v)).toLocaleDateString('en-IN', { dateStyle: 'medium' })} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="active" name="Active users" fill="var(--color-chart-1)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="signups" name="New sign-ups" fill="var(--color-chart-3)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Weekly and monthly active users</CardTitle></CardHeader>
        <CardContent className="h-56">
          {q.isLoading ? <Skeleton className="h-full w-full" /> : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={d?.series ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDate} fontSize={11} stroke="var(--color-muted-foreground)" tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} fontSize={11} stroke="var(--color-muted-foreground)" tickLine={false} axisLine={false} width={32} />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => new Date(String(v)).toLocaleDateString('en-IN', { dateStyle: 'medium' })} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="wau" name="Weekly active" stroke="var(--color-chart-2)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="mau" name="Monthly active" stroke="var(--color-chart-1)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function AnalyticsPage() {
  const analytics = useResource<Analytics>(['analytics'], '/api/admin/system/analytics');
  const a = analytics.data;

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Who is online now, daily / weekly / monthly active users, sign-ups, retention, chanting and reel engagement — built from real activity, not page-view tracking."
      />

      <LivePresence />
      <ActivitySection />

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Active today</p>
              {analytics.isLoading ? <Skeleton className="mt-1.5 h-6 w-14" /> : <p className="mt-0.5 text-xl font-semibold">{a?.activeUsers.daily}</p>}
            </div>
            <Users className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Active this week</p>
              {analytics.isLoading ? <Skeleton className="mt-1.5 h-6 w-14" /> : <p className="mt-0.5 text-xl font-semibold">{a?.activeUsers.weekly}</p>}
            </div>
            <Users className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Active this month</p>
              {analytics.isLoading ? <Skeleton className="mt-1.5 h-6 w-14" /> : <p className="mt-0.5 text-xl font-semibold">{a?.activeUsers.monthly}</p>}
            </div>
            <Users className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Sadhana activity, last 30 days</CardTitle>
        </CardHeader>
        <CardContent className="h-56">
          {analytics.isLoading ? (
            <Skeleton className="h-full w-full" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={a?.sadhanaActivity ?? []}>
                <defs>
                  <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-chart-2)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--color-chart-2)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => new Date(String(v)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  fontSize={11}
                  stroke="var(--color-muted-foreground)"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis allowDecimals={false} fontSize={11} stroke="var(--color-muted-foreground)" tickLine={false} axisLine={false} width={28} />
                <Tooltip
                  contentStyle={{ background: 'var(--color-popover)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
                  labelFormatter={(v) => new Date(String(v)).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                />
                <Area type="monotone" dataKey="activeUsers" stroke="var(--color-chart-2)" fill="url(#activityFill)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <Music className="h-4 w-4" />
              Most-chanted mantras (30d)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {analytics.isLoading && <Skeleton className="h-40 w-full" />}
            {a?.topMantras.length === 0 && <p className="text-sm text-muted-foreground">No chanting sessions yet.</p>}
            {a?.topMantras.map((m, i) => (
              <div key={m.mantraId} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{i + 1}</Badge>
                  <span className="font-medium">{m.name}</span>
                </div>
                <span className="text-xs text-muted-foreground">{m.rounds} rounds · {m.sessions} sessions</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <Video className="h-4 w-4" />
              Most-viewed reels
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {analytics.isLoading && <Skeleton className="h-40 w-full" />}
            {a?.topReels.length === 0 && <p className="text-sm text-muted-foreground">No published reels yet.</p>}
            {a?.topReels.map((r, i) => (
              <div key={r.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <div className="flex items-center gap-2 truncate">
                  <Badge variant="secondary">{i + 1}</Badge>
                  <div className="truncate">
                    <p className="truncate font-medium">{r.caption || 'Untitled'}</p>
                    <p className="text-xs text-muted-foreground">{r.creatorName}</p>
                  </div>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {r.viewCount} views · {r.likeCount} likes
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
