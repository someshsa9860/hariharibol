import type { Metadata } from 'next';
import { GroupsView } from '@/components/groups/groups-view';

export const metadata: Metadata = {
  title: 'Chant together — private groups',
  description: 'Make a private group, invite people by email and chant together by voice.',
  alternates: { canonical: '/groups' },
  robots: { index: false },
};

export default function GroupsPage() {
  return <GroupsView />;
}
