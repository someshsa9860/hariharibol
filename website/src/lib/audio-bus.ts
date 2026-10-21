// Only one recitation sounds at a time across the whole page: whoever starts claims the bus and the one before is
// paused. A verse's own button and the chapter player both use it.
let current: HTMLAudioElement | null = null;

export function claimAudio(element: HTMLAudioElement): void {
  if (current && current !== element) current.pause();
  current = element;
}

export function releaseAudio(element: HTMLAudioElement): void {
  if (current === element) current = null;
}
