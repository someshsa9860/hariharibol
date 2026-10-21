import type { Metadata } from 'next';
import { PlanCards } from '@/components/me/plan-cards';
import { ErrorState } from '@/components/ui/states';
import { serverGet } from '@/lib/api/server';
import type { Plan } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Plans — more replies from Sakha',
  description: 'Reading, chanting and reels are free. Four plans, named for the four kinds of devotee in Bhagavad Gita 7.16, give Sakha more replies each month.',
  alternates: { canonical: '/plans' },
};

export default async function PlansPage() {
  const data = await serverGet<{ plans: Plan[] }>('/api/app/subscription/plans', { revalidate: 300 }).catch(() => null);
  return (
    <div className="page">
      <header className="page-title center">
        <p className="eyebrow">Plans</p>
        <h1>Everything is free. Sakha has room to grow.</h1>
        <p>Reading, chanting, reels and your routine stay free. A plan gives Sakha more replies each month — named for the four devotees of Bhagavad Gita 7.16.</p>
      </header>
      {data ? <PlanCards plans={data.plans} /> : <ErrorState message="The plans could not be loaded right now." />}
    </div>
  );
}
