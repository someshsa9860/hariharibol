import type { Metadata } from 'next';
import { NotificationsView } from '@/components/me/notifications-view';

export const metadata: Metadata = { title: 'Notifications', robots: { index: false } };

export default function NotificationsPage() {
  return <NotificationsView />;
}
