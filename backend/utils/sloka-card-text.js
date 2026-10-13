// The words on a sloka card, and how big they can be — worked out without a
// canvas, so `npm test` loads this on its own. services/sloka-card.js draws
// what this returns.

// How the source writes a verse: Gita lines are split by newlines and end in
// an ASCII "|", Bhagavatam verses are one run with "।" between the halves, and
// both carry their own number at the end ("॥ २२ ॥", "||२-४७|||"). The card
// shows the verse, and the number goes in its footer, so the number is dropped.
const NUMBER_ONLY = /^[०-९0-9\s.\-–]+$/;

/**
 * The verse as stanzas of lines: `[['धृतराष्ट्र उवाच ।', '…'], ['…']]`.
 *
 * A compound verse (7.12.26-28) has one stanza per verse in it. Every stanza
 * ends in a double danda, so a card reads as the verse does on a page.
 */
function cardStanzas(sanskrit) {
  const text = String(sanskrit || '')
    .replace(/\|{2,}/g, '॥')
    .replace(/\|/g, '।')
    // The source has an ASCII colon where a visarga belongs ("वृत:").
    .replace(/([ऀ-ॿ]):/g, '$1ः');

  return text
    .split('॥')
    .map((part) => part.trim())
    .filter((part) => part && !NUMBER_ONLY.test(part))
    .map((part) => {
      const lines = part
        .split(/\n|(?<=।)/)
        .map((line) => line.trim())
        .filter(Boolean);
      lines[lines.length - 1] += ' ॥';
      return lines;
    });
}

// Breaks one line at spaces so each piece measures within `width`. A danda is
// kept on the word before it — a line that wrapped to a lone "॥" is worse than
// one a little over.
function wrapLine(line, size, width, measure) {
  const words = [];
  for (const token of line.split(/\s+/)) {
    if (words.length && /^[।॥]+$/.test(token)) words[words.length - 1] += ` ${token}`;
    else words.push(token);
  }

  const pieces = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && measure(next, size) > width) {
      pieces.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) pieces.push(current);
  return pieces;
}

/**
 * The largest type size at which the whole verse fits the box, and the lines
 * to draw at it. `measure(text, size)` is the width of `text` in pixels.
 *
 * A verse too long for the smallest size is cut at a line and ends in "…" —
 * the card is the doorway to the verse, not the whole of it; a tap opens it.
 *
 * Returns `{ size, lines: [{ text, gapBefore }] }`, where `gapBefore` marks the
 * first line of a stanza after the first.
 */
function fitVerse(stanzas, { measure, width, height, maxSize, minSize, lineHeight, stanzaGap }) {
  const layout = (size) =>
    stanzas.flatMap((stanza, index) =>
      stanza.flatMap((line, row) =>
        wrapLine(line, size, width, measure).map((text, piece) => ({
          text,
          gapBefore: index > 0 && row === 0 && piece === 0,
        }))
      )
    );
  const heightOf = (lines, size) =>
    lines.length * size * lineHeight + lines.filter((l) => l.gapBefore).length * size * stanzaGap;

  for (let size = maxSize; size >= minSize; size -= 2) {
    const lines = layout(size);
    if (heightOf(lines, size) <= height) return { size, lines };
  }

  const lines = layout(minSize);
  let kept = lines.length;
  while (kept > 1 && heightOf(lines.slice(0, kept), minSize) > height) kept -= 1;
  const cut = lines.slice(0, kept);

  // The last line gives up its danda for the ellipsis, and words too if the
  // ellipsis would push it past the width.
  let last = cut[kept - 1].text.replace(/\s*[।॥]+$/, '');
  while (last.includes(' ') && measure(`${last} …`, minSize) > width) {
    last = last.slice(0, last.lastIndexOf(' '));
  }
  cut[kept - 1] = { ...cut[kept - 1], text: `${last} …` };
  return { size: minSize, lines: cut };
}

export { cardStanzas, fitVerse, wrapLine };
