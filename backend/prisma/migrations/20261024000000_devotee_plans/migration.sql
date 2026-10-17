-- The paid plans are the four kinds of devotee of Bhagavad-gita 7.16 — ārta, jijñāsu, arthārthī, jñānī —
-- in place of the single Premium. They differ in how much Ask Sakha they give, which is all a plan adds: the app
-- itself stays free.
--
-- Production runs `prisma migrate deploy` and not the seed, so what has to exist on day one is inserted here.
-- Every statement is idempotent and nothing an admin has edited is overwritten: rows go in with ON CONFLICT DO
-- NOTHING, and the two updates below only touch a row that still holds what was seeded. The same rows are in
-- prisma/seed/data.js for a database that starts from the seed; change both together.

-- ── The plans ──────────────────────────────────────────────────────────────
INSERT INTO "SubscriptionPlan" ("id", "slug", "name", "description", "tier", "isFree", "grantedToDonors", "isActive", "updatedAt")
VALUES
  ('plan_arta', 'arta', 'Ārta',
   'आर्त · For a hard time. Steady company in Sakha when the heart is heavy.',
   1, false, false, true, NOW()),
  ('plan_jijnasu', 'jijnasu', 'Jijñāsu',
   'जिज्ञासु · For the seeker. More room to ask, to understand and to go deeper into the verses.',
   2, false, true, true, NOW()),
  ('plan_artharthi', 'artharthi', 'Arthārthī',
   'अर्थार्थी · For the one who prays for a good life. Sakha beside you through work, family and the goals you pray for.',
   3, false, false, true, NOW()),
  ('plan_jnani', 'jnani', 'Jñānī',
   'ज्ञानी · For the one who worships out of love and understanding. The fullest allowance, for a daily practice of study and conversation.',
   4, false, false, true, NOW())
ON CONFLICT ("slug") DO NOTHING;

-- ── Their prices: one month, per store, in rupees ──────────────────────────
-- The product ids are the ones to create in the Play Console and App Store Connect. A product the store does not
-- list leaves the Subscribe button disabled in the app, so nothing breaks before they exist.
INSERT INTO "PlanPrice" ("id", "planId", "provider", "productId", "priceMinor", "currency", "periodDays", "trialDays", "isActive", "updatedAt")
SELECT 'pp_' || md5(sp."id" || p."provider"), sp."id", p."provider"::"PaymentProvider", sp."slug" || '_monthly', v."priceMinor", 'INR', 30, 0, true, NOW()
FROM "SubscriptionPlan" sp
JOIN (VALUES ('arta', 4900), ('jijnasu', 9900), ('artharthi', 19900), ('jnani', 39900)) AS v("slug", "priceMinor") ON v."slug" = sp."slug"
CROSS JOIN (VALUES ('GOOGLE_PLAY'), ('APPLE_APP_STORE')) AS p("provider")
ON CONFLICT DO NOTHING;

-- ── The benefits every paid plan has ───────────────────────────────────────
INSERT INTO "PlanFeature" ("id", "planId", "featureId", "enabled")
SELECT 'pf_' || md5(sp."id" || f."id"), sp."id", f."id", true
FROM "SubscriptionPlan" sp
CROSS JOIN "Feature" f
WHERE sp."slug" IN ('arta', 'jijnasu', 'artharthi', 'jnani')
  AND f."key" IN ('ads.removed', 'supporter.badge')
ON CONFLICT DO NOTHING;

-- ── Ask Sakha: what each plan gives ────────────────────────────────────────
-- The wallet is 4,000 tokens × the replies a month the app tells the reader (TYPICAL_REPLY_TOKENS in
-- config/chat.js): 100 · 250 · 500 · 1,000. Readers never see the tokens.
INSERT INTO "AiPlanConfig" ("id", "planId", "levelName", "isEnabled", "dailyTokens", "walletTokens", "renewal", "conversationTokens", "modelTier", "updatedAt")
SELECT 'aipc_' || sp."slug", sp."id", v."levelName", true, v."dailyTokens", v."walletTokens", 'MONTHLY'::"AiRenewal", v."conversationTokens", 'ADVANCED'::"AiModelTier", NOW()
FROM "SubscriptionPlan" sp
JOIN (VALUES
  ('arta',      'Arta',      24000,   400000,  40000),
  ('jijnasu',   'Jijnasu',   60000,  1000000,  80000),
  ('artharthi', 'Artharthi', 120000, 2000000, 100000),
  ('jnani',     'Jnani',     240000, 4000000, 120000)
) AS v("slug", "levelName", "dailyTokens", "walletTokens", "conversationTokens") ON v."slug" = sp."slug"
ON CONFLICT DO NOTHING;

-- The free plan's level was "Jigyasu", which is now the name of a paid plan. Renamed only if nobody has edited it.
UPDATE "AiPlanConfig" SET "levelName" = 'Sadhaka', "updatedAt" = NOW()
WHERE "levelName" = 'Jigyasu'
  AND "planId" IN (SELECT "id" FROM "SubscriptionPlan" WHERE "slug" = 'free');

-- ── Premium is retired, not removed ────────────────────────────────────────
-- Someone who bought it keeps access until their period ends (entitlement does not look at isActive), and its
-- allowance stays so their wallet is not cut. It is no longer offered, and a donation now earns Jijñāsu. Its tier
-- is set to match its ₹99 price, so a donor and an old Premium subscriber rank as equals and the donor wins the tie.
UPDATE "SubscriptionPlan" SET "isActive" = false, "grantedToDonors" = false, "tier" = 2, "updatedAt" = NOW()
WHERE "slug" = 'premium' AND "isActive" = true;
