// Seeds the reference data the platform cannot run without: roles and
// permissions, languages, the issue taxonomy, deities, gurus, translators, the
// two scripture books, the Premium plan and the runtime settings.
//
//   npm run seed
//
// Every write is an upsert, so this is safe to run repeatedly — on a fresh
// database, after a migration, or in a deploy step. It never touches user data.
//
// One thing it deliberately does not do: create an admin account. That happens
// once, by hand, by promoting a real signed-in user — a seeded admin with a
// known email is a credential sitting in version control.

import { PrismaClient } from '@prisma/client';
import * as data from './data.js';

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

async function seedBooks() {
  for (const book of data.books) {
    // isPublished is never written on update — a book that has been published
    // must not be quietly unpublished by re-running the seed.
    await prisma.book.upsert({
      where: { bookNumber: book.bookNumber },
      update: { title: book.title, titleI18n: book.titleI18n, description: book.description },
      create: { ...book, isPublished: false },
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

async function seedPlansAndTopics() {
  for (const plan of data.plans) {
    await prisma.subscriptionPlan.upsert({
      where: { slug: plan.slug },
      // The price is not overwritten on update: changing it here would rewrite
      // what the panel has set, and subscribers keep paying what they were sold
      // regardless.
      update: { name: plan.name, description: plan.description, isActive: plan.isActive },
      create: plan,
    });
  }
  log(`${data.plans.length} subscription plan(s)`);

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
  await seedBooks();
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
