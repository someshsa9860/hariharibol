// The pages the etiquette in this folder is drawn from, each fetched and read before it was cited (2026-10-22).
// An entry spreads one of these into itself for `sourceName` / `sourceUrl` and writes its own `reference`
// (the verse or the teaching) and its own `author`, so the same address is typed once.
//
// The wording of every entry is our own. What is taken from a source is the rule it teaches, never its sentences.

// Whose words an entry is — the `author` a reader sees. A verse is credited to the one who speaks it (checked on the
// page it is cited from, 2026-10-23), a page to the temple or the teacher who published it, and a rule listed in
// The Nectar of Devotion to the scripture that book names for it. The author of the books we cite is not named on
// purpose: the app does not show his name yet (AppConfig.showAuthorName) and `checkItems` refuses it in any field.
// When it does, the name is added here and to the entries it belongs to, and that check is relaxed with it.
export const by = {
  // Who speaks or wrote the verse
  krishna: 'Śrī Kṛṣṇa', // the Bhagavad-gītā
  kapila: 'Lord Kapila', // Śrīmad-Bhāgavatam 3.25 (the page 3.25.13 opens his answer: śrī-bhagavān uvāca)
  narada: 'Nārada Muni', // Śrīmad-Bhāgavatam 7.11
  rupa: 'Rūpa Gosvāmī', // The Nectar of Instruction (Upadeśāmṛta)
  caitanya: 'Śrī Caitanya Mahāprabhu', // the Śikṣāṣṭaka, Caitanya-caritāmṛta Antya 20

  // The scripture a list is taken from
  padma: 'Padma Purāṇa', // the ten offenses to the holy name (Brahma-khaṇḍa 25.15–18)
  varaha: 'Varāha Purāṇa', // the offenses to the deity that The Nectar of Devotion, ch. 8, credits to it
  scripture: 'Vedic scripture', // the other offenses there, which the page places "in the supplementary Vedic literature"
  brahmaSamhita: 'Brahma-saṁhitā', // the page's own authority for honoring Gaṇapati ("In the Brahma-saṁhitā it is stated that…")

  // The teacher or the temple that published the page
  bhaktiCharuSwami: 'Bhakti Charu Swami',
  saci: 'Saci Gaurasundara Dasa',
  atlanta: 'Hindu Temple of Atlanta',
  sydney: 'Sri Venkateswara Temple, Sydney',
  baps: 'BAPS Shri Swaminarayan Mandir, London',
  bihariji: 'Shri Banke Bihari Mandir, Vrindavan',
};

/** Several authors in one field: `names(by.atlanta, by.sydney)` → "Hindu Temple of Atlanta; Sri Venkateswara Temple, Sydney". */
export const names = (...list) => list.join('; ');

const vedabase = (path) => ({ sourceName: 'Vedabase', sourceUrl: `https://vedabase.io/en/library/${path}/` });
const desireTree = (slug) => ({ sourceName: 'ISKCON Desire Tree', sourceUrl: `https://iskcondesiretree.com/profiles/blogs/${slug}` });

export const from = {
  // Scripture, on Vedabase
  nod: vedabase('nod/8'), // The Nectar of Devotion, ch. 8 — the offenses to be avoided
  noi3: vedabase('noi/3'), // The Nectar of Instruction, text 3
  noi5: vedabase('noi/5'), // The Nectar of Instruction, text 5 — how to honor devotees
  bg313: vedabase('bg/3/13'),
  bg926: vedabase('bg/9/26'),
  bg138: vedabase('bg/13/8-12'),
  bg161: vedabase('bg/16/1-3'),
  bg1714: vedabase('bg/17/14'),
  bg1715: vedabase('bg/17/15'),
  sb3252: vedabase('sb/3/25/21'),
  sb711: vedabase('sb/7/11/8-12'),
  cc2021: vedabase('cc/antya/20/21'),

  // Teaching on Vaishnava behaviour
  tenOffenses: { sourceName: 'ISKCON Bangalore', sourceUrl: 'https://www.iskconbangalore.org/blog/ten-offenses-to-the-holy-name-of-the-lord/' },
  principles: desireTree('basic-principles-of-vaishnava-behavior-by-srila-bhakti-charu'), // Bhakti Charu Swami
  behavior: desireTree('more-on-the-behavior-of-a-vaishnava-by-hh-bhakti-charu-swami'), // Bhakti Charu Swami

  // Holy places
  holyPlaces: { sourceName: 'ISKCON Desire Tree', sourceUrl: 'https://iskcondesiretree.com/groups/hhbhakticaruswami/page/etiquette-in-holy-places-by-bhakti-charu-swami' }, // Bhakti Charu Swami
  approachDham: desireTree('how-to-approach-the-holy-dham'), // Saci Gaurasundara Dasa

  // Temples that publish their own visitor guidelines
  bihariji: { sourceName: by.bihariji, sourceUrl: 'https://www.bihariji.org/public/DonNDonts.aspx' },
  atlanta: { sourceName: by.atlanta, sourceUrl: 'https://hindutempleofatlanta.org/pages/temple-etiquette-and-dress-code' },
  sydney: { sourceName: by.sydney, sourceUrl: 'https://www.svtsydney.org/general-info/etiquette-and-dress-code/' },
  baps: { sourceName: by.baps, sourceUrl: 'https://londonmandir.baps.org/visit-us/visitor-guidelines/' },
};
