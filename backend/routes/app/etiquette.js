import { createRouter, schemas, z } from '../../utils/router.js';
import * as controller from '../../controllers/app/etiquette.js';
import { CATEGORY_IDS } from '../../config/etiquette.js';

const router = createRouter({
  tag: 'Devotee etiquette',
  prefix: '/etiquette',
  description:
    'Short, respectful guidance for every devotee — how to enter a temple, offer prasad, speak of the Lord and His devotees — each with ' +
    'its source. One is sent as a push every morning at 07:15 on the reader’s own clock. Only published items are served, in the ' +
    'reader’s reading language (English where a translation does not exist yet).',
});

const languages = { languages: schemas.languages };

router.get(
  '/today',
  {
    summary: 'The day’s etiquette',
    description: 'The item for the reader’s local date — the same one the morning push carried. `item` is null when nothing is published.',
    limit: 'read',
    query: z.object(languages),
    responds: { 200: 'The date and the item' },
  },
  controller.today
);

router.get(
  '/',
  {
    summary: 'List the etiquette',
    description: 'Published items in reading order with their title and summary, and the categories that have any. `category` narrows the items.',
    limit: 'read',
    query: z.object({ category: z.enum(CATEGORY_IDS).optional(), ...languages }),
    responds: { 200: 'Categories and items' },
  },
  controller.list
);

router.get(
  '/:id',
  { summary: 'One etiquette in full', limit: 'read', params: schemas.id, query: z.object(languages), responds: { 200: 'The item, with its source', 404: 'No such published item' } },
  controller.get
);

export default router;
