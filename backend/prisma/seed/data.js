// The seed data.
//
// Kept apart from the seeding logic so the two are readable separately: this
// file is about *what* the platform starts with, index.js is about how it gets
// written.

import { ROLES, ROLE_PERMISSIONS, PERMISSIONS, SETTING_KEYS } from '../../config/constants.js';

// ── Roles ──────────────────────────────────────────────────────────────────
// Marked isSystem so they cannot be deleted from the panel: removing the role
// every account points at is not a mistake worth leaving available.

const roles = [
  {
    slug: ROLES.USER,
    name: 'User',
    description: 'An ordinary account. What everyone gets on signup.',
    isSystem: true,
    permissions: ROLE_PERMISSIONS[ROLES.USER],
  },
  {
    slug: ROLES.MODERATOR,
    name: 'Moderator',
    description: 'Edits verses and curates the daily sloka. Cannot touch users or money.',
    isSystem: true,
    permissions: ROLE_PERMISSIONS[ROLES.MODERATOR],
  },
  {
    slug: ROLES.ADMIN,
    name: 'Admin',
    description: 'Everything except deleting accounts, changing roles, secrets and refunds.',
    isSystem: true,
    permissions: ROLE_PERMISSIONS[ROLES.ADMIN],
  },
  {
    slug: ROLES.SUPER_ADMIN,
    name: 'Super admin',
    description: 'Everything, including permissions added in future.',
    isSystem: true,
    permissions: ROLE_PERMISSIONS[ROLES.SUPER_ADMIN],
  },
];

const permissions = Object.entries(PERMISSIONS).map(([slug, meta]) => ({
  slug,
  name: meta.name,
  group: meta.group,
}));

// ── Languages ──────────────────────────────────────────────────────────────
// The three flags decide which of a user's three choices a language may fill.
// Sanskrit is a mantra language and not an app language — nobody wants the
// settings screen in Sanskrit, and there are no Sanskrit meanings to read.

const languages = [
  { code: 'en', nativeName: 'English', englishName: 'English', displayOrder: 1 },
  { code: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi', displayOrder: 2 },
  { code: 'mr', nativeName: 'मराठी', englishName: 'Marathi', displayOrder: 3 },
  {
    code: 'sa',
    nativeName: 'संस्कृतम्',
    englishName: 'Sanskrit',
    isAppLanguage: false,
    isReadingLanguage: false,
    displayOrder: 4,
  },
  { code: 'gu', nativeName: 'ગુજરાતી', englishName: 'Gujarati', displayOrder: 5 },
  { code: 'bn', nativeName: 'বাংলা', englishName: 'Bengali', displayOrder: 6 },
  { code: 'ta', nativeName: 'தமிழ்', englishName: 'Tamil', displayOrder: 7 },
  { code: 'te', nativeName: 'తెలుగు', englishName: 'Telugu', displayOrder: 8 },
  { code: 'kn', nativeName: 'ಕನ್ನಡ', englishName: 'Kannada', displayOrder: 9 },
  { code: 'or', nativeName: 'ଓଡ଼ିଆ', englishName: 'Odia', displayOrder: 10 },
  { code: 'pa', nativeName: 'ਪੰਜਾਬੀ', englishName: 'Punjabi', displayOrder: 11 },
  { code: 'ml', nativeName: 'മലയാളം', englishName: 'Malayalam', displayOrder: 12 },
  { code: 'as', nativeName: 'অসমীয়া', englishName: 'Assamese', displayOrder: 13 },
];

// ── Issues ─────────────────────────────────────────────────────────────────
// The six vikaras, and the two practice difficulties the user named. A fixed
// list rather than free text, because these are what VerseIssue maps slokas to
// — free text would give the picker nothing to match against.

const issues = [
  {
    slug: 'kama',
    name: 'Kama',
    nameI18n: { hi: 'काम', mr: 'काम' },
    category: 'VIKARA',
    description: 'Lust, craving, wanting what will not satisfy.',
    displayOrder: 1,
  },
  {
    slug: 'krodha',
    name: 'Krodha',
    nameI18n: { hi: 'क्रोध', mr: 'क्रोध' },
    category: 'VIKARA',
    description: 'Anger, irritation, losing your temper.',
    displayOrder: 2,
  },
  {
    slug: 'lobha',
    name: 'Lobha',
    nameI18n: { hi: 'लोभ', mr: 'लोभ' },
    category: 'VIKARA',
    description: 'Greed, holding on, never having enough.',
    displayOrder: 3,
  },
  {
    slug: 'moha',
    name: 'Moha',
    nameI18n: { hi: 'मोह', mr: 'मोह' },
    category: 'VIKARA',
    description: 'Attachment and delusion, mistaking what is temporary for what lasts.',
    displayOrder: 4,
  },
  {
    slug: 'mada',
    name: 'Mada',
    nameI18n: { hi: 'मद', mr: 'मद' },
    category: 'VIKARA',
    description: 'Pride, arrogance, thinking yourself above others.',
    displayOrder: 5,
  },
  {
    slug: 'matsarya',
    name: 'Matsarya',
    nameI18n: { hi: 'मात्सर्य', mr: 'मत्सर' },
    category: 'VIKARA',
    description: 'Envy, resenting what someone else has been given.',
    displayOrder: 6,
  },
  {
    slug: 'missed-chanting-time',
    name: 'Could not chant on time',
    category: 'PRACTICE',
    description: 'The day gets away and the chanting time passes.',
    displayOrder: 7,
  },
  {
    slug: 'unmet-round-target',
    name: 'Could not finish my rounds',
    category: 'PRACTICE',
    description: 'Starting the rounds but not completing the target.',
    displayOrder: 8,
  },
];

// ── Deities ────────────────────────────────────────────────────────────────
// Mostly Vaishnav, extended with the Shaiva set (Shiva) since a devotee's
// worship is not confined to one sampradaya. Every row carries `sampradaya` so
// the mantra picker and any future tradition filter know what they belong to.

const deities = [
  { slug: 'krishna', name: 'Krishna', nameI18n: { hi: 'कृष्ण', mr: 'कृष्ण' }, displayOrder: 1, imagePath: 'deities/images/krishna.jpg' },
  { slug: 'radha', name: 'Radha', nameI18n: { hi: 'राधा', mr: 'राधा' }, displayOrder: 2, imagePath: 'deities/images/radha.jpg' },
  { slug: 'vishnu', name: 'Vishnu', nameI18n: { hi: 'विष्णु', mr: 'विष्णू' }, displayOrder: 3, imagePath: 'deities/images/vishnu.jpg' },
  { slug: 'rama', name: 'Rama', nameI18n: { hi: 'राम', mr: 'राम' }, displayOrder: 4 },
  { slug: 'narasimha', name: 'Narasimha', nameI18n: { hi: 'नरसिंह' }, displayOrder: 5 },
  { slug: 'narayana', name: 'Narayana', nameI18n: { hi: 'नारायण' }, displayOrder: 6 },
  { slug: 'lakshmi', name: 'Lakshmi', nameI18n: { hi: 'लक्ष्मी' }, displayOrder: 7, imagePath: 'deities/images/lakshmi.jpg' },
  { slug: 'hanuman', name: 'Hanuman', nameI18n: { hi: 'हनुमान' }, displayOrder: 8 },
  { slug: 'jagannath', name: 'Jagannath', nameI18n: { hi: 'जगन्नाथ' }, displayOrder: 9, imagePath: 'deities/images/jagannath.jpg' },
  { slug: 'vitthal', name: 'Vitthal', nameI18n: { mr: 'विठ्ठल', hi: 'विट्ठल' }, displayOrder: 10, imagePath: 'deities/images/vitthal.jpg' },
  { slug: 'dattatreya', name: 'Dattatreya', nameI18n: { hi: 'दत्तात्रेय', mr: 'दत्तात्रेय' }, displayOrder: 11 },
  {
    slug: 'shiva',
    name: 'Shiva',
    nameI18n: { hi: 'शिव', mr: 'शिव' },
    description: 'Mahadev, the auspicious one — the destroyer within the Trimurti, and the ascetic yogi of Kailash.',
    sampradaya: 'shaiva',
    displayOrder: 12,
  },
];

// ── Gurus ──────────────────────────────────────────────────────────────────
// The Vaishnav parampara. Overlaps with translators by design: the same person
// can be both, but lineage and authorship are different things.

const gurus = [
  { slug: 'chaitanya-mahaprabhu', name: 'Sri Chaitanya Mahaprabhu', displayOrder: 1 },
  { slug: 'ramanujacharya', name: 'Sri Ramanujacharya', displayOrder: 2 },
  { slug: 'madhvacharya', name: 'Sri Madhvacharya', displayOrder: 3 },
  { slug: 'vallabhacharya', name: 'Sri Vallabhacharya', displayOrder: 4 },
  { slug: 'nimbarkacharya', name: 'Sri Nimbarkacharya', displayOrder: 5 },
  { slug: 'prabhupada', name: 'A. C. Bhaktivedanta Swami Prabhupada', displayOrder: 6 },
  { slug: 'dnyaneshwar', name: 'Sant Dnyaneshwar', displayOrder: 7 },
  { slug: 'tukaram', name: 'Sant Tukaram', displayOrder: 8 },
  { slug: 'namdev', name: 'Sant Namdev', displayOrder: 9 },
  { slug: 'eknath', name: 'Sant Eknath', displayOrder: 10 },
];

// ── Translators ────────────────────────────────────────────────────────────
// Devotional commentators only. No academic or non-devotee commentary is
// published on this platform — that rule is enforced by what gets seeded here
// and by who is added later, not by anything in the code.

const translators = [
  {
    slug: 'prabhupada',
    name: 'A. C. Bhaktivedanta Swami Prabhupada',
    bio: 'Founder-acharya of ISKCON. Bhagavad-gita As It Is and the Srimad-Bhagavatam.',
    displayOrder: 1,
  },
  {
    slug: 'ramanujacharya',
    name: 'Sri Ramanujacharya',
    bio: 'Sri Vaishnava acharya. The Gita Bhashya.',
    displayOrder: 2,
  },
  {
    slug: 'madhvacharya',
    name: 'Sri Madhvacharya',
    bio: 'Dvaita acharya. The Gita Bhashya and Gita Tatparya.',
    displayOrder: 3,
  },
  {
    slug: 'vishwanath-chakravarti',
    name: 'Srila Vishwanath Chakravarti Thakur',
    bio: 'Gaudiya Vaishnava acharya. The Sarartha Varshini commentary.',
    displayOrder: 4,
  },
  {
    slug: 'baladeva-vidyabhushana',
    name: 'Srila Baladeva Vidyabhushana',
    bio: 'Gaudiya Vaishnava acharya. The Gita Bhushana commentary.',
    displayOrder: 5,
  },
  {
    slug: 'sridhara-swami',
    name: 'Sridhara Swami',
    bio: 'The Subodhini commentary on the Srimad Bhagavatam.',
    displayOrder: 6,
  },
  {
    slug: 'dnyaneshwar',
    name: 'Sant Dnyaneshwar',
    bio: 'The Dnyaneshwari — the Gita in Marathi ovi, expanded rather than translated.',
    displayOrder: 7,
  },
];

// ── Mantras ────────────────────────────────────────────────────────────────
// A small, well-known set — nothing confidential or initiatory (no diksha or
// gayatri mantras given only by a guru at initiation). `deity`/`guru` are
// slugs, resolved to ids in index.js rather than repeating them here.
//
// Meanings and purports below are written plainly for a first-time reader,
// not quoted from any published commentary.

const mantras = [
  {
    slug: 'hare-krishna-mahamantra',
    name: 'Hare Krishna Mahamantra',
    category: 'mahamantra',
    deity: 'krishna',
    guru: 'chaitanya-mahaprabhu',
    sanskrit: 'हरे कृष्ण हरे कृष्ण । कृष्ण कृष्ण हरे हरे ॥\nहरे राम हरे राम । राम राम हरे हरे ॥',
    transliteration: 'Hare Kṛṣṇa Hare Kṛṣṇa, Kṛṣṇa Kṛṣṇa Hare Hare\nHare Rāma Hare Rāma, Rāma Rāma Hare Hare',
    standardRounds: 16,
    displayOrder: 1,
    translations: [
      {
        languageCode: 'en',
        text: 'Hare Krishna Hare Krishna, Krishna Krishna Hare Hare\nHare Rama Hare Rama, Rama Rama Hare Hare',
        meaning:
          "Hare — O energy of the Lord; Krishna and Rama — the Lord's own names. Not a request for "
          + 'anything, but a call: an offer of loving service and a longing for His company.',
        purport:
          "The maha-mantra, the 'great chant', sung by Sri Chaitanya Mahaprabhu through the streets "
          + 'of Nabadwip. It carries no requirement of time, place or qualification — anyone, in any '
          + 'condition, may take it up. Traditionally counted in a fixed number of rounds on a strand '
          + 'of 108 beads, one bead per full mantra.',
      },
    ],
  },
  {
    slug: 'panchatattva-mantra',
    name: 'Panchatattva Mantra',
    category: 'name',
    guru: 'chaitanya-mahaprabhu',
    sanskrit: 'श्री कृष्ण चैतन्य प्रभु नित्यानन्द । श्री अद्वैत गदाधर श्रीवासादि गौर भक्त वृन्द ॥',
    transliteration: 'Śrī Kṛṣṇa Chaitanya Prabhu Nityānanda, Śrī Advaita Gadādhara Śrīvāsādi Gaura-bhakta-vṛnda',
    standardCount: 3,
    displayOrder: 2,
    translations: [
      {
        languageCode: 'en',
        text: 'Sri Krishna Chaitanya Prabhu Nityananda, Sri Advaita Gadadhara Srivasadi Gaura-bhakta-vrinda',
        meaning:
          'Salutations to the five who appeared together to give the holy name: Chaitanya, '
          + 'Nityananda, Advaita, Gadadhara, and Srivasa with the rest of Gaura’s devotees.',
        purport:
          'Chanted before the mahamantra, as a mark of respect to the five who carried it — the '
          + 'tradition holds that without their grace, the name does not open on its own.',
      },
    ],
  },
  {
    slug: 'om-namo-bhagavate-vasudevaya',
    name: 'Vasudeva Dwadashakshari Mantra',
    category: 'name',
    deity: 'vishnu',
    sanskrit: 'ॐ नमो भगवते वासुदेवाय',
    transliteration: 'Oṁ Namo Bhagavate Vāsudevāya',
    standardCount: 108,
    displayOrder: 3,
    translations: [
      {
        languageCode: 'en',
        text: 'Om Namo Bhagavate Vasudevaya',
        meaning:
          'Obeisances to the Supreme Personality of Godhead, Vasudeva — the twelve-syllable mantra '
          + 'of the Bhagavata tradition.',
        purport:
          "Called the dvadashakshara, the mantra of twelve syllables. Prahlada's father could not "
          + 'make him give it up; Dhruva received it from Narada. It names no particular form, only '
          + 'the Lord as shelter of all forms.',
      },
    ],
  },
  {
    slug: 'rama-taraka-mantra',
    name: 'Rama Taraka Mantra',
    category: 'name',
    deity: 'rama',
    sanskrit: 'श्री राम जय राम जय जय राम',
    transliteration: 'Śrī Rāma Jaya Rāma Jaya Jaya Rāma',
    standardCount: 108,
    displayOrder: 4,
    translations: [
      {
        languageCode: 'en',
        text: 'Sri Rama Jaya Rama Jaya Jaya Rama',
        meaning:
          "Victory to Sri Rama, victory, victory to Rama — the taraka-mantra, the 'mantra that "
          + "carries across', said to have carried Hanuman over the ocean to Lanka.",
        purport:
          'Sixteen syllables, said by tradition to hold the weight of the Vishnu-sahasranama, the '
          + "thousand names, within it — Parvati is told this by Shiva in the story that gives the "
          + 'mantra its name.',
      },
    ],
  },
  {
    slug: 'nrisimha-mantra',
    name: 'Nrisimha Maha-mantra',
    category: 'name',
    deity: 'narasimha',
    sanskrit: 'उग्रं वीरं महाविष्णुं ज्वलन्तं सर्वतोमुखम् । नृसिंहं भीषणं भद्रं मृत्युमृत्युं नमाम्यहम् ॥',
    transliteration:
      'Ugraṁ Vīraṁ Mahā-Viṣṇuṁ Jvalantaṁ Sarvato-mukham, Nṛsiṁhaṁ Bhīṣaṇaṁ Bhadraṁ Mṛtyu-mṛtyuṁ Namāmy-aham',
    standardCount: 108,
    displayOrder: 5,
    translations: [
      {
        languageCode: 'en',
        text: 'Ugram Viram Maha-Vishnum Jvalantam Sarvato-mukham, Nrisimham Bhishanam Bhadram Mrityu-mrityum Namamy-aham',
        meaning:
          'I bow to Lord Nrisimha, fierce and heroic, the great Vishnu blazing on every side — '
          + 'terrible, yet the source of all good, death to death itself.',
        purport:
          'Chanted for protection and courage. Nrisimha, half-lion half-man, appeared to end the '
          + 'tyranny of Hiranyakashipu and save the child Prahlada — the form invoked when the '
          + 'obstacle itself is fear.',
      },
    ],
  },
  {
    slug: 'krishna-gayatri',
    name: 'Krishna Gayatri Mantra',
    category: 'gayatri',
    deity: 'krishna',
    sanskrit: 'ॐ देवकीनन्दनाय विद्महे वासुदेवाय धीमहि । तन्नो कृष्णः प्रचोदयात् ॥',
    transliteration: 'Oṁ Devakī-nandanāya Vidmahe Vāsudevāya Dhīmahi, Tanno Kṛṣṇaḥ Pracodayāt',
    standardCount: 3,
    displayOrder: 6,
    translations: [
      {
        languageCode: 'en',
        text: 'Om Devaki-nandanaya Vidmahe Vasudevaya Dhimahi, Tanno Krishnah Prachodayat',
        meaning:
          'We meditate on the son of Devaki, we contemplate the son of Vasudeva — may that Krishna '
          + 'direct our understanding.',
        purport:
          'Built on the Gayatri metre, the form every Vedic mantra of guidance takes: a name to '
          + 'meditate on, and a prayer to be led by it.',
      },
    ],
  },
  {
    slug: 'vishnu-gayatri',
    name: 'Vishnu Gayatri Mantra',
    category: 'gayatri',
    deity: 'vishnu',
    sanskrit: 'ॐ नारायणाय विद्महे वासुदेवाय धीमहि । तन्नो विष्णुः प्रचोदयात् ॥',
    transliteration: 'Oṁ Nārāyaṇāya Vidmahe Vāsudevāya Dhīmahi, Tanno Viṣṇuḥ Pracodayāt',
    standardCount: 3,
    displayOrder: 7,
    translations: [
      {
        languageCode: 'en',
        text: 'Om Narayanaya Vidmahe Vasudevaya Dhimahi, Tanno Vishnuh Prachodayat',
        meaning:
          'We meditate on Narayana, we contemplate the son of Vasudeva — may that Vishnu direct our '
          + 'understanding.',
        purport: null,
      },
    ],
  },
  {
    slug: 'pranava-om',
    name: 'Om (Pranava)',
    category: 'beej',
    sanskrit: 'ॐ',
    transliteration: 'Oṁ',
    standardCount: 108,
    displayOrder: 8,
    translations: [
      {
        languageCode: 'en',
        text: 'Om',
        meaning: 'The primal sound, said to hold every mantra within it — the seed the rest unfold from.',
        purport: 'Every Vedic mantra opens with it. Not a word so much as the sound of the whole itself, condensed.',
      },
    ],
  },
  {
    slug: 'om-namah-shivaya',
    name: 'Panchakshara Mantra',
    category: 'name',
    deity: 'shiva',
    sampradaya: 'shaiva',
    sanskrit: 'ॐ नमः शिवाय',
    transliteration: 'Oṁ Namaḥ Śivāya',
    standardCount: 108,
    displayOrder: 9,
    translations: [
      {
        languageCode: 'en',
        text: 'Om Namah Shivaya',
        meaning: 'Obeisances to Shiva — the "five-syllable" mantra (Namaḥ Śivāya), the most widely chanted in the Shaiva tradition.',
        purport:
          'Held to be the essence of the Rudram, and among the oldest mantras still in everyday use. Needs no '
          + 'occasion or request behind it — repeating the name itself is the practice.',
      },
    ],
  },
  {
    slug: 'maha-mrityunjaya-mantra',
    name: 'Maha Mrityunjaya Mantra',
    category: 'name',
    deity: 'shiva',
    sampradaya: 'shaiva',
    sanskrit: 'ॐ त्र्यम्बकं यजामहे सुगन्धिं पुष्टिवर्धनम् । उर्वारुकमिव बन्धनान्मृत्योर्मुक्षीय माऽमृतात् ॥',
    transliteration:
      "Oṁ Tryambakaṁ Yajāmahe Sugandhiṁ Puṣṭi-vardhanam, Urvārukam-iva Bandhanān Mṛtyor-mukṣīya Mā'mṛtāt",
    standardCount: 108,
    displayOrder: 10,
    translations: [
      {
        languageCode: 'en',
        text: "Om Tryambakam Yajamahe Sugandhim Pushti-vardhanam, Urvarukam-iva Bandhanan Mrityor-mukshiya Ma'mritat",
        meaning:
          'We worship the three-eyed Lord, fragrant and nourishing all — as a ripe cucumber is freed from its '
          + 'vine, may He free us from death, not from immortality.',
        purport:
          "Drawn from the Rig Veda, addressed to Shiva as Tryambaka, the three-eyed one. Called the "
          + "mrityunjaya, 'victory over death' — traditionally recited for healing, protection and long life.",
      },
    ],
  },
  {
    slug: 'shiva-gayatri',
    name: 'Shiva Gayatri Mantra',
    category: 'gayatri',
    deity: 'shiva',
    sampradaya: 'shaiva',
    sanskrit: 'ॐ तत्पुरुषाय विद्महे महादेवाय धीमहि । तन्नो रुद्रः प्रचोदयात् ॥',
    transliteration: 'Oṁ Tatpuruṣāya Vidmahe Mahādevāya Dhīmahi, Tanno Rudraḥ Pracodayāt',
    standardCount: 3,
    displayOrder: 11,
    translations: [
      {
        languageCode: 'en',
        text: 'Om Tatpurushaya Vidmahe Mahadevaya Dhimahi, Tanno Rudrah Prachodayat',
        meaning:
          'We meditate on the Supreme Being, we contemplate the great god — may that Rudra direct our '
          + 'understanding.',
        purport:
          'Built on the same Gayatri metre as the Krishna and Vishnu Gayatris, addressed here to Shiva under '
          + 'his Vedic name, Rudra.',
      },
    ],
  },
];

// ── Books ──────────────────────────────────────────────────────────────────
// Seeded unpublished, purely to reserve the book numbers. Those numbers are the
// first segment of every verse id and are already baked into the scraped source
// files, so they must not be handed out to anything else. The verses themselves
// arrive through the import.

const books = [
  {
    bookNumber: 1,
    slug: 'bhagavad-gita',
    type: 'SCRIPTURE',
    title: 'Bhagavad Gita',
    titleI18n: { hi: 'भगवद्गीता', mr: 'भगवद्गीता' },
    description: 'The song of the Lord, spoken to Arjuna on the field of Kurukshetra.',
    displayOrder: 1,
  },
  {
    bookNumber: 2,
    slug: 'srimad-bhagavatam',
    type: 'SCRIPTURE',
    title: 'Srimad Bhagavatam',
    titleI18n: { hi: 'श्रीमद्भागवतम्', mr: 'श्रीमद्भागवत' },
    description: 'The Bhagavata Purana, in twelve cantos.',
    displayOrder: 2,
  },
  // Short works: no chapters, no cantos — their verses hang directly off the
  // book (see backend/controllers/app/book.js's `verses` handler). Seeded as
  // empty, unpublished shells: the book numbers and slugs are reserved and the
  // library structure is wired end to end, but the actual verse-by-verse text
  // is deliberately left for a follow-up pass rather than typed from memory
  // here — devotional text this widely recited has to come from a checked
  // source, not be reconstructed.
  {
    bookNumber: 3,
    slug: 'hanuman-chalisa',
    type: 'STOTRA',
    title: 'Hanuman Chalisa',
    titleI18n: { hi: 'हनुमान चालीसा', mr: 'हनुमान चालीसा' },
    description: 'Forty verses in praise of Hanuman, composed by Goswami Tulsidas.',
    sourceLanguage: 'hi',
    deity: 'hanuman',
    displayOrder: 3,
  },
  {
    bookNumber: 4,
    slug: 'om-jai-jagdish-hare',
    type: 'AARTI',
    title: 'Om Jai Jagdish Hare',
    titleI18n: { hi: 'ॐ जय जगदीश हरे', mr: 'ॐ जय जगदीश हरे' },
    description: 'The most widely sung aarti to Vishnu, composed by Pandit Shraddha Ram Phillauri.',
    sourceLanguage: 'hi',
    deity: 'vishnu',
    displayOrder: 4,
  },
  {
    bookNumber: 5,
    slug: 'datta-mala-mantra',
    type: 'STOTRA',
    title: 'Datta Mala Mantra',
    titleI18n: { hi: 'दत्त माला मंत्र', mr: 'दत्त माला मंत्र' },
    description:
      'A garland of names in praise of Dattatreya, composed by Sri Vasudevananda Saraswati (Tembe Swami).',
    sourceLanguage: 'mr',
    deity: 'dattatreya',
    displayOrder: 5,
  },
  {
    bookNumber: 6,
    slug: 'prasadam-prayer',
    type: 'PRAYER',
    title: 'Prasadam Prayers',
    titleI18n: { hi: 'प्रसादम प्रार्थना' },
    description: 'The prayers offered before and after honouring Krishna prasadam.',
    sourceLanguage: 'sa',
    deity: 'krishna',
    displayOrder: 6,
  },
];

// Srimad Bhagavatam is the only book in the library organised by canto.
const cantos = [
  'Creation',
  'The Cosmic Manifestation',
  'The Status Quo',
  'The Creation of the Fourth Order',
  'The Creative Impetus',
  'Prescribed Duties for Mankind',
  'The Science of God',
  'Withdrawal of the Cosmic Creations',
  'Liberation',
  'The Summum Bonum',
  'General History',
  'The Age of Deterioration',
].map((title, index) => ({ number: index + 1, title }));

// ── Stories ────────────────────────────────────────────────────────────────
// Devotee pastimes, teaching cycles and stotras, curated out of Srimad
// Bhagavatam. `book` is always the book slug and `canto`/`chapter` locate the
// chapter each part is drawn from — resolved to ids in index.js. `issue` on a
// part is a vikara slug, only set where the lesson genuinely names one; most
// parts teach a virtue or a practice rather than answering a specific vikara,
// and are left unlinked rather than forced onto one.
//
// Verse ranges were checked against the seeded Bhaktivedanta translation
// (npm run seed:reels' sibling data), not reconstructed from memory alone.

const stories = [
  {
    slug: 'dattatreya-24-gurus',
    kind: 'GURU_LESSON',
    book: 'srimad-bhagavatam',
    canto: 11,
    title: 'The Twenty-Four Gurus of Dattatreya',
    description:
      'Questioned by King Yadu about how he became wise without ever taking a human initiating guru, the avadhūta Dattatreya answers by naming twenty-four teachers — the earth, the sky, a pigeon, a python, a child, a prostitute — and the one lesson learned from each. SB 11.7-9.',
    displayOrder: 1,
    // Each of the 24 is a self-contained lesson, unlike the Kavacha or Gajendra
    // stories below (read start to end) — so this is the one eligible for the
    // "today's guru" daily rotation.
    dailyEligible: true,
    parts: [
      { number: 1, chapter: 7, verseStart: 37, verseEnd: 38, title: 'The Earth', issue: 'krodha',
        description: 'Dug up, ploughed and walked over, the earth never turns from sustaining others. A sober person absorbs what is done to him the same way, without being pulled off his own path.' },
      { number: 2, chapter: 7, verseStart: 39, verseEnd: 41, title: 'The Air', issue: 'moha',
        description: 'The wind carries every kind of smell without mixing into any of them. A self-realized soul moves through the qualities of the body the same way — present, but not entangled.' },
      { number: 3, chapter: 7, verseStart: 42, verseEnd: 43, title: 'The Sky',
        description: 'Everything rests within the sky, yet nothing divides it or sticks to it. The self pervades the body it lives in without ever becoming what surrounds it.' },
      { number: 4, chapter: 7, verseStart: 44, verseEnd: 44, title: 'Water',
        description: 'Water cleanses whoever it touches, asking nothing in return. A saintly person purifies simply by being near, the way a holy place does.' },
      { number: 5, chapter: 7, verseStart: 45, verseEnd: 47, title: 'Fire',
        description: 'Fire burns whatever is offered to it and is never dirtied by what it consumes. One sheltered by the Lord is not stained by what passes through his life.' },
      { number: 6, chapter: 7, verseStart: 48, verseEnd: 49, title: 'The Moon',
        description: 'The moon only appears to wax and wane — the moon itself never changes. The body passes through birth, growth and decay; the self within it does not.' },
      { number: 7, chapter: 7, verseStart: 50, verseEnd: 51, title: 'The Sun', issue: 'lobha',
        description: 'The sun draws water up only to return it as rain, keeping nothing back. Accept what the world offers, and give it back in turn, without ever becoming divided by the exchange.' },
      { number: 8, chapter: 7, verseStart: 52, verseEnd: 74, title: 'The Pigeon', issue: 'moha',
        description: 'A pigeon so bound to his mate and chicks that he flew into the hunter’s net to die alongside them. Excessive attachment to a household ends the same way for anyone who mistakes it for the whole of life.' },
      { number: 9, chapter: 8, verseStart: 1, verseEnd: 4, title: 'The Python', issue: 'lobha',
        description: 'The python does not go looking for food; it stays still and takes only what comes, fasting without complaint when nothing does. Peace needs far less striving than fear insists it does.' },
      { number: 10, chapter: 8, verseStart: 5, verseEnd: 6, title: 'The Ocean', issue: 'lobha',
        description: 'Flooded by monsoon rivers or thinned by summer drought, the ocean neither swells nor shrinks. A devotee of the Lord stays the same in plenty and in want.' },
      { number: 11, chapter: 8, verseStart: 7, verseEnd: 8, title: 'The Moth', issue: 'kama',
        description: 'A moth maddened by a flame flies straight into it. A mind fixed on a beautiful form loses its judgment exactly as blindly.' },
      { number: 12, chapter: 8, verseStart: 9, verseEnd: 12, title: 'The Honeybee', issue: 'lobha',
        description: 'A bee takes only a little nectar from each flower and stores nothing for tomorrow. Take only what the day requires — what is hoarded becomes the reason for its own loss.' },
      { number: 13, chapter: 8, verseStart: 13, verseEnd: 14, title: 'The Elephant', issue: 'kama',
        description: 'A wild elephant, drawn to touch a decoy, walks straight into the trap built for it. The sense of touch alone is enough to undo a life otherwise well guarded.' },
      { number: 14, chapter: 8, verseStart: 15, verseEnd: 16, title: 'The Honey Thief', issue: 'lobha',
        description: 'Honey a bee spent its life gathering is carried off by the first hunter who finds the hive. Wealth piled up through hard struggle rarely stays with the one who piled it.' },
      { number: 15, chapter: 8, verseStart: 17, verseEnd: 18, title: 'The Deer', issue: 'kama',
        description: 'A deer entranced by a hunter’s horn walks toward the very sound that kills it. The ear is as dangerous a door as any other sense.' },
      { number: 16, chapter: 8, verseStart: 19, verseEnd: 21, title: 'The Fish', issue: 'lobha',
        description: 'A fish takes the hook for the taste alone, before it notices anything is wrong. Of all the senses, the tongue is the one most often left unguarded.' },
      { number: 17, chapter: 8, verseStart: 22, verseEnd: 44, title: 'The Prostitute Piṅgalā', issue: 'kama',
        description: 'Piṅgalā waited all night for a customer who never came, and in her exhaustion realized the only one worth waiting for was the Lord within her own heart. The collapse of a false hope can be the start of the only true one.' },
      { number: 18, chapter: 9, verseStart: 1, verseEnd: 2, title: 'The Kurara Bird', issue: 'matsarya',
        description: 'A hawk carrying meat was attacked by every stronger bird nearby until it dropped what it held — and only then was it free. What gets fought over rarely deserves the fight.' },
      { number: 19, chapter: 9, verseStart: 3, verseEnd: 4, title: 'The Child', issue: 'moha',
        description: 'A child with no property and no reputation to guard is somehow the most carefree person around. Freedom looks a great deal like having nothing left to lose.' },
      { number: 20, chapter: 9, verseStart: 5, verseEnd: 10, title: 'The Young Girl and Her Bangles',
        description: 'A girl husking rice removed her bangles one at a time until only one remained on each wrist — quiet enough to work undisturbed. A crowded mind is exactly this noisy; a solitary one is not.' },
      { number: 21, chapter: 9, verseStart: 11, verseEnd: 13, title: 'The Arrow-Maker',
        description: 'An arrow-maker was so absorbed in straightening his arrow that a king walked right past him unnoticed. That same one-pointed attention, turned toward the Lord, is what meditation actually asks for.' },
      { number: 22, chapter: 9, verseStart: 14, verseEnd: 15, title: 'The Serpent', issue: 'moha',
        description: 'A snake builds no home of its own; it simply moves into a hole another creature dug. Trying to build a lasting, happy home in a temporary world is the harder and less honest path.' },
      { number: 23, chapter: 9, verseStart: 16, verseEnd: 21, title: 'The Spider',
        description: 'A spider spins its web out of its own body, plays across it, and swallows it back in. The Lord brings this entire universe out of Himself the same way, and draws it back the same way.' },
      { number: 24, chapter: 9, verseStart: 22, verseEnd: 23, title: 'The Wasp',
        description: 'A weaker insect, trapped and terrified by a wasp, thought of nothing else until it took on the wasp’s own nature. Whatever the mind fixes on with total attention, it eventually becomes.' },
    ],
  },
  {
    slug: 'narayana-kavacha',
    kind: 'KAVACHA',
    book: 'srimad-bhagavatam',
    canto: 6,
    title: 'Narayana Kavacha',
    description:
      'A protective armor of prayers that Vishvarupa gives to Indra: each line calls on a different form of the Lord to guard one part of the body, one hour of the day, one kind of danger. Traditionally recited each morning. SB 6.8.',
    displayOrder: 2,
    parts: [
      { number: 1, chapter: 8, verseStart: 7, verseEnd: 11, title: 'The Mantra',
        description: 'The twelve-syllable mantra — oṃ namo bhagavate vāsudevāya — recited before anything else, the foundation the rest of the armor is built on.' },
      { number: 2, chapter: 8, verseStart: 12, verseEnd: 12, title: 'The Eight Weapons',
        description: 'Seated on Garuda and touching him with His feet, the Lord holds eight weapons in eight hands, matching His eight mystic powers — invoked here for protection at every moment.' },
      { number: 3, chapter: 8, verseStart: 13, verseEnd: 13, title: 'Matsya, Vamana and Vishvarupa',
        description: 'The fish form guards in water, the dwarf Vamana guards on land, and the cosmic Vishvarupa, who spans the three worlds, guards in the sky.' },
      { number: 4, chapter: 8, verseStart: 14, verseEnd: 14, title: 'Nrisimha',
        description: 'Nrisimha, who tore apart Hiranyakashipu, guards every direction — his roar alone is said to have terrified the wives of the asuras.' },
      { number: 5, chapter: 8, verseStart: 15, verseEnd: 15, title: 'Varaha, Parashurama and Rama-Lakshmana',
        description: 'The Boar who raised the earth on His tusks guards against street thieves; Parashurama guards mountaintops; Rama and Lakshmana guard in foreign lands.' },
      { number: 6, chapter: 8, verseStart: 16, verseEnd: 16, title: 'Narayana, Nara, Dattatreya and Kapila', issue: 'mada',
        description: 'Nara is asked directly to guard against unnecessary pride; Narayana guards against drifting from duty into false paths; Dattatreya guards a bhakti practice from failing; Kapila guards against bondage to one’s own work.' },
      { number: 7, chapter: 8, verseStart: 17, verseEnd: 17, title: 'Sanat-kumara, Hayagriva, Narada and Kurma', issue: 'kama',
        description: 'Sanat-kumara is named directly against lust; Hayagriva guards against neglecting to bow to the Lord; Narada guards against errors in worship; Kurma guards against falling toward the hellish planes.' },
      { number: 8, chapter: 8, verseStart: 18, verseEnd: 18, title: 'Dhanvantari, Rishabhadeva, Yajna and Balarama',
        description: 'Dhanvantari guards health and diet; Rishabhadeva, master of his own senses, guards against the discomfort of heat and cold; Yajna guards reputation; Balarama as Shesha guards against venomous creatures.' },
      { number: 9, chapter: 8, verseStart: 19, verseEnd: 19, title: 'Vyasadeva, Buddha and Kalki',
        description: 'Vyasadeva guards against ignorance of the Vedic teaching, Buddha against forgetting it out of laziness, and Kalki — still to come — against the corruption of this age.' },
      { number: 10, chapter: 8, verseStart: 20, verseEnd: 20, title: 'Kesava to Vishnu — the Day’s First Half',
        description: 'Four forms of the Lord divide the first half of the day between them, from Kesava in its first portion to Vishnu carrying His disc in the fourth.' },
      { number: 11, chapter: 8, verseStart: 21, verseEnd: 21, title: 'Madhusudana to Padmanabha — Evening and Early Night',
        description: 'Past sunset, the armor names a form of the Lord for the evening, for the start of night, and for its depth.' },
      { number: 12, chapter: 8, verseStart: 22, verseEnd: 22, title: 'Srivatsa to Vishveshvara — Before Dawn',
        description: 'The last watch of night, the hour before sunrise, early morning and the dawn twilight are each placed under a named form of the Lord — no hour of the day or night is left unguarded.' },
      { number: 13, chapter: 8, verseStart: 23, verseEnd: 23, title: 'The Sudarshana Disc',
        description: 'Set in motion by the Lord and reaching every direction, the discus is asked to burn enemies to ash the way fire burns dry grass.' },
      { number: 14, chapter: 8, verseStart: 24, verseEnd: 24, title: 'The Club',
        description: 'The Lord’s club, throwing off sparks like thunderbolts, is asked to pound apart the ghosts and spirits that trouble a devotee.' },
      { number: 15, chapter: 8, verseStart: 25, verseEnd: 25, title: 'The Conch, Panchajanya',
        description: 'Filled always with the Lord’s own breath, the conch’s sound alone is said to make the hearts of ghosts and demons tremble.' },
      { number: 16, chapter: 8, verseStart: 26, verseEnd: 28, title: 'The Sword and Shield',
        description: 'The Lord’s sword is asked to cut down the enemy’s ranks; His shield, marked with a hundred moons, to blind their sinful eyes.' },
      { number: 17, chapter: 8, verseStart: 29, verseEnd: 29, title: 'Garuda and Vishvaksena',
        description: 'As powerful as the Lord Himself and worshiped as the Vedas personified, Garuda is asked to guard against every danger, alongside Vishvaksena.' },
      { number: 18, chapter: 8, verseStart: 30, verseEnd: 30, title: 'Names, Forms and Weapons',
        description: 'The Lord’s holy names, His forms, His carriers and every weapon that decorates Him are together asked to guard the intelligence, the senses, the mind and the breath.' },
      { number: 19, chapter: 8, verseStart: 31, verseEnd: 33, title: 'The One Cause Behind Every Form',
        description: 'Because the entire cosmic manifestation is nothing but an expression of the one Supreme cause, any single one of His potencies is enough, on its own, to end any danger.' },
      { number: 20, chapter: 8, verseStart: 34, verseEnd: 34, title: 'Nrisimha’s Roar for Prahlada',
        description: 'Invoking the same roar that once answered Prahlada’s cry, the armor asks Nrisimha to guard from every direction against poison, weapon, fire and water.' },
      { number: 21, chapter: 8, verseStart: 35, verseEnd: 42, title: 'The Fruit of the Armor',
        description: 'Vishvarupa closes by promising that whoever wears this armor, or simply hears it recited with faith, cannot be touched by ghosts, poison, weapons, disease or fear — and tells of Indra receiving it directly.' },
    ],
  },
  {
    slug: 'prahlada-maharaja',
    kind: 'DEVOTEE_STORY',
    book: 'srimad-bhagavatam',
    canto: 7,
    title: 'Prahlada Maharaja',
    description:
      'Born to the tyrant Hiranyakashipu, who has made himself all but invincible, Prahlada is a devotee from the womb — and nothing his father does, from poison to the executioner\'s tusks, can shake him loose from it. His story ends with the Lord bursting out of a palace pillar as Nrisimha. SB 7.4-9.',
    displayOrder: 4,
    parts: [
      { number: 1, chapter: 4, verseStart: 30, verseEnd: 46, title: 'A Devotee Born to a Tyrant',
        description: 'Made virtually invincible by a boon from Brahma, Hiranyakashipu grows drunk on his own power — while his own son Prahlada, born into the same demon dynasty, is absorbed in Krishna from infancy and wants nothing his father has to offer.' },
      { number: 2, chapter: 5, verseStart: 2, verseEnd: 33, title: 'Taught to Hate, Teaching Love',
        description: 'Sent to be trained in statecraft and enmity toward Vishnu, Prahlada instead answers his teachers with devotion, and no threat from his own father — scolding, poison, weapons — moves him from it.' },
      { number: 3, chapter: 7, verseStart: 21, verseEnd: 55, title: 'What Prahlada Taught His Classmates',
        description: 'Left alone with the other demons’ sons, Prahlada teaches them what his own teachers never did: that the body does not last, that fear ends only in surrender to the Supreme, and that a short life is enough time to begin.' },
      { number: 4, chapter: 8, verseStart: 5, verseEnd: 34, title: 'Nrisimha Breaks Through the Pillar',
        description: 'Asked to show where his God is, Prahlada says even the pillar holds Him — and Hiranyakashipu, striking it himself, brings forth Nrisimha, who kills him at the one moment every boon meant to make him unkillable had failed to rule out: twilight, on a threshold, on the Lord’s own lap.' },
      { number: 5, chapter: 9, verseStart: 5, verseEnd: 54, title: 'Prahlada’s Prayer',
        description: 'With Nrisimha still raging and no god able to approach Him, the demigods send the child Prahlada forward. His prayer — asking nothing for himself, only that the Lord’s anger end — is what finally calms Him.' },
    ],
  },
  {
    slug: 'gajendra-moksha',
    kind: 'DEVOTEE_STORY',
    book: 'srimad-bhagavatam',
    canto: 8,
    title: 'Gajendra Moksha — The Elephant’s Surrender',
    description:
      'Gajendra, king of the elephants, is seized by a crocodile while bathing and fights for years before understanding that no friend or family member can save him — only the Lord can. His cry of surrender is one of the most quoted prayers in the Bhagavatam. SB 8.2-4.',
    displayOrder: 3,
    parts: [
      { number: 1, chapter: 2, verseStart: 20, verseEnd: 33, title: 'Caught',
        description: 'Gajendra wanders into a lake with his herd and is seized by the leg by a crocodile. He fights for years, and when even his own family cannot free him, he understands the limit of what any of them can do for him.' },
      { number: 2, chapter: 3, verseStart: 1, verseEnd: 29, title: 'The Surrender',
        description: 'Past his own strength, Gajendra stops struggling and instead offers a prayer of pure surrender to the Supreme — remembered since as the Gajendra Stuti.' },
      { number: 3, chapter: 4, verseStart: 1, verseEnd: 16, title: 'The Rescue',
        description: 'The Lord arrives at once on Garuda and kills the crocodile, freeing Gajendra — who turns out to have been a devoted king in a former life, and the crocodile a Gandharva under a sage’s curse.' },
    ],
  },
];

// ── Subscription plans ─────────────────────────────────────────────────────
// Tiers, their prices per store, and the feature catalogue with a value per
// plan. Price in paise, never a float. Product ids are placeholders for the
// ones created in the Play Console and App Store Connect — edit them in the
// panel (Plans) once the products exist. Seeded once and never overwritten:
// after that the panel is the source of truth.

const plans = [
  {
    slug: 'free',
    name: 'Free',
    description: 'The whole app. Nothing a reader needs is behind a paywall.',
    tier: 0,
    isFree: true,
    isActive: true,
    prices: [],
  },
  {
    slug: 'premium',
    name: 'Premium',
    description: 'Supports the project, and adds a few extras on top of everything that is already free.',
    tier: 1,
    grantedToDonors: true,
    isActive: true,
    prices: [
      { provider: 'GOOGLE_PLAY', productId: 'premium_monthly', priceMinor: 9900, currency: 'INR', periodDays: 30 },
      { provider: 'APPLE_APP_STORE', productId: 'premium_monthly', priceMinor: 9900, currency: 'INR', periodDays: 30 },
    ],
  },
];

// A few starting benefits. More arrive as features are built — each is a row
// here (or added from the panel) plus values on the plans.
const features = [
  {
    key: 'ads.removed',
    name: 'Ad-free',
    description: 'No advertising anywhere in the app.',
    kind: 'FLAG',
    sortOrder: 10,
    values: { free: { enabled: false }, premium: { enabled: true } },
  },
  {
    key: 'supporter.badge',
    name: 'Supporter badge',
    description: 'A badge on your profile.',
    kind: 'FLAG',
    sortOrder: 20,
    values: { free: { enabled: false }, premium: { enabled: true } },
  },
];

// ── Push topics ────────────────────────────────────────────────────────────

const topics = [
  {
    key: 'sloka-of-day',
    name: 'Sloka of the day',
    description: 'The global daily verse. One call to Firebase reaches everyone subscribed.',
  },
  {
    key: 'announcements',
    name: 'Announcements',
    description: 'Occasional news about the app.',
  },
];

// ── Settings ───────────────────────────────────────────────────────────────
// Only values that must change without a deploy. API keys are not seeded — they
// are entered from the panel and stored encrypted.

const settings = [
  { key: SETTING_KEYS.AI_PROVIDER, value: 'GEMINI' },
  { key: SETTING_KEYS.AI_MODEL_TEXT, value: 'gemini-2.0-flash' },
  // 0 means no cap. Set one before running a batch pass.
  { key: SETTING_KEYS.AI_MONTHLY_BUDGET_MICROS, value: '0' },
  { key: SETTING_KEYS.SLOKA_DELIVERY_HOUR, value: '6' },
  { key: SETTING_KEYS.SIGNUP_ENABLED, value: 'true' },
];

export {
  roles,
  permissions,
  languages,
  issues,
  deities,
  gurus,
  translators,
  mantras,
  books,
  cantos,
  stories,
  plans,
  features,
  topics,
  settings,
};
