import { createRouter, schemas, z } from '../../utils/router.js';
import * as controller from '../../controllers/app/prayer.js';

const router = createRouter({
  tag: 'Prayers',
  prefix: '/prayers',
  description:
    'Stotras, aartis and prayers, each verse written in its own script (Devanagari or a regional one) with a collapsible meaning. ' +
    'A prayer lists the scripts a reader can see it in: its own, ones the phone converts from Devanagari (`rule`), and ones written ' +
    'out ahead of time (`stored`). Only published prayers are served, in the reader’s reading language (English where a ' +
    'translation does not exist yet).',
});

const languages = { languages: schemas.languages };

router.get(
  '/',
  {
    summary: 'List the prayers',
    description: 'Published prayers in reading order with their title, summary and number of verses, and the categories that have any.',
    limit: 'read',
    query: z.object(languages),
    responds: { 200: 'Categories and prayers' },
  },
  controller.list
);

router.get(
  '/:id',
  {
    summary: 'One prayer in full',
    description: 'Its source, the scripts it can be read in, and every verse with its meaning and the renderings stored for it.',
    limit: 'read',
    params: schemas.id,
    query: z.object(languages),
    responds: { 200: 'The prayer, with its verses', 404: 'No such published prayer' },
  },
  controller.get
);

export default router;
