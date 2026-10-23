// The holy name. The rules are the ten offenses to avoid while chanting and Śikṣāṣṭaka 3 (Caitanya-caritāmṛta, Antya 20.21).
//
// Two entries are EXCLUDED: they rank one deity or one deity's name over another's. They are kept, with the reason, so
// the record is complete and an admin can see what was left out and why; nothing with `status: 'EXCLUDED'` is ever
// shown to a reader or sent as a push.

import { by, from } from './sources.js';

export default [
  {
    slug: 'never-speak-ill-of-devotees',
    title: 'Never speak ill of devotees',
    summary: 'Insulting the devotees who have given their lives to spreading the holy name is the first of the ten offenses to avoid while chanting.',
    body: 'The lists of offenses to the holy name begin with insulting devotees, in particular those who have given their lives to spreading the name of the Lord. Belittling such a devotee spoils the very chanting you are doing. When you disagree with someone, speak to them directly and kindly, or leave it. Do not talk about them behind their back.',
    reference: 'The ten offenses to the holy name',
    author: by.padma,
    ...from.tenOffenses,
  },
  {
    slug: 'take-the-name-as-it-is-given',
    title: 'Take the holy name as it is given',
    summary: 'Do not explain the holy name away or invent meanings for it. Chant it as it has been handed down.',
    body: 'The holy name is not a puzzle for the mind to solve or reshape. The offenses to avoid include giving it a meaning of your own, as if it needed our help to be what it is. Learn what the teachers have taught about it, and chant it with trust.',
    reference: 'The ten offenses to the holy name',
    author: by.padma,
    ...from.tenOffenses,
  },
  {
    slug: 'do-not-sin-on-the-strength-of-the-name',
    title: 'Do not sin on the strength of the holy name',
    summary: 'Do not do wrong thinking that your chanting will wash it away.',
    body: 'The holy name is powerful, and that is exactly why it must not be used as a licence. To act wrongly and count on chanting to clear it afterwards is listed as an offense against the name. Let your chanting make you more careful, not less.',
    reference: 'The ten offenses to the holy name',
    author: by.padma,
    ...from.tenOffenses,
  },
  {
    slug: 'the-name-is-more-than-a-ritual',
    title: 'The holy name is more than a ritual',
    summary: 'Do not rank chanting with religious ceremonies, vows, renunciation or sacrifice. It is not one more good work to be counted.',
    body: 'Ceremonies, vows and acts of renunciation have their place. But the lists of offenses warn against treating the chanting of the name as just one more of them, to be counted and set against the rest. Give it your attention for its own sake.',
    reference: 'The ten offenses to the holy name',
    author: by.padma,
    ...from.tenOffenses,
  },
  {
    slug: 'chant-with-attention-and-faith',
    title: 'Chant with attention and faith',
    summary: 'Chant with faith and hear the name as you say it. Inattention, or holding on to worldly attachments, takes away from the chanting.',
    body: 'The tenth of the offenses to avoid covers three things: lacking full faith in the chanting, staying attached to worldly things after you have heard its glories, and being inattentive while you chant. You will not give your whole mind every time, so when it wanders, bring it back to the sound, gently and without scolding yourself. A calm place and a fixed time help.',
    reference: 'The ten offenses to the holy name',
    author: by.padma,
    ...from.tenOffenses,
  },
  {
    slug: 'share-the-name-with-those-who-wish-to-hear',
    title: 'Share the holy name with those who wish to hear it',
    summary: 'Offer the glories of the name to those who are open to them. Do not press them on people who are not.',
    body: 'The offenses to avoid include instructing a person who has no faith in the subject, or no wish to hear, about the glories of the name. The teaching adds that such a person can still be given the chance to hear the chanting itself. Let your own life be the first invitation. When someone asks, tell them what you have found; when they do not, respect that and leave it there.',
    reference: 'The ten offenses to the holy name',
    author: by.padma,
    ...from.tenOffenses,
  },
  {
    slug: 'chant-humbly',
    title: 'Chant humbly',
    summary: 'Think of yourself as lower than a blade of grass, be more patient than a tree, and give respect to others without expecting it.',
    body: 'In his third verse of the Śikṣāṣṭaka, Śrī Caitanya Mahāprabhu says the holy name can be chanted always by one who thinks himself lower than the grass, who is more tolerant than a tree, who expects no honor and gives all respect to others. It is a description of the mood to aim for, not a test to pass today. Begin with one small act of respect.',
    reference: 'Caitanya-caritāmṛta, Antya 20.21 (Śikṣāṣṭaka 3)',
    author: by.caitanya,
    ...from.cc2021,
  },

  // Kept for the record, never shown, never sent. Each ranks one deity or one deity’s name over another’s.
  {
    slug: 'treating-shiva-or-brahma-as-equal-to-vishnu',
    title: 'Treating Śiva or Brahmā as equal to, or independent of, Viṣṇu',
    summary: 'A teaching on how the devatās stand in relation to Viṣṇu. Excluded: it ranks one deity above another.',
    body: 'Among the ten offenses to the holy name, one teaching holds that to regard Śiva, Brahmā or the other devatās as equal to, or independent of, Viṣṇu is an offense against the name. The statement is kept in the database as it is taught in the tradition it comes from. It is not shown to readers or sent as a notification, because it sets one deity over another.',
    reference: 'The ten offenses to the holy name; The Nectar of Devotion, ch. 8',
    author: by.padma,
    status: 'EXCLUDED',
    excludedReason: 'Ranks one deity above another. Kept for the record; never shown to readers or sent as a push.',
    ...from.tenOffenses,
  },
  {
    slug: 'chanting-kali-or-durga-as-equal-to-hare-krishna',
    title: 'Chanting the names Kālī or Durgā as equal to Hare Kṛṣṇa',
    summary: 'A teaching on comparing the chanting of other names with the Hare Kṛṣṇa mantra. Excluded: it ranks one name above another.',
    body: 'The Nectar of Devotion, in its chapter on offenses, says it is a great offense to regard the chanting of the names of Kālī, Durgā or other devatās as the same as the chanting of Hare Kṛṣṇa. The statement is kept in the database as the text gives it. It is not shown to readers or sent as a notification, because it sets one deity’s name over another’s.',
    reference: 'The Nectar of Devotion, ch. 8',
    author: by.scripture,
    status: 'EXCLUDED',
    excludedReason: 'Ranks the chanting of one deity’s name above another’s. Kept for the record; never shown to readers or sent as a push.',
    ...from.nod,
  },
];
