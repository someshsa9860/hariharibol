'use client';

import clsx from 'clsx';
import { Icon } from '@/components/ui/icon';
import { Reveal } from '@/components/ui/reveal';
import { PLAY_STORE_URL } from '@/lib/config';
import { formatMoney } from '@/lib/format';
import { useAuth } from '@/lib/auth/auth-provider';
import { useApi } from '@/lib/use-api';
import type { Plan } from '@/lib/types';

const MONTH = 28; // a "monthly" price runs 28 days or more

function monthly(plan: Plan) {
  return plan.prices.filter((p) => !p.periodDays || p.periodDays >= MONTH).sort((a, b) => a.priceMinor - b.priceMinor)[0];
}

interface Mine { plan: { slug: string; name: string } | null; isPremium: boolean; reason?: string | null }

export function PlanCards({ plans }: { plans: Plan[] }) {
  const { user, openSignIn } = useAuth();
  const mine = useApi<Mine>(user ? '/subscription/me' : null, { auth: 'required' });
  const current = mine.data?.plan?.slug ?? (user ? 'free' : null);
  const sorted = [...plans].sort((a, b) => a.tier - b.tier);

  return (
    <>
      <div className="plan-grid">
        {sorted.map((plan, index) => {
          const price = monthly(plan);
          const replies = plan.sakha?.repliesPerMonth;
          const here = current === plan.slug;
          return (
            <Reveal key={plan.id} as="article" delay={index * 80} className={clsx('plan card', here && 'is-current', index === 2 && 'is-popular')}>
              {index === 2 && <span className="badge plan-flag">Most chosen</span>}
              <h2>{plan.name}</h2>
              {plan.description && <p className="muted plan-desc">{plan.description}</p>}
              <p className="plan-price">
                {plan.isFree || !price ? <strong>Free</strong> : <><strong>{formatMoney(price.priceMinor, price.currency)}</strong><span className="muted"> / month</span></>}
              </p>
              <ul className="plan-points">
                <li><Icon name="check" size={16} /> {replies ? <>About <strong>{replies.toLocaleString('en-IN')}</strong> replies from Sakha a month</> : 'Reading, chanting, reels and routine'}</li>
                {!plan.isFree && <li><Icon name="check" size={16} /> Everything in Free</li>}
                {price?.trialDays ? <li><Icon name="check" size={16} /> {price.trialDays}-day free trial</li> : null}
              </ul>
              {here ? <span className="btn btn-ghost btn-block" aria-current="true">Your plan</span>
                : plan.isFree ? null
                : <a className="btn btn-primary btn-block" href={PLAY_STORE_URL} rel="noopener">Subscribe in the app</a>}
            </Reveal>
          );
        })}
      </div>
      <p className="muted plan-note">
        Plans are bought in the HariHariBol app, through Google Play or the App Store, and apply here too once you sign in with the same account.
        {!user && <> <button className="link-btn" onClick={() => openSignIn('Sign in to see your plan.')}>Sign in</button> to see yours.</>}
        {' '}Replies are an estimate — a long answer or a picture uses more. Anyone who has given a donation keeps their plan for good.
      </p>
    </>
  );
}
