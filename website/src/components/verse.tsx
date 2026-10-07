import clsx from 'clsx';
import { Reveal } from './reveal';

type VerseProps = {
  sanskrit: string;
  // Where it comes from and what it means, shown together under the Sanskrit.
  reference: string;
  meaning: string;
  // Placement of this particular verse, e.g. `hero-verse`.
  className?: string;
  reveal?: boolean;
};

// A Bhagavad Gita line set off as a quotation.
export function Verse({ sanskrit, reference, meaning, className, reveal }: VerseProps) {
  const classes = clsx('gita-verse', className);
  const content = (
    <>
      <p lang="sa">{sanskrit}</p>
      <footer>{`${reference} · ${meaning}`}</footer>
    </>
  );

  return reveal ? (
    <Reveal as="blockquote" className={classes}>
      {content}
    </Reveal>
  ) : (
    <blockquote className={classes}>{content}</blockquote>
  );
}
