import clsx from 'clsx';

/** A short verse with its meaning and where it is from — used for the quiet quotes between sections. */
export function VerseQuote({ sanskrit, reference, meaning, className }: { sanskrit: string; reference: string; meaning: string; className?: string }) {
  return (
    <figure className={clsx('verse-quote', className)}>
      <blockquote lang="sa">{sanskrit}</blockquote>
      <figcaption>
        <strong>{reference}</strong>
        <span>{meaning}</span>
      </figcaption>
    </figure>
  );
}
