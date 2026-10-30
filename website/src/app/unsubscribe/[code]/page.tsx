import type { Metadata } from 'next';
import { UnsubscribeForm } from './unsubscribe-form';

export const metadata: Metadata = { title: 'Email preferences', robots: { index: false, follow: false } };

export default async function UnsubscribePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <div className="page-narrow">
      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <h1 style={{ fontSize: '1.4rem', margin: 0 }}>Email preferences</h1>
        <UnsubscribeForm code={code} />
      </div>
    </div>
  );
}
