import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
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

export function AnalyticsPage() {
  const analytics = useResource<Analytics>(['analytics'], '/api/admin/system/analytics');
  const a = analytics.data;

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Active users, chanting and reel engagement — built from real activity, not page-view tracking (none exists yet)."
      />

      <div className="grid gap-4 md:grid-cols-3">
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
