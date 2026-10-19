import type { ReactNode } from 'react';
import { Motif } from './motif';

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return <span className="spinner" role="status" aria-label={label} />;
}

export function PageLoading() {
  return (
    <div className="center-state" role="status" aria-live="polite">
      <Spinner />
    </div>
  );
}

export function EmptyState({ title, children, action, motif = 'lotus' }: { title: string; children?: ReactNode; action?: ReactNode; motif?: 'lotus' | 'sun' | 'conch' | 'flute' }) {
  return (
    <div className="center-state">
      <div className="motif"><Motif kind={motif} /></div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <EmptyState
      title="We couldn’t load this"
      motif="conch"
      action={onRetry && <button className="btn btn-ghost" onClick={onRetry}>Try again</button>}
    >
      {message}
    </EmptyState>
  );
}
