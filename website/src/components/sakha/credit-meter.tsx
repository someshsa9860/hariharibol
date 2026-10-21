import Link from 'next/link';
import clsx from 'clsx';
import type { Credits } from '@/lib/types';

/** How much of the reader's Sakha allowance is left. Replies, never tokens. */
export function CreditMeter({ credits }: { credits: Credits }) {
  const percent = Math.max(0, Math.min(100, Math.round(credits.percent)));
  const low = percent <= 15;
  return (
    <div className={clsx('meter', low && 'is-low')} title={credits.limitedBy === 'daily' ? 'Today’s replies — they refill at midnight' : 'Replies left in your plan this month'}>
      <span className="meter-label">{credits.exhausted ? 'No replies left' : `${percent}% left`}</span>
      <span className="meter-bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Sakha replies left"><i style={{ width: `${percent}%` }} /></span>
      {credits.exhausted && credits.canUpgrade && <Link href="/plans" className="text-link meter-link">Upgrade</Link>}
    </div>
  );
}
