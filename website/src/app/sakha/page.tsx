import type { Metadata } from 'next';
import { SakhaGate } from '@/components/sakha/sakha-gate';

export const metadata: Metadata = {
  title: 'Ask Sakha — a devotional friend',
  description: 'Talk with Sakha, a warm digital companion for questions about verses, mantras and everyday devotion. Sign in to begin.',
  alternates: { canonical: '/sakha' },
};

export default function SakhaPage() {
  return <SakhaGate />;
}
