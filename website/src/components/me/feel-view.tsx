'use client';

import { useState } from 'react';
import { SlokaCard } from '@/components/home/sloka-card';
import { Spinner, ErrorState } from '@/components/ui/states';
import { useAuth } from '@/lib/auth/auth-provider';
import { api, describeError } from '@/lib/api/client';
import { useApi } from '@/lib/use-api';
import type { Verse } from '@/lib/types';

interface Issue { id: string; slug: string; name: string; description: string | null; category: 'VIKARA' | 'PRACTICE' | 'OTHER' }
interface Mood { reason: string; verse: Verse }

export function FeelView() {
  const { requireSignIn } = useAuth();
  const issues = useApi<Issue[]>('/issues', { auth: 'none' });
  const [picked, setPicked] = useState<string | null>(null);
  const [result, setResult] = useState<Mood | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choose = async (issue: Issue) => {
    if (!requireSignIn('Sign in to receive a verse chosen for what you are feeling.')) return;
    setPicked(issue.slug);
    setBusy(true);
    setError(null);
    try {
      setResult(await api<Mood>('/sloka/mood', { method: 'POST', auth: 'required', body: { issueSlug: issue.slug } }));
    } catch (failure) {
      setError(describeError(failure, 'No verse could be chosen for that just yet.'));
      setResult(null);
    }
    setBusy(false);
  };

  const groups = [
    { title: 'What is weighing on you?', items: issues.data?.filter((i) => i.category === 'VIKARA') ?? [] },
    { title: 'In your practice', items: issues.data?.filter((i) => i.category !== 'VIKARA') ?? [] },
  ].filter((g) => g.items.length);

  return (
    <div className="page-narrow">
      <header className="page-title">
        <p className="eyebrow">A verse for you</p>
        <h1>How are you feeling?</h1>
        <p>Choose what is closest to your heart today. You will receive a verse chosen for it, with the reason.</p>
      </header>
      {issues.loading && <div className="center-state"><Spinner /></div>}
      {issues.error != null && <ErrorState message="The list could not be loaded." onRetry={issues.reload} />}
      {groups.map((group) => (
        <section key={group.title} className="feel-group">
          <h2>{group.title}</h2>
          <div className="chip-row feel-chips">
            {group.items.map((issue) => <button key={issue.id} className="chip" aria-pressed={picked === issue.slug} onClick={() => choose(issue)} title={issue.description ?? undefined}>{issue.name}</button>)}
          </div>
        </section>
      ))}
      {busy && <div className="center-state"><Spinner /></div>}
      {error && <div className="notice notice-error" role="alert">{error}</div>}
      {result && !busy && (
        <div className="feel-result enter">
          <p className="feel-reason">{result.reason}</p>
          <SlokaCard verse={result.verse} label="A verse for you" />
        </div>
      )}
    </div>
  );
}
