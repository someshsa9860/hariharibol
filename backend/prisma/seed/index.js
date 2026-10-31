// Seeds the reference data the platform cannot run without: roles and
// permissions, languages, the issue taxonomy, deities, gurus, translators, the
// two scripture books, the Premium plan and the runtime settings.
//
//   npm run seed
//
// Safe to run repeatedly — on a fresh database, after a migration, or in a deploy
// step. It creates what is missing and never replaces a value already in the
// database: a picture uploaded in the admin panel, an edited title, a role's
// permissions set on the Roles page all survive it. Where it fills a blank field
// it says so at the place it does it. It never touches user data.
//
// A brand-new database takes it twice, with the importers between:
//   migrate → seed → import-bg → import-sb → seed
// The books and cantos are made here; their chapters and verses by the importers
// (scripts/README.md); and the stories, which point at those chapters, by the second run.
//
// One thing it deliberately does not do: create an admin account. That happens
// once, by hand, by promoting a real signed-in user — a seeded admin with a
// known email is a credential sitting in version control.

import { PrismaClient } from '@prisma/client';
import * as data from './data.js';
import { translations } from './mantra-translations/index.js';
import { bookTitles, cantoTitles, chapterTitles, fillMissing } from './section-titles/index.js';
import { bhagavatamChapterTitles } from './section-titles/bhagavatam/index.js';
import { chantPhrases } from './chant-phrases.js';
import { chantWords } from './chant-words.js';
import { opensByKind, routineKinds } from './routine-nudges.js';
import { seedEtiquette } from './etiquette/index.js';
import { seedQuotes } from './quotes/index.js';
import { fromDevanagari, isDevanagari } from '../../utils/script.js';
import { ROLES, SYSTEM_CREATOR_EMAIL } from '../../config/constants.js';

const prisma = new PrismaClient();

const log = (...args) => console.log('  ', ...args); // eslint-disable-line no-console

// Created once. A permission already there keeps its name and group, so a label
// changed by hand stays changed. Returns the slugs this run created.
async function seedPermissions() {
  const have = new Set((await prisma.permission.findMany({ select: { slug: true } })).map((p) => p.slug));
  const fresh = data.permissions.filter((permission) => !have.has(permission.slug));
  if (fresh.length) await prisma.permission.createMany({ data: fresh });
  log(`${data.permissions.length} permissions, ${fresh.length} new`);
  return fresh.map((permission) => permission.slug);
}

// A role is created once, with the permissions config/constants.js gives it. After
// that the Roles page owns it: its name, description and permissions are left as
// they are, so a permission an admin removed stays removed. The one thing a later
// run adds is a permission this run has just created, to each role the code lists
// it for — so a new permission reaches super admin and admin without a migration.
async function seedRoles(newPermissions) {
  for (const role of data.roles) {
    const { permissions: slugs, ...fields } = role;

    const existing = await prisma.role.findUnique({ where: { slug: role.slug }, select: { id: true } });
    const roleId = existing?.id ?? (await prisma.role.create({ data: fields })).id;

    const granted = existing ? slugs.filter((slug) => newPermissions.includes(slug)) : slugs;
    const rows = await prisma.permission.findMany({ where: { slug: { in: granted } } });
    if (rows.length) {
      await prisma.rolePermission.createMany({
        data: rows.map((p) => ({ roleId, permissionId: p.id })),
        skipDuplicates: true,
      });
    }

    log(`role ${role.slug} — ${existing ? 'kept as it is' : 'created'}, ${rows.length} permissions granted`);
  }
}

async function seedLanguages() {
  // Created once: a language's name, script and flags belong to the admin after that.
  for (const language of data.languages) {
    await prisma.language.upsert({ where: { code: language.code }, update: {}, create: language });
  }
  log(`${data.languages.length} languages`);
}

async function seedIssues() {
  for (const issue of data.issues) {
    await prisma.issue.upsert({ where: { slug: issue.slug }, update: {}, create: issue });
  }
  log(`${data.issues.length} issues`);
}

// The deities, gurus and translators are created once. Their pictures in particular
// are uploaded in the admin panel, and an admin who clears one on purpose must not
// find the seed's placeholder back on the next run.
async function seedReference() {
  for (const deity of data.deities) {
    await prisma.deity.upsert({ where: { slug: deity.slug }, update: {}, create: deity });
  }
  log(`${data.deities.length} deities`);

  for (const guru of data.gurus) {
    await prisma.guru.upsert({ where: { slug: guru.slug }, update: {}, create: guru });
  }
  log(`${data.gurus.length} gurus`);

  for (const translator of data.translators) {
    await prisma.translator.upsert({ where: { slug: translator.slug }, update: {}, create: translator });
  }
  log(`${data.translators.length} translators`);
}

// The mantra written out in every language's script (generated from the
// Devanagari source) and its name, meaning and purport in every reading
// language (mantra-translations/). English is hand-written in data.js and
// Sanskrit carries the original text and no prose, so neither takes anything
// from there.
//
// Fill-only: a missing row is created whole; an existing one has just the
// fields it still lacks filled in. A value already there is never replaced, so
// a correction an editor made in the admin panel survives re-seeding.
async function seedMantraScripts(mantra, sanskrit) {
  const languages = await prisma.language.findMany({ where: { isMantraLanguage: true } });

  for (const { code } of languages) {
    if (code === 'en') continue; // hand-written, with its own meaning and purport

    const prose = translations[code]?.[mantra.slug];
    const wanted = {
      text: isDevanagari(code) ? sanskrit : fromDevanagari(sanskrit, code),
      name: prose?.name ?? null,
      meaning: prose?.meaning ?? null,
      purport: prose?.purport ?? null,
    };

    const where = { mantraId_languageCode: { mantraId: mantra.id, languageCode: code } };
    const existing = await prisma.mantraTranslation.findUnique({ where });

    if (!existing) {
      await prisma.mantraTranslation.create({
        data: { mantraId: mantra.id, languageCode: code, ...wanted, isPublished: true },
      });
      continue;
    }

    const missing = Object.fromEntries(
      Object.entries(wanted).filter(([field, value]) => value && !existing[field]),
    );
    if (Object.keys(missing).length) {
      await prisma.mantraTranslation.update({ where, data: missing });
    }
  }
}

async function seedMantras() {
  for (const mantra of data.mantras) {
    const { deity, guru, translations, ...fields } = mantra;

    const deityRow = deity ? await prisma.deity.findUnique({ where: { slug: deity } }) : null;
    const guruRow = guru ? await prisma.guru.findUnique({ where: { slug: guru } }) : null;

    const phrases = chantPhrases[mantra.slug] ?? [];

    // Created once. The mantra's text, name and publishing are the admin's after that.
    const saved = await prisma.mantra.upsert({
      where: { slug: mantra.slug },
      update: {},
      create: { ...fields, chantPhrases: phrases, deityId: deityRow?.id ?? null, guruId: guruRow?.id ?? null, isPublished: true },
    });

    // The deity, the guru and the chant phrases only where the mantra has none yet.
    const links = {};
    if (deityRow && !saved.deityId) links.deityId = deityRow.id;
    if (guruRow && !saved.guruId) links.guruId = guruRow.id;
    if (phrases.length && !saved.chantPhrases?.length) links.chantPhrases = phrases;
    if (Object.keys(links).length) await prisma.mantra.update({ where: { id: saved.id }, data: links });

    // A standard chanting time only for a mantra that has none yet.
    const standard = data.standardChantMs[mantra.slug];
    if (standard && !saved.durationMs) {
      await prisma.mantra.update({ where: { id: saved.id }, data: { durationMs: standard } });
    }

    // Allowed English words only for a mantra that has none yet.
    if (chantWords[mantra.slug]?.length && !saved.chantWords?.length) {
      await prisma.mantra.update({ where: { id: saved.id }, data: { chantWords: chantWords[mantra.slug] } });
    }

    for (const translation of translations) {
      await prisma.mantraTranslation.upsert({
        where: { mantraId_languageCode: { mantraId: saved.id, languageCode: translation.languageCode } },
        update: {},
        create: { ...translation, mantraId: saved.id, isPublished: true },
      });
    }

    await seedMantraScripts(saved, mantra.sanskrit);
  }
  // After the loop, because a prayer is another mantra and has to exist first.
  for (const [slug, prayerSlug] of Object.entries(data.prayerMantras)) {
    const [mantra, prayer] = await Promise.all([
      prisma.mantra.findUnique({ where: { slug } }),
      prisma.mantra.findUnique({ where: { slug: prayerSlug } }),
    ]);
    // A prayer only for a mantra that has none yet.
    if (mantra && prayer && !mantra.prayerMantraId) {
      await prisma.mantra.update({ where: { id: mantra.id }, data: { prayerMantraId: prayer.id } });
    }
  }

  log(`${data.mantras.length} mantras`);
}

async function seedBooks() {
  for (const book of data.books) {
    const { deity, ...fields } = book;
    const deityRow = deity ? await prisma.deity.findUnique({ where: { slug: deity } }) : null;

    // Created once. A book's text, its deity and whether it is published are the
    // admin's after that, so re-running the seed never unpublishes a book.
    const saved = await prisma.book.upsert({
      where: { bookNumber: book.bookNumber },
      update: {},
      create: { ...fields, deityId: deityRow?.id ?? null, isPublished: false },
    });

    // The deity and the recitation folder only where the book has none yet.
    const links = {};
    if (deityRow && !saved.deityId) links.deityId = deityRow.id;
    if (fields.recitationParent && !saved.recitationParent) links.recitationParent = fields.recitationParent;
    if (Object.keys(links).length) await prisma.book.update({ where: { id: saved.id }, data: links });
  }
  log(`${data.books.length} books`);

  const bhagavatam = await prisma.book.findUnique({ where: { bookNumber: 2 } });
  for (const canto of data.cantos) {
    await prisma.canto.upsert({
      where: { bookId_number: { bookId: bhagavatam.id, number: canto.number } },
      update: {},
      create: { bookId: bhagavatam.id, number: canto.number, title: canto.title },
    });
  }
  log(`${data.cantos.length} cantos`);
}

// The titles of the books, cantos and chapters in every reading language, added
// only where the row has none (prisma/seed/section-titles/). Runs after the
// importers on a new database too: chapters exist only once they have run.
async function seedSectionTitles() {
  let filled = 0;

  const update = async (model, row, wanted) => {
    const merged = fillMissing(row.titleI18n, wanted);
    if (!merged) return;
    await prisma[model].update({ where: { id: row.id }, data: { titleI18n: merged } });
    filled += 1;
  };

  for (const book of await prisma.book.findMany({ select: { id: true, slug: true, titleI18n: true } })) {
    // What data.js names for a short work, then what the seed files add to it.
    const own = data.books.find((b) => b.slug === book.slug)?.titleI18n ?? {};
    await update('book', book, { ...bookTitles(book.slug), ...own });
  }

  const cantos = await prisma.canto.findMany({
    select: { id: true, number: true, titleI18n: true, book: { select: { slug: true } } },
  });
  for (const canto of cantos) await update('canto', canto, cantoTitles(canto.book.slug, canto.number));

  // Chapters with no canto — the Gita's. A Bhagavatam chapter number repeats in every canto.
  const chapters = await prisma.chapter.findMany({
    where: { cantoId: null },
    select: { id: true, number: true, titleI18n: true, book: { select: { slug: true } } },
  });
  for (const chapter of chapters) await update('chapter', chapter, chapterTitles(chapter.book.slug, chapter.number));

  // The Bhagavatam's, found by canto and number (a chapter number repeats in every canto).
  const bhagavatam = await prisma.chapter.findMany({
    where: { book: { slug: 'srimad-bhagavatam' }, cantoNumber: { not: null } },
    select: { id: true, number: true, cantoNumber: true, titleI18n: true },
  });
  for (const chapter of bhagavatam) await update('chapter', chapter, bhagavatamChapterTitles(chapter.cantoNumber, chapter.number));

  log(`${filled} book, canto and chapter titles completed`);
}

async function seedStories() {
  const waiting = [];

  for (const story of data.stories) {
    const { book: bookSlug, canto, parts, dailyEligible, ...fields } = story;

    const book = await prisma.book.findUnique({ where: { slug: bookSlug } });

    // A part points at a chapter, and a book's chapters come from its import
    // (scripts/import-sb.js), not from this seed — so on a database that has not been
    // imported yet there is nothing to point at. The story then waits, whole: saving it
    // anyway would publish a story with no parts. Run the seed again after the import.
    const chapterRows = new Map();
    for (const { chapter } of parts) {
      const row = await prisma.chapter.findUnique({
        where: { bookId_cantoNumber_number: { bookId: book.id, cantoNumber: canto, number: chapter } },
      });
      if (row) chapterRows.set(chapter, row);
    }
    if (chapterRows.size < new Set(parts.map((part) => part.chapter)).size) {
      waiting.push(story.slug);
      continue;
    }

    // Created once: a story's wording and publishing are the admin's after that. A part
    // the seed adds later is created; a part already there is left as it is.
    const saved = await prisma.story.upsert({
      where: { slug: story.slug },
      update: {},
      create: { ...fields, bookId: book.id, cantoNumber: canto, isPublished: true },
    });

    for (const part of parts) {
      const { chapter, verseStart, verseEnd, issue, ...partFields } = part;
      const chapterRow = chapterRows.get(chapter);

      const savedPart = await prisma.storyPart.upsert({
        where: { storyId_number: { storyId: saved.id, number: part.number } },
        update: {},
        create: {
          ...partFields,
          storyId: saved.id,
          chapterId: chapterRow.id,
          verseNumberStart: verseStart,
          verseNumberEnd: verseEnd,
          isDailyEligible: !!dailyEligible,
          isPublished: true,
        },
      });

      if (issue) {
        const issueRow = await prisma.issue.findUnique({ where: { slug: issue } });
        await prisma.storyPartIssue.upsert({
          where: { storyPartId_issueId: { storyPartId: savedPart.id, issueId: issueRow.id } },
          update: {},
          create: { storyPartId: savedPart.id, issueId: issueRow.id },
        });
      }
    }
  }
  const made = data.stories.filter((story) => !waiting.includes(story.slug));
  log(`${made.length} stories, ${made.reduce((n, s) => n + s.parts.length, 0)} parts`);
  if (waiting.length > 0) {
    log(`${waiting.length} stories wait for chapters that are not imported yet (${waiting.join(', ')})`);
    log('→ after `import-bg.js` and `import-sb.js`, run `npm run seed` again and they are created');
  }
}

async function seedPlansAndTopics() {
  for (const { prices, ...plan } of data.plans) {
    // Created once. After that the panel owns plans, prices and feature values —
    // re-seeding must not put back a price an operator has changed.
    const saved = await prisma.subscriptionPlan.upsert({
      where: { slug: plan.slug },
      update: {},
      create: plan,
    });

    for (const price of prices) {
      await prisma.planPrice.upsert({
        where: { provider_productId: { provider: price.provider, productId: price.productId } },
        update: {},
        create: { ...price, planId: saved.id },
      });
    }
  }

  for (const { values, ...feature } of data.features) {
    const saved = await prisma.feature.upsert({ where: { key: feature.key }, update: {}, create: feature });

    for (const [slug, value] of Object.entries(values)) {
      const plan = await prisma.subscriptionPlan.findUnique({ where: { slug } });
      if (!plan) continue;
      await prisma.planFeature.upsert({
        where: { planId_featureId: { planId: plan.id, featureId: saved.id } },
        update: {},
        create: { planId: plan.id, featureId: saved.id, enabled: value.enabled, limit: value.limit ?? null },
      });
    }
  }
  log(`${data.plans.length} subscription plan(s), ${data.features.length} feature(s)`);

  for (const { planSlug, ...config } of data.aiPlanConfigs) {
    const plan = await prisma.subscriptionPlan.findUnique({ where: { slug: planSlug } });
    if (!plan) continue;
    // Created once; the admin panel owns the numbers afterwards.
    await prisma.aiPlanConfig.upsert({ where: { planId: plan.id }, update: {}, create: { ...config, planId: plan.id } });
  }
  log(`${data.aiPlanConfigs.length} AI chat allowance(s)`);

  for (const topic of data.topics) {
    await prisma.fcmTopic.upsert({ where: { key: topic.key }, update: {}, create: topic });
  }
  log(`${data.topics.length} push topics`);
}

async function seedSettings() {
  for (const setting of data.settings) {
    // Only created, never updated — an operator changing the AI model in the
    // panel should not have it reset by the next deploy's seed step.
    const existing = await prisma.appSetting.findUnique({ where: { key: setting.key } });
    if (existing) continue;
    await prisma.appSetting.create({ data: { key: setting.key, value: setting.value } });
  }
  log(`${data.settings.length} settings checked`);
}

async function seedRoutineNudges() {
  let nudges = 0;
  for (const [index, { kind, voice, verses }] of routineKinds.entries()) {
    // Created once. A kind already there keeps its order, its opens and its wording;
    // the one thing filled in is a script it has none of.
    const row = await prisma.routineKind.upsert({
      where: { key: kind },
      update: {},
      create: { key: kind, sortOrder: index, voiceScript: voice, ...opensByKind[kind] },
    });
    if (!row.voiceScript) await prisma.routineKind.update({ where: { key: kind }, data: { voiceScript: voice } });

    for (const [position, verse] of verses.entries()) {
      const fields = { verseId: verse.verseId, reference: verse.reference, text: verse.text };
      await prisma.routineNudge.upsert({
        where: { kindKey_position: { kindKey: kind, position } },
        update: {},
        create: { kindKey: kind, position, ...fields },
      });
      nudges += 1;
    }
  }
  log(`${routineKinds.length} routine kinds, ${nudges} verses`);
}

async function seedEtiquetteItems() {
  const { created, filled, kept } = await seedEtiquette(prisma);
  log(`devotee etiquette: ${created} added, ${filled} with a blank field filled in, ${kept} left as they are`);
}

async function seedQuoteItems() {
  const { created, filled, kept } = await seedQuotes(prisma);
  log(`quotes: ${created} added, ${filled} with a blank field filled in, ${kept} left as they are`);
}

async function main() {
  console.log('Seeding HariHariBol...\n'); // eslint-disable-line no-console

  const newPermissions = await seedPermissions();
  await seedRoles(newPermissions);
  await seedLanguages();
  await seedIssues();
  await seedReference();
  await seedMantras();
  await seedBooks();
  await seedSectionTitles();
  await seedStories();
  await seedPlansAndTopics();
  await seedSettings();
  await seedRoutineNudges();
  await seedEtiquetteItems();
  await seedQuoteItems();

  const admins = await prisma.user.count({ where: { role: { slug: { not: 'user' } } } });

  console.log('\nDone.'); // eslint-disable-line no-console
  if (admins === 0) {
    // eslint-disable-next-line no-console
    console.log(
      '\nNo admin account exists yet. Sign in through the app, then promote yourself:\n' +
        '  npx prisma studio  → User → set roleId to the super_admin role\n'
    );
  }
}

main()
  .catch((err) => {
    console.error('Seed failed:', err); // eslint-disable-line no-console
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
