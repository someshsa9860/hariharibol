import { createRouter, z } from '../../utils/router.js';
import * as controller from '../../controllers/app/user.js';

const router = createRouter({
  tag: 'Me',
  prefix: '/me',
  description: 'The signed-in user’s own profile, language choices and practice settings.',
});

router.get(
  '/',
  {
    summary: 'Get my profile',
    description:
      'Profile, language choices, entitlement and standing practice preferences. ' +
      '`canAccessAdmin` tells the app whether to show the admin entry point; the API still ' +
      'checks permissions on every admin route.',
    responds: { 200: 'The signed-in user' },
  },
  controller.me
);

router.patch(
  '/',
  {
    summary: 'Update my profile',
    description:
      'Name, avatar and timezone. Timezone matters more than it looks — it decides which ' +
      'calendar day practice is recorded against and what hour the daily sloka arrives.',
    limit: 'write',
    body: z.object({
      name: z.string().trim().min(1).max(100).optional(),
      avatarUrl: z.string().url().max(500).optional(),
      timezone: z.string().max(64).optional(),
    }),
    responds: { 200: 'Updated profile', 400: 'Unrecognised timezone' },
  },
  controller.update
);

router.patch(
  '/languages',
  {
    summary: 'Set my three languages',
    description:
      'App, mantra and reading language are independent — they may all differ or all match. ' +
      'Mantra text resolves mantra → reading → app → en; meanings and translations resolve ' +
      'reading → app → en. Each code is checked against the slot it is being used for, so ' +
      'Sanskrit is accepted as a mantra language and refused as an app language.',
    limit: 'write',
    body: z
      .object({
        appLanguage: z.string().max(10).optional(),
        mantraLanguage: z.string().max(10).optional(),
        readingLanguage: z.string().max(10).optional(),
      })
      .refine((value) => Object.values(value).some(Boolean), {
        message: 'Set at least one language',
      }),
    responds: { 200: 'Updated profile', 400: 'Unknown language, or wrong slot for it' },
  },
  controller.updateLanguages
);

router.patch(
  '/sadhana-profile',
  {
    summary: 'Set my daily round target and reminder time',
    description:
      'Standing preferences used to prefill each new day. `reminderTime` is local to the ' +
      'user’s own timezone, in 24-hour HH:MM.',
    limit: 'write',
    body: z.object({
      dailyRoundTarget: z.coerce.number().int().min(1).max(200).optional(),
      reminderTime: z
        .string()
        .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM, 24-hour')
        .nullable()
        .optional(),
    }),
    responds: { 200: 'Updated practice profile' },
  },
  controller.updateSadhanaProfile
);

router.get(
  '/summary',
  {
    summary: 'Get my lifetime totals',
    description: 'Chanting days, total rounds, tasks completed, favourites and slokas read.',
    responds: { 200: 'Totals for the profile screen' },
  },
  controller.summary
);

export default router;
