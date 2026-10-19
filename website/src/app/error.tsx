'use client';

import { ErrorState } from '@/components/ui/states';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="page">
      <ErrorState message="Something went wrong on our side. Please try again." onRetry={reset} />
    </div>
  );
}
