import { Fragment, type ReactNode } from 'react';

// A small, safe Markdown renderer for Sakha's replies: paragraphs, headings, bold, italic, code, links, lists,
// quotes. It builds React elements and never sets HTML, so nothing in a reply can inject markup. Links only open
// http(s) and mailto addresses.

const INLINE = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*|_[^_\s][^_]*_|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;

function inline(text: string, keyBase: string): ReactNode[] {
  return text.split(INLINE).filter(Boolean).map((part, index) => {
    const key = `${keyBase}-${index}`;
    if (/^\*\*[^*]+\*\*$/.test(part) || /^__[^_]+__$/.test(part)) return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (/^`[^`]+`$/.test(part)) return <code key={key}>{part.slice(1, -1)}</code>;
    if (/^\*[^*\s][^*]*\*$/.test(part) || /^_[^_\s][^_]*_$/.test(part)) return <em key={key}>{part.slice(1, -1)}</em>;
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
    if (link) {
      const safe = /^(https?:\/\/|mailto:)/i.test(link[2]);
      return safe ? <a key={key} href={link[2]} target="_blank" rel="noopener noreferrer">{link[1]}</a> : <Fragment key={key}>{link[1]}</Fragment>;
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let n = 0;

  while (i < lines.length) {
    const line = lines[i];
    const key = `b${n++}`;

    if (/^```/.test(line)) {
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
      i += 1;
      blocks.push(<pre key={key}><code>{code.join('\n')}</code></pre>);
      continue;
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push(<p key={key} className="md-heading">{inline(heading[2], key)}</p>);
      i += 1;
      continue;
    }
    if (/^\s*[-*•]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*•]\s+/, ''));
      blocks.push(<ul key={key}>{items.map((item, idx) => <li key={idx}>{inline(item, `${key}-${idx}`)}</li>)}</ul>);
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ''));
      blocks.push(<ol key={key}>{items.map((item, idx) => <li key={idx}>{inline(item, `${key}-${idx}`)}</li>)}</ol>);
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^>\s?/, ''));
      blocks.push(<blockquote key={key}>{inline(quote.join(' '), key)}</blockquote>);
      continue;
    }
    if (!line.trim()) { i += 1; continue; }

    const paragraph: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(```|#{1,4}\s|\s*[-*•]\s|\s*\d+[.)]\s|>\s?)/.test(lines[i])) paragraph.push(lines[i++]);
    blocks.push(<p key={key}>{paragraph.flatMap((l, idx) => (idx ? [<br key={`br${idx}`} />, ...inline(l, `${key}-${idx}`)] : inline(l, `${key}-${idx}`)))}</p>);
  }
  return <>{blocks}</>;
}
