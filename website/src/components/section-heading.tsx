import type { ReactNode } from 'react';
import { Reveal } from './reveal';

type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  // The line of supporting text under the title, when there is one.
  children?: ReactNode;
};

// The centred heading that opens a section.
export function SectionHeading({ eyebrow, title, children }: SectionHeadingProps) {
  return (
    <Reveal className="section-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
    </Reveal>
  );
}
