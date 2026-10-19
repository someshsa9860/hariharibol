import type { Metadata } from 'next';
import { FeelView } from '@/components/me/feel-view';

export const metadata: Metadata = {
  title: 'A verse for how you feel',
  description: 'Name what is weighing on you — anger, desire, greed, pride, envy, or a difficulty in practice — and receive a verse chosen for it.',
  alternates: { canonical: '/feel' },
};

export default function FeelPage() {
  return <FeelView />;
}
