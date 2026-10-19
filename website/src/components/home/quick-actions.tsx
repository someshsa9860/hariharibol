import Link from 'next/link';
import { Icon, type IconName } from '@/components/ui/icon';
import { Reveal } from '@/components/ui/reveal';

const ACTIONS: { href: string; icon: IconName; title: string; text: string }[] = [
  { href: '/read', icon: 'book', title: 'Read', text: 'Gita, Bhagavatam, stotras' },
  { href: '/jap', icon: 'chant', title: 'Jap', text: 'Chant with a counter' },
  { href: '/sakha', icon: 'sakha', title: 'Ask Sakha', text: 'A devotional friend' },
  { href: '/reels', icon: 'reels', title: 'Reels', text: 'A minute of devotion' },
  { href: '/routine', icon: 'routine', title: 'Routine', text: 'Shape your day' },
  { href: '/feel', icon: 'heart', title: 'A verse for you', text: 'For how you feel' },
];

export function QuickActions() {
  return (
    <ul className="quick-grid">
      {ACTIONS.map((action, index) => (
        <Reveal as="li" key={action.href} delay={index * 60}>
          <Link href={action.href} className="quick card card-hover">
            <span className="quick-icon"><Icon name={action.icon} size={24} /></span>
            <strong>{action.title}</strong>
            <small>{action.text}</small>
          </Link>
        </Reveal>
      ))}
    </ul>
  );
}
