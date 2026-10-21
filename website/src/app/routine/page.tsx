import type { Metadata } from 'next';
import { RoutineView } from '@/components/routine/routine-view';

export const metadata: Metadata = {
  title: 'Routine — shape your day',
  description: 'A simple daily routine for devotion and life: tasks for each day, a routine that repeats, and a tick with the time you did it. Works offline.',
  alternates: { canonical: '/routine' },
};

export default function RoutinePage() {
  return <RoutineView />;
}
