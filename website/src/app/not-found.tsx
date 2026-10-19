import Link from 'next/link';
import { EmptyState } from '@/components/ui/states';

export default function NotFound() {
  return (
    <div className="page">
      <EmptyState title="This page could not be found" motif="flute" action={<Link className="btn btn-primary" href="/read">Open the library</Link>}>
        The link may be old, or the verse may live under a different number.
      </EmptyState>
    </div>
  );
}
