import clsx from 'clsx';
import { useScrolledPast } from '@/lib/use-scrolled-past';
import { Icon } from './icon';

// Floating "back to top" button, shown once the reader is well down the page.
export function ScrollTopButton() {
  const visible = useScrolledPast(600);

  return (
    <a className={clsx('scroll-top', visible && 'is-visible')} href="#top" aria-label="Back to top">
      <Icon name="up" />
    </a>
  );
}
