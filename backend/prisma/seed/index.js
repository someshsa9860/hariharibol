// Seeds the reference data the platform cannot run without: roles and
// permissions, languages, the issue taxonomy, deities, gurus, translators, the
// two scripture books, the Premium plan and the runtime settings.
//
//   npm run seed
//
// Every write is an upsert, so this is safe to run repeatedly — on a fresh
// database, after a migration, or in a deploy step. It never touches user data.
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
import { chantPhrases } from './chant-phrases.js';
import { chantWords } from './chant-words.js';
import { fromDevanagari, isDevanagari } from '../../utils/script.js';
import { ROLES, SYSTEM_CREATOR_EMAIL } from '../../config/constants.js';

const prisma = new PrismaClient();

const log = (...args) => console.log('  ', ...args); // eslint-disable-line no-console

async function seedPermissions() {
  for (const permission of data.permissions) {
    await prisma.permission.upsert({
      where: { slug: permission.slug },
      update: { name: permission.name, group: permission.group },
      create: permission,
    });
  }
  log(`${data.permissions.length} permissions`);
}

async function seedRoles() {
  for (const role of data.roles) {
    const { permissions: slugs, ...fields } = role;

    const saved = await prisma.role.upsert({
      where: { slug: role.slug },
      update: { name: fields.name, description: fields.description, isSystem: fields.isSystem },
      create: fields,
    });

    const rows = await prisma.permission.findMany({ where: { slug: { in: slugs } } });

    // Replaced rather than merged: a permission removed from
    // config/constants.js must actually be removed from the role, or a role
    // keeps a grant nobody can see in the code any more.
    await prisma.rolePermission.deleteMany({ where: { roleId: saved.id } });
    if (rows.length) {
      await prisma.rolePermission.createMany({
        data: rows.map((p) => ({ roleId: saved.id, permissionId: p.id })),
      });
    }

    log(`role ${role.slug} — ${rows.length} permissions`);
  }
}

async function seedLanguages() {
  for (const language of data.languages) {
    await prisma.language.upsert({
      where: { code: language.code },
      update: language,
      create: language,
    });
  }
  log(`${data.languages.length} languages`);
}

async function seedIssues() {
  for (const issue of data.issues) {
    await prisma.issue.upsert({ where: { slug: issue.slug }, update: issue, create: issue });
  }
  log(`${data.issues.length} issues`);
}

async function seedReference() {
  for (const deity of data.deities) {
    await prisma.deity.upsert({ where: { slug: deity.slug }, update: deity, create: deity });
  }
  log(`${data.deities.length} deities`);

  for (const guru of data.gurus) {
    await prisma.guru.upsert({ where: { slug: guru.slug }, update: guru, create: guru });
  }
  log(`${data.gurus.length} gurus`);

  for (const translator of data.translators) {
    await prisma.translator.upsert({
      where: { slug: translator.slug },
      update: translator,
      create: translator,
    });
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

    // Always written from the seed, like the rest of a mantra's fields.
    const phrases = chantPhrases[mantra.slug] ?? [];

    const saved = await prisma.mantra.upsert({
      where: { slug: mantra.slug },
      update: { ...fields, chantPhrases: phrases, deityId: deityRow?.id ?? null, guruId: guruRow?.id ?? null },
      create: { ...fields, chantPhrases: phrases, deityId: deityRow?.id ?? null, guruId: guruRow?.id ?? null, isPublished: true },
    });

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
        update: { ...translation, isPublished: true },
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

    // isPublished is never written on update — a book that has been published
    // must not be quietly unpublished by re-running the seed.
    await prisma.book.upsert({
      where: { bookNumber: book.bookNumber },
      update: {
        title: fields.title,
        // titleI18n is not written here: seedSectionTitles fills only the languages a row
        // lacks, so a title corrected in the admin panel is not put back by the next seed.
        description: fields.description,
        deityId: deityRow?.id ?? null,
        // Only where the seed names a folder — an admin-set one on another book stays.
        ...(fields.recitationParent ? { recitationParent: fields.recitationParent } : {}),
      },
      create: { ...fields, deityId: deityRow?.id ?? null, isPublished: false },
    });
  }
  log(`${data.books.length} books`);

  const bhagavatam = await prisma.book.findUnique({ where: { bookNumber: 2 } });
  for (const canto of data.cantos) {
    await prisma.canto.upsert({
      where: { bookId_number: { bookId: bhagavatam.id, number: canto.number } },
      update: { title: canto.title },
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

    const saved = await prisma.story.upsert({
      where: { slug: story.slug },
      update: { title: fields.title, description: fields.description },
      create: { ...fields, bookId: book.id, cantoNumber: canto, isPublished: true },
    });

    for (const part of parts) {
      const { chapter, verseStart, verseEnd, issue, ...partFields } = part;
      const chapterRow = chapterRows.get(chapter);

      const savedPart = await prisma.storyPart.upsert({
        where: { storyId_number: { storyId: saved.id, number: part.number } },
        update: {
          title: partFields.title,
          description: partFields.description,
          chapterId: chapterRow.id,
          verseNumberStart: verseStart,
          verseNumberEnd: verseEnd,
          isDailyEligible: !!dailyEligible,
        },
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

  for (const topic of data.topics) {
    await prisma.fcmTopic.upsert({ where: { key: topic.key }, update: topic, create: topic });
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

async function main() {
  console.log('Seeding HariHariBol...\n'); // eslint-disable-line no-console

  await seedPermissions();
  await seedRoles();
  await seedLanguages();
  await seedIssues();
  await seedReference();
  await seedMantras();
  await seedBooks();
  await seedSectionTitles();
  await seedStories();
  await seedPlansAndTopics();
  await seedSettings();

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
