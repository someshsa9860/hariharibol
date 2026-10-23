// Reading and speaking of scripture: Bhagavad-gītā 13.8–12, 16.1–3 and 17.15, Śrīmad-Bhāgavatam 7.11.8–12, and the
// offense of speaking ill of the scriptures (among the ten offenses to the holy name).

import { by, names, from } from './sources.js';

export default [
  {
    slug: 'read-scripture-every-day',
    title: 'Read scripture every day',
    summary: 'Study of the scriptures is among the divine qualities. A page a day is enough to keep it alive.',
    body: 'Kṛṣṇa lists study of the scriptures among the divine qualities, and Nārada names it among the qualities of a good life. Choose a small amount you can keep up, a verse and its meaning, and read it at the same time every day. The habit matters more than the amount.',
    reference: 'Bhagavad-gītā 16.1–3; Śrīmad-Bhāgavatam 7.11.8–12',
    author: names(by.krishna, by.narada),
    ...from.bg161,
  },
  {
    slug: 'recite-aloud',
    title: 'Recite aloud',
    summary: 'The Gītā counts regular recitation of the scriptures as part of the austerity of speech.',
    body: 'In the seventeenth chapter Kṛṣṇa pairs truthful and pleasing speech with regular recitation of the Vedic literature. Say a verse aloud rather than only reading it. The sound stays with you longer, and the voice is put to good use.',
    reference: 'Bhagavad-gītā 17.15',
    author: by.krishna,
    ...from.bg1715,
  },
  {
    slug: 'learn-from-those-who-know',
    title: 'Learn from those who know',
    summary: 'Approach a teacher who knows the scriptures, and ask your questions humbly.',
    body: 'Kṛṣṇa lists approaching a bona fide teacher among the qualities of knowledge. A book can give you the words, and a teacher can show you how they are lived. Find a person you trust, and hear them regularly.',
    reference: 'Bhagavad-gītā 13.8–12',
    author: by.krishna,
    ...from.bg138,
  },
  {
    slug: 'speak-respectfully-of-sacred-texts',
    title: 'Speak respectfully of sacred texts',
    summary: 'Do not ridicule or belittle the scriptures. Disrespecting them is listed among the offenses to avoid.',
    body: 'You may find a passage hard to understand, or disagree with how it is explained. Ask, and keep reading. The lists of offenses to the holy name include speaking ill of the scriptures, and the courtesy applies to the sacred texts of everyone.',
    reference: 'The ten offenses to the holy name',
    author: by.padma,
    ...from.tenOffenses,
  },
];
