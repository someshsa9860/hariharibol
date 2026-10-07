// Facts used by more than one part of the page. Copy that belongs to a single
// section lives at the top of that section's file instead.

export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.sss.ramkrishnahari';
export const CONTACT_EMAIL = 'hello@hariharibol.com';

// Sections reachable from the header and the footer, in page order.
export const NAV_LINKS = [
  { id: 'why', label: 'Why HariHariBol' },
  { id: 'features', label: 'Features' },
  { id: 'practice', label: 'Your practice' },
  { id: 'reels', label: 'Reels' },
  { id: 'faq', label: 'Questions' },
] as const;
