'use client';

import { useApi } from '@/lib/use-api';

interface Report { streak: number; series: { date: string; rounds: number; target: number }[]; totals: { rounds: number; daysChanted: number; daysMetTarget: number; consistency: number; avgRoundsPerDay: number }; topIssues: { name: string; count: number }[] }

/** The last 30 days of chanting as bars, with the totals the app's report shows. */
export function PracticeReport() {
  const { data } = useApi<Report>('/sadhana/report', { auth: 'required' });
  if (!data) return null;
  const max = Math.max(1, ...data.series.map((d) => Math.max(d.rounds, d.target)));
  return (
    <section className="me-section">
      <h2>Your practice, 30 days</h2>
      <div className="card report">
        <div className="bars" role="img" aria-label={`Rounds chanted each day over the last ${data.series.length} days`}>
          {data.series.map((d) => <i key={d.date} title={`${d.date}: ${d.rounds} rounds`} className={d.rounds >= d.target && d.target > 0 ? 'met' : ''} style={{ height: `${Math.max(4, (d.rounds / max) * 100)}%` }} />)}
        </div>
        <ul className="report-stats">
          <li><strong>{data.totals.rounds}</strong><small>rounds</small></li>
          <li><strong>{data.totals.avgRoundsPerDay}</strong><small>a day</small></li>
          <li><strong>{Math.round(data.totals.consistency * 100)}%</strong><small>days on target</small></li>
          <li><strong>{data.streak}</strong><small>day streak</small></li>
        </ul>
      </div>
    </section>
  );
}
