import type { Metadata } from 'next';
import { ReferView } from '@/components/me/refer-view';

export const metadata: Metadata = {
  title: 'Refer and earn',
  description: 'Invite a friend to HariHariBol. When they begin chanting, you receive a month of Ārta.',
  alternates: { canonical: '/refer' },
  robots: { index: false },
};

export default function ReferPage() {
  return <ReferView />;
}
