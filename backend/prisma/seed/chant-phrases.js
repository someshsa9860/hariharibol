// How each mantra may sound when it is chanted, for auto count in the app.
//
// The app listens with an on-device speech recogniser trained on English, turns
// what it hears into letters, and counts a repetition when those letters match
// one of a mantra's phrases at least ~50% (stricter for very short mantras —
// see app/lib/services/mantra_phrase_matcher.dart). So fast or slurred chanting,
// or a character the recogniser drops, still counts.
//
// Each entry is one FULL repetition in plain Roman letters, no diacritics:
//   1. the standard transliteration, then
//   2. looser spellings of how it tends to be heard (Hari for Hare, Naraina
//      for Narayana …). Two or three is plenty — matching is already tolerant.
// A mantra with no entry here falls back to its `transliteration` in the app.

export const chantPhrases = {
  'hare-krishna-mahamantra': [
    'Hare Krishna Hare Krishna Krishna Krishna Hare Hare Hare Rama Hare Rama Rama Rama Hare Hare',
    'Hari Krishna Hari Krishna Krishna Krishna Hari Hari Hari Rama Hari Rama Rama Rama Hari Hari',
    'Hare Krishna Hare Krishna Krishna Krishna Hare Hare Hare Ram Hare Ram Ram Ram Hare Hare',
  ],
  'panchatattva-mantra': [
    'Sri Krishna Chaitanya Prabhu Nityananda Sri Advaita Gadadhara Srivasadi Gaura Bhakta Vrinda',
    'Shri Krishna Chaitanya Prabhu Nityananda Shri Advaita Gadadhar Shrivasadi Gaura Bhakta Vrinda',
  ],
  'om-namo-bhagavate-vasudevaya': [
    'Om Namo Bhagavate Vasudevaya',
    'Om Namo Bhagwate Vasudevay',
    'Om Namo Bhagavate Vaasudevaaya',
  ],
  'rama-taraka-mantra': [
    'Sri Rama Jaya Rama Jaya Jaya Rama',
    'Shri Ram Jai Ram Jai Jai Ram',
  ],
  'nrisimha-mantra': [
    'Ugram Viram Maha Vishnum Jvalantam Sarvato Mukham Nrisimham Bhishanam Bhadram Mrityu Mrityum Namamyaham',
    'Ugram Veeram Maha Vishnum Jwalantam Sarvato Mukham Narasimham Bheeshanam Bhadram Mrityu Mrityum Namamyaham',
  ],
  'krishna-gayatri': [
    'Om Devakinandanaya Vidmahe Vasudevaya Dhimahi Tanno Krishnah Prachodayat',
    'Om Devaki Nandanaya Vidmahe Vasudevaya Dheemahi Tanno Krishna Prachodayat',
  ],
  'vishnu-gayatri': [
    'Om Narayanaya Vidmahe Vasudevaya Dhimahi Tanno Vishnuh Prachodayat',
    'Om Narayanaya Vidmahe Vasudevaya Dheemahi Tanno Vishnu Prachodayat',
  ],
  'pranava-om': ['Om', 'Aum'],
  'om-namah-shivaya': [
    'Om Namah Shivaya',
    'Om Namaha Shivaya',
    'Om Nama Shivay',
  ],
  'maha-mrityunjaya-mantra': [
    'Om Tryambakam Yajamahe Sugandhim Pushtivardhanam Urvarukamiva Bandhanan Mrityor Mukshiya Mamritat',
    'Om Trayambakam Yajamahe Sugandhim Pushti Vardhanam Urvarukamiva Bandhanat Mrityor Mukshiya Maamritat',
  ],
  'shiva-gayatri': [
    'Om Tatpurushaya Vidmahe Mahadevaya Dhimahi Tanno Rudrah Prachodayat',
    'Om Tatpurushaya Vidmahe Mahadevaya Dheemahi Tanno Rudra Prachodayat',
  ],
};
