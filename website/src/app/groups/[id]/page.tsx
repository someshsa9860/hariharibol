import type { Metadata } from 'next';
import { GroupView } from '@/components/groups/group-view';

export const metadata: Metadata = {
  title: 'Group — chant together',
  robots: { index: false },
};

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <GroupView id={id} />;
}
