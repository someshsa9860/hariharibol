import { createRouter, z, schemas } from '../../utils/router.js';
import * as controller from '../../controllers/admin/plan.js';

const router = createRouter({
  tag: 'Admin · Plans',
  prefix: '',
  description:
    'Plans (tiers), what each costs on each store and billing period, and the feature ' +
    'catalogue with a value per plan. None of it decides who is entitled to what — that is ' +
    'always recomputed from the ledger — and changing a price never changes what an existing ' +
    'subscriber pays.',
});

const provider = z.enum(controller.providerKeys);

const planBody = {
  name: z.string().min(1).max(100),
  description: z.string().max(2000).nullable(),
  tier: z.coerce.number().int().min(0).max(100),
  grantedToDonors: z.boolean(),
  isActive: z.boolean(),
};

const priceBody = {
  productId: z.string().min(1).max(200),
  priceMinor: z.coerce.number().int().min(0),
  currency: z.string().length(3).transform((v) => v.toUpperCase()),
  periodDays: z.coerce.number().int().min(1).max(3660),
  trialDays: z.coerce.number().int().min(0).max(365),
  isActive: z.boolean(),
};

const featureBody = {
  name: z.string().min(1).max(100),
  description: z.string().max(2000).nullable(),
  kind: z.enum(['FLAG', 'LIMIT']),
  unit: z.string().max(40).nullable(),
  defaultEnabled: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(10000),
  isActive: z.boolean(),
};

// ── Providers ──────────────────────────────────────────────────────────────

router.get(
  '/plans/providers',
  {
    summary: 'List payment providers',
    description:
      'The stores a price can be attached to — whatever `services/payments` has a module for. ' +
      'Adding a provider there makes it appear here with no panel change.',
    permission: 'payment.read',
    limit: 'read',
    responds: { 200: 'Provider keys' },
  },
  controller.listProviders
);

// ── Plans ──────────────────────────────────────────────────────────────────

router.get(
  '/plans',
  {
    summary: 'List subscription plans',
    description: 'Lowest tier first, each with its prices, its feature values and a subscriber count.',
    permission: 'payment.read',
    limit: 'read',
    responds: { 200: 'Plans' },
  },
  controller.listPlans
);

router.post(
  '/plans',
  {
    summary: 'Create a plan',
    description:
      'A plan is a tier. Prices are added to it separately, one per store and billing period, ' +
      'and feature values are set in the plan × feature matrix.',
    permission: 'plan.manage',
    limit: 'write',
    body: z.object({
      slug: z.string().regex(/^[a-z0-9-]+$/).max(50),
      ...planBody,
      description: planBody.description.optional(),
      tier: planBody.tier.min(1),
      grantedToDonors: planBody.grantedToDonors.optional(),
      isActive: planBody.isActive.optional(),
    }),
    responds: { 201: 'The plan' },
  },
  controller.createPlan
);

router.patch(
  '/plans/:id',
  {
    summary: 'Update a plan',
    permission: 'plan.manage',
    limit: 'write',
    params: schemas.id,
    body: z.object(planBody).partial(),
    responds: { 200: 'The plan', 400: 'Not allowed on the free plan', 404: 'No such plan' },
  },
  controller.updatePlan
);

router.put(
  '/plans/:id/features',
  {
    summary: 'Set a plan’s feature values',
    description:
      'Sets the plan’s value for each feature listed — on/off, and for a LIMIT feature the ' +
      'number (null = unlimited). Features not listed keep what they had.',
    permission: 'plan.manage',
    limit: 'write',
    params: schemas.id,
    body: z.object({
      values: z
        .array(
          z.object({
            featureId: z.string().min(1),
            enabled: z.boolean(),
            limit: z.coerce.number().int().min(0).nullable().optional(),
          })
        )
        .max(200),
    }),
    responds: { 200: 'The plan’s feature values', 400: 'Unknown feature', 404: 'No such plan' },
  },
  controller.setPlanFeatures
);

// ── Prices ─────────────────────────────────────────────────────────────────

router.post(
  '/plans/:id/prices',
  {
    summary: 'Add a price to a plan',
    description:
      'One store product for one billing period. `productId` is the id the store knows it by ' +
      '(Play subscription id, App Store product id, Razorpay plan id). Prices differ per ' +
      'provider — that is the point of this being separate from the plan.',
    permission: 'plan.manage',
    limit: 'write',
    params: schemas.id,
    body: z.object({ provider, ...priceBody, trialDays: priceBody.trialDays.optional(), isActive: priceBody.isActive.optional() }),
    responds: { 201: 'The price', 400: 'Product already used, or the plan is free', 404: 'No such plan' },
  },
  controller.createPrice
);

router.patch(
  '/prices/:id',
  {
    summary: 'Update a price',
    description: 'Existing subscribers keep paying what they were sold; the amount charged is on their Payment rows.',
    permission: 'plan.manage',
    limit: 'write',
    params: schemas.id,
    body: z.object(priceBody).partial(),
    responds: { 200: 'The price', 404: 'No such price' },
  },
  controller.updatePrice
);

router.delete(
  '/prices/:id',
  {
    summary: 'Delete a price',
    description: 'Refused if anyone subscribed through it — deactivate it instead.',
    permission: 'plan.manage',
    limit: 'write',
    params: schemas.id,
    responds: { 200: 'Deleted', 400: 'Has subscribers', 404: 'No such price' },
  },
  controller.deletePrice
);

// ── Features ───────────────────────────────────────────────────────────────

router.get(
  '/features',
  {
    summary: 'List features',
    description: 'The catalogue of things a plan can unlock, in display order.',
    permission: 'payment.read',
    limit: 'read',
    responds: { 200: 'Features' },
  },
  controller.listFeatures
);

router.post(
  '/features',
  {
    summary: 'Create a feature',
    description:
      '`key` is what code asks about (`entitlement.can(userId, key)`, or `feature: key` on a ' +
      'route) and cannot be changed afterwards. A plan with no value for the feature gets ' +
      '`defaultEnabled`, which is on unless chosen otherwise.',
    permission: 'plan.manage',
    limit: 'write',
    body: z.object({
      key: z.string().regex(/^[a-z0-9_]+(\.[a-z0-9_]+)*$/).max(80),
      ...featureBody,
      description: featureBody.description.optional(),
      kind: featureBody.kind.optional(),
      unit: featureBody.unit.optional(),
      defaultEnabled: featureBody.defaultEnabled.optional(),
      sortOrder: featureBody.sortOrder.optional(),
      isActive: featureBody.isActive.optional(),
    }),
    responds: { 201: 'The feature', 400: 'Key already exists' },
  },
  controller.createFeature
);

router.patch(
  '/features/:id',
  {
    summary: 'Update a feature',
    permission: 'plan.manage',
    limit: 'write',
    params: schemas.id,
    body: z.object(featureBody).partial(),
    responds: { 200: 'The feature', 404: 'No such feature' },
  },
  controller.updateFeature
);

router.delete(
  '/features/:id',
  {
    summary: 'Delete a feature',
    description: 'Removes its value from every plan too. To retire one gently, deactivate it.',
    permission: 'plan.manage',
    limit: 'write',
    params: schemas.id,
    responds: { 200: 'Deleted', 404: 'No such feature' },
  },
  controller.deleteFeature
);

export default router;
