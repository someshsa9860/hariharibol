// The verses behind the standard routine's reminders.
//
// The app schedules a local notification for each standard routine of the day (wake up,
// chanting, meals, reading, sleep). The notification's title is the task's name and its body
// is one of the verses below, so the reminder itself carries something to act on. A kind has
// a few verses and the app takes a different one each day.
//
// `kind` is the app's own key for a routine (`RoutinePreset` in app/lib/core/constants/
// routine_presets.dart) — a new one needs both sides. `verseId` is the verse's `Verse.verseId`
// ("1.2.69" is Bhagavad-gita 2.69; Bhagavatam is "2.<canto>.<chapter>.<verse>"). It is a soft
// link: when the verse has been imported its translation in the reader's language is used,
// and `text` — Śrīla Prabhupāda's English translation — is what is shown otherwise.
//
// `voice` is the line a later job will speak, with {name} for the person ("Hari Bol Somesh,
// ..."). Nothing plays it yet.
//
// To add one, add an entry here and run `npm run seed`. Order within a kind is the order of
// the list; positions are never reused for a different verse, so append rather than insert.

export const routineKinds = [
  {
    kind: 'wakeUp',
    voice: 'Hari Bol {name}! A new day has begun. It is time to wake up and remember Krishna.',
    verses: [
      {
        verseId: '1.2.69',
        reference: 'Bhagavad-gita 2.69',
        text: 'What is night for all beings is the time of awakening for the self-controlled; and the time of awakening for all beings is night for the introspective sage.',
      },
      {
        verseId: '1.6.17',
        reference: 'Bhagavad-gita 6.17',
        text: 'He who is regulated in his habits of eating, sleeping, recreation and work can mitigate all material pains by practicing the yoga system.',
      },
    ],
  },
  {
    kind: 'morningChant',
    voice: 'Hari Bol {name}! It is time for your morning chanting. Sit comfortably and begin.',
    verses: [
      {
        verseId: '1.9.14',
        reference: 'Bhagavad-gita 9.14',
        text: 'Always chanting My glories, endeavoring with great determination, bowing down before Me, these great souls perpetually worship Me with devotion.',
      },
      {
        verseId: '2.12.3.51',
        reference: 'Srimad-Bhagavatam 12.3.51',
        text: 'My dear King, although Kali-yuga is full of faults, there is still one good quality about this age: simply by chanting the Hare Krishna maha-mantra, one can become free from material bondage and be promoted to the transcendental kingdom.',
      },
    ],
  },
  {
    kind: 'exercise',
    voice: 'Hari Bol {name}! Time to take care of the body Krishna has given you.',
    verses: [
      {
        verseId: '1.3.8',
        reference: 'Bhagavad-gita 3.8',
        text: "Perform your prescribed duty, for doing so is better than not working. One cannot even maintain one's physical body without work.",
      },
      {
        verseId: '1.6.16',
        reference: 'Bhagavad-gita 6.16',
        text: "There is no possibility of one's becoming a yogi, O Arjuna, if one eats too much or eats too little, sleeps too much or does not sleep enough.",
      },
    ],
  },
  {
    kind: 'breakfast',
    voice: 'Hari Bol {name}! Offer your breakfast to Krishna before you eat.',
    verses: [
      {
        verseId: '1.9.26',
        reference: 'Bhagavad-gita 9.26',
        text: 'If one offers Me with love and devotion a leaf, a flower, fruit or water, I will accept it.',
      },
      {
        verseId: '1.17.8',
        reference: 'Bhagavad-gita 17.8',
        text: "Foods dear to those in the mode of goodness increase the duration of life, purify one's existence and give strength, health, happiness and satisfaction. Such foods are juicy, fatty, wholesome, and pleasing to the heart.",
      },
    ],
  },
  {
    kind: 'lunch',
    voice: 'Hari Bol {name}! Lunch time. Offer your food to Krishna and take prasadam.',
    verses: [
      {
        verseId: '1.3.13',
        reference: 'Bhagavad-gita 3.13',
        text: 'The devotees of the Lord are released from all kinds of sins because they eat food that is offered first for sacrifice. Others, who prepare food for personal sense enjoyment, verily eat only sin.',
      },
      {
        verseId: '1.9.26',
        reference: 'Bhagavad-gita 9.26',
        text: 'If one offers Me with love and devotion a leaf, a flower, fruit or water, I will accept it.',
      },
    ],
  },
  {
    kind: 'breakChant',
    voice: 'Hari Bol {name}! Take a short break from the day and chant a few rounds. Then tell me how many you chanted.',
    verses: [
      {
        verseId: '1.6.26',
        reference: 'Bhagavad-gita 6.26',
        text: 'From whatever and wherever the mind wanders due to its flickering and unsteady nature, one must certainly withdraw it and bring it back under the control of the Self.',
      },
      {
        verseId: '1.8.5',
        reference: 'Bhagavad-gita 8.5',
        text: 'And whoever, at the end of his life, quits his body, remembering Me alone, at once attains My nature. Of this there is no doubt.',
      },
    ],
  },
  {
    kind: 'eveningChant',
    voice: 'Hari Bol {name}! The evening is the time to remember Krishna. Begin your chanting.',
    verses: [
      {
        verseId: '1.8.14',
        reference: 'Bhagavad-gita 8.14',
        text: "For one who remembers Me without deviation, I am easy to obtain, O son of Pritha, because of his constant engagement in devotional service.",
      },
      {
        verseId: '1.8.7',
        reference: 'Bhagavad-gita 8.7',
        text: 'Therefore, Arjuna, you should always think of Me in the form of Krishna and at the same time carry out your prescribed duty of fighting. With your activities dedicated to Me and your mind and intelligence fixed on Me, you will attain Me without doubt.',
      },
    ],
  },
  {
    kind: 'dinner',
    voice: 'Hari Bol {name}! Dinner is ready. Offer it to Krishna, then take prasadam gratefully.',
    verses: [
      {
        verseId: '1.3.13',
        reference: 'Bhagavad-gita 3.13',
        text: 'The devotees of the Lord are released from all kinds of sins because they eat food that is offered first for sacrifice. Others, who prepare food for personal sense enjoyment, verily eat only sin.',
      },
      {
        verseId: '1.17.8',
        reference: 'Bhagavad-gita 17.8',
        text: "Foods dear to those in the mode of goodness increase the duration of life, purify one's existence and give strength, health, happiness and satisfaction. Such foods are juicy, fatty, wholesome, and pleasing to the heart.",
      },
    ],
  },
  {
    kind: 'scriptureReading',
    voice: 'Hari Bol {name}! Time to read a little from the scriptures.',
    verses: [
      {
        verseId: '1.18.70',
        reference: 'Bhagavad-gita 18.70',
        text: 'And I declare that he who studies this sacred conversation of ours worships Me by his intelligence.',
      },
      {
        verseId: '1.4.38',
        reference: 'Bhagavad-gita 4.38',
        text: 'In this world, there is nothing so sublime and pure as transcendental knowledge. Such knowledge is the mature fruit of all mysticism. And one who has become accomplished in the practice of devotional service enjoys this knowledge within himself in due course of time.',
      },
    ],
  },
  {
    kind: 'sleep',
    voice: 'Hari Bol {name}! The day is done. Remember Krishna, and rest well.',
    verses: [
      {
        verseId: '1.6.17',
        reference: 'Bhagavad-gita 6.17',
        text: 'He who is regulated in his habits of eating, sleeping, recreation and work can mitigate all material pains by practicing the yoga system.',
      },
      {
        verseId: '1.18.65',
        reference: 'Bhagavad-gita 18.65',
        text: 'Always think of Me, become My devotee, worship Me and offer your homage unto Me. Thus you will come to Me without fail. I promise you this because you are My very dear friend.',
      },
    ],
  },
];

// What tapping each kind's alert opens (`RoutineKind.opensKind` / `prayerSlug`). The migration
// 20261115000000_routine_open_target sets the same for the seeded kinds, so this is for a fresh database
// and for a change made here. A kind not listed opens nothing.
export const opensByKind = {
  breakfast: { opensKind: 'prayer', prayerSlug: 'prasada-sevaya' },
  lunch: { opensKind: 'prayer', prayerSlug: 'prasada-sevaya' },
  dinner: { opensKind: 'prayer', prayerSlug: 'prasada-sevaya' },
  morningChant: { opensKind: 'chant', prayerSlug: null },
  breakChant: { opensKind: 'chant', prayerSlug: null },
  eveningChant: { opensKind: 'chant', prayerSlug: null },
  scriptureReading: { opensKind: 'read', prayerSlug: null },
};
