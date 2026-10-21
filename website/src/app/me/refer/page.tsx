import type { Metadata } from 'next';
import { ReferView } from '@/components/me/refer-view';

export const metadata: Metadata = { title: 'Refer & Earn', robots: { index: false } };

export default function Page() {
  return <ReferView />;
}
