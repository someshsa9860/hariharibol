// Prasāda and food: offering before eating, receiving prasāda, and keeping the table clean and shared.

import { by, names, from } from './sources.js';

export default [
  {
    slug: 'offer-before-you-eat',
    title: 'Offer before you eat',
    summary: 'Offer your food to the Lord first, and eat only what has been offered.',
    body: 'Food becomes prasāda, the Lord’s mercy, when it is first offered to Him with love. The Nectar of Devotion lists eating anything that has not first been offered to Kṛṣṇa, and giving cooked food to anyone before it has been offered to the Deity, among the offenses to avoid. A short prayer before the meal is enough to begin.',
    reference: 'The Nectar of Devotion, ch. 8: offenses 25 and 27',
    author: by.scripture,
    ...from.nod,
  },
  {
    slug: 'cook-for-krishna',
    title: 'Cook for Kṛṣṇa, not only for yourself',
    summary: 'The Gītā says those who cook only for themselves eat sin, and those who eat what was offered are freed from it.',
    body: 'In Bhagavad-gītā 3.13 Kṛṣṇa says that people who eat food offered in sacrifice are freed from all kinds of wrong, while those who cook only for their own senses are in effect eating what is wrong. Let your kitchen be a place of offering, and cook with the thought of whom the meal is for.',
    reference: 'Bhagavad-gītā 3.13',
    author: by.krishna,
    ...from.bg313,
  },
  {
    slug: 'accept-prasada-with-gratitude',
    title: 'Accept prasāda with reverence',
    summary: 'When the priest gives you prasāda, accept it with your right hand and receive it with reverence.',
    body: 'Prasāda is blessed vegetarian food, offered to the deities and given back to devotees as the Lord’s mercy. The Hindu Temple of Atlanta asks visitors to accept it from the priests, with the right hand. The Sydney temple’s guidelines describe taking it reverentially in a cupped right hand before eating. Eat it with attention, and with thanks in your heart.',
    reference: 'Hindu Temple of Atlanta; Sri Venkateswara Temple, Sydney (visitor guidelines)',
    author: names(by.atlanta, by.sydney),
    ...from.atlanta,
  },
  {
    slug: 'eat-only-prasada-in-the-temple',
    title: 'In the temple, eat only prasāda',
    summary: 'Do not bring food or drink into the temple. Eat only the prasāda that is given there.',
    body: 'The temple hall is a place of worship, and outside food and drink do not belong in it. Keep your snacks and bottles in the car or in the place provided, and take only what the temple offers as prasāda. Several temples state this in their visitor rules.',
    reference: 'Sri Venkateswara Temple, Sydney; BAPS Shri Swaminarayan Mandir, London (visitor guidelines)',
    author: names(by.sydney, by.baps),
    ...from.sydney,
  },
  {
    slug: 'keep-the-food-vegetarian',
    title: 'Keep the food vegetarian',
    summary: 'Prasāda is vegetarian food. Do not bring meat or non-vegetarian food to the temple.',
    body: 'The food offered to the Lord and given to devotees is vegetarian, and temples ask visitors not to bring meat or anything non-vegetarian onto their grounds. If you invite friends to a meal after a visit, a vegetarian table is the natural way to honor the occasion.',
    reference: 'Hindu Temple of Atlanta; Sri Venkateswara Temple, Sydney (visitor guidelines)',
    author: names(by.atlanta, by.sydney),
    ...from.sydney,
  },
  {
    slug: 'share-what-you-have',
    title: 'Share what you have been given',
    summary: 'Share your food fairly with others, and do not eat everything yourself.',
    body: 'Nārada’s list of good qualities in the Bhāgavatam includes charity and distributing food to all living beings, people and animals alike. If you receive prasāda, share it with whoever is near you. A meal eaten together, or given away, is richer than one eaten alone.',
    reference: 'Śrīmad-Bhāgavatam 7.11.8–12',
    author: by.narada,
    ...from.sb711,
  },
  {
    slug: 'wash-after-eating-before-worship',
    title: 'Wash after eating, before worship',
    summary: 'If you have eaten, wash your hands and feet before you go back to the Deity.',
    body: 'Food leaves its mark on the hands. Before you go back to worship after a meal, wash your hands and feet. The Nectar of Devotion lists entering to worship without washing the hands and feet after eating among the offenses to avoid.',
    reference: 'The Nectar of Devotion, ch. 8: offense 4',
    author: by.scripture,
    ...from.nod,
  },
];
