import { useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Users, UserPlus, Crown, BookOpen, Wallet, Sparkles, Flame } from 'lucide-react';
import { useResource } from '@/lib/use-resource';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/page-header';
import { formatMinorUnits, formatMicros } from '@/lib/utils';

type Stats = {
  users: { total: number; newThisMonth: number; premium: number };
  content: { books: number; verses: number; mantras: number; slokaEligibleVerses: number };
  money: { activeSubscriptions: number; donations: number; revenueThisMonthMinor: number; aiSpendThisMonthMicros: number };
  engagement: { chantingDaysThisWeek: number };
};

type SignupRow = { date: string; count: number };

const CHART_COLORS = ['var(--color-chart-1)', 'var(--color-chart-2)', 'var(--color-chart-3)'];

function Kpi({
  label,
  value,
  icon: Icon,
  isLoading,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  isLoading: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between py-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          {isLoading ? <Skeleton className="mt-1.5 h-6 w-16" /> : <p className="mt-0.5 text-xl font-semibold">{value}</p>}
        </div>
        <div className="rounded-md bg-secondary p-2 text-secondary-foreground">
          <Icon className="h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  );
}

export function Dashboard() {
  const [days] = useState(30);
  const stats = useResource<Stats>(['dashboard'], '/api/admin/dashboard');
  const signups = useResource<SignupRow[]>(['dashboard-signups', days], '/api/admin/dashboard/signups', { days });

  const s = stats.data;

  const contentData = s
    ? [
        { name: 'Books', value: s.content.books },
        { name: 'Verses', value: s.content.verses },
        { name: 'Mantras', value: s.content.mantras },
      ]
    : [];

  const moneyData = s
    ? [
        { name: 'Active subs', value: s.money.activeSubscriptions },
        { name: 'Donations', value: s.money.donations },
      ]
    : [];

  return (
    <div>
      <PageHeader title="Dashboard" description="Counts and a 30-day activity series." />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <Kpi label="Total users" value={s ? s.users.total.toLocaleString() : ''} icon={Users} isLoading={stats.isLoading} />
        <Kpi label="New this month" value={s ? s.users.newThisMonth.toLocaleString() : ''} icon={UserPlus} isLoading={stats.isLoading} />
        <Kpi label="Premium users" value={s ? s.users.premium.toLocaleString() : ''} icon={Crown} isLoading={stats.isLoading} />
        <Kpi
          label="Revenue (30d)"
          value={s ? formatMinorUnits(s.money.revenueThisMonthMinor, 'INR') : ''}
          icon={Wallet}
          isLoading={stats.isLoading}
        />
        <Kpi
          label="AI spend (30d)"
          value={s ? formatMicros(s.money.aiSpendThisMonthMicros) : ''}
          icon={Sparkles}
          isLoading={stats.isLoading}
        />
        <Kpi label="Published books" value={s ? s.content.books.toLocaleString() : ''} icon={BookOpen} isLoading={stats.isLoading} />
        <Kpi
          label="Chanting days (7d)"
          value={s ? s.engagement.chantingDaysThisWeek.toLocaleString() : ''}
          icon={Flame}
          isLoading={stats.isLoading}
        />
        <Kpi
          label="Sloka-eligible verses"
          value={s ? s.content.slokaEligibleVerses.toLocaleString() : ''}
          icon={BookOpen}
          isLoading={stats.isLoading}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>New sign-ups, last {days} days</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {signups.isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={signups.data ?? []}>
                  <defs>
                    <linearGradient id="signupFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0} />
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
                    contentStyle={{
                      background: 'var(--color-popover)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelFormatter={(v) => new Date(String(v)).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                  />
                  <Area type="monotone" dataKey="count" stroke="var(--color-chart-1)" fill="url(#signupFill)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Content mix</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {stats.isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={contentData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {contentData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: 'var(--color-popover)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Subscriptions vs donations</CardTitle>
          </CardHeader>
          <CardContent className="h-52">
            {stats.isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={moneyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="name" fontSize={11} stroke="var(--color-muted-foreground)" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} fontSize={11} stroke="var(--color-muted-foreground)" tickLine={false} axisLine={false} width={28} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--color-popover)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="value" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
