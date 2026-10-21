import { createRouter, z, schemas } from '../../utils/router.js';
import * as controller from '../../controllers/admin/finance.js';
import { CATEGORIES, MONTH_RE } from '../../services/finance.js';

const router = createRouter({
  tag: 'Admin · Finance',
  prefix: '',
  description:
    'The owner’s books, in INR (money is paise): store revenue (gross, platform commission, net), AI cost ' +
    'converted from dollars at a stored rate, and the credit and debit lines typed in by hand. Super admin only — ' +
    'permission `finance.manage` is not held by the admin role.',
});

const month = z.string().regex(MONTH_RE, 'Use YYYY-MM');
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const category = z.enum(CATEGORIES);

router.get(
  '/finance/overview',
  {
    summary: 'Last twelve months and what is waiting',
    description: 'A month-by-month trend, the months whose costs still need entering, and the dollar rate in use.',
    permission: 'finance.manage',
    limit: 'read',
    responds: { 200: 'The trend and pending months' },
  },
  controller.overview
);

router.get(
  '/finance/pending',
  {
    summary: 'Months waiting for their costs',
    description: 'Last month until it is confirmed, and this month in its last two days. Drives the banner.',
    permission: 'finance.manage',
    limit: 'read',
    responds: { 200: 'Month keys, e.g. ["2026-09"]' },
  },
  controller.pending
);

router.get(
  '/finance/months/:month',
  {
    summary: 'One month’s books',
    description:
      'Revenue (gross, commission, net, refunds, free trials), AI cost by kind, typed credits and debits, expenses and profit.',
    permission: 'finance.manage',
    limit: 'read',
    params: z.object({ month }),
    responds: { 200: 'The month' },
  },
  controller.month
);

router.post(
  '/finance/months/:month/confirm',
  {
    summary: 'Confirm a month’s costs',
    description:
      'Says the month’s costs are all entered: stops the month-end reminder and fixes the dollar rate the month’s AI cost is converted at.',
    permission: 'finance.manage',
    limit: 'write',
    params: z.object({ month }),
    responds: { 200: 'The confirmed month', 400: 'The month is not over yet' },
  },
  controller.confirm
);

router.delete(
  '/finance/months/:month/confirm',
  {
    summary: 'Reopen a month',
    permission: 'finance.manage',
    limit: 'write',
    params: z.object({ month }),
    responds: { 200: 'The reopened month' },
  },
  controller.reopen
);

router.put(
  '/finance/rate',
  {
    summary: 'Set the dollar rate',
    description: 'Rupees per US dollar. Applies to months not yet confirmed.',
    permission: 'finance.manage',
    limit: 'write',
    body: z.object({ rate: z.number().min(1).max(1000) }),
    responds: { 200: 'The rate' },
  },
  controller.setRate
);

router.get(
  '/finance/entries',
  {
    summary: 'List credit and debit entries',
    permission: 'finance.manage',
    limit: 'read',
    query: schemas.sorted(controller.ENTRY_SORT_COLUMNS).extend({
      month: month.optional(),
      direction: z.enum(['CREDIT', 'DEBIT']).optional(),
      category: category.optional(),
    }),
    responds: { 200: 'A page of entries' },
  },
  controller.listEntries
);

const entryBody = z.object({
  direction: z.enum(['CREDIT', 'DEBIT']),
  category,
  amount: z.number().positive().max(100000000), // rupees; stored as paise
  date,
  note: z.string().trim().max(500).optional(),
});

router.post(
  '/finance/entries',
  {
    summary: 'Add a credit or debit',
    description: 'Amount is in rupees. Any date, any time of month; the month it lands in follows from the date.',
    permission: 'finance.manage',
    limit: 'write',
    body: entryBody,
    responds: { 201: 'The entry' },
  },
  controller.createEntry
);

router.patch(
  '/finance/entries/:id',
  {
    summary: 'Edit an entry',
    permission: 'finance.manage',
    limit: 'write',
    params: schemas.id,
    body: entryBody.partial(),
    responds: { 200: 'The entry', 404: 'No such entry' },
  },
  controller.updateEntry
);

router.delete(
  '/finance/entries/:id',
  {
    summary: 'Delete an entry',
    permission: 'finance.manage',
    limit: 'write',
    params: schemas.id,
    responds: { 204: 'Deleted', 404: 'No such entry' },
  },
  controller.deleteEntry
);

export default router;
