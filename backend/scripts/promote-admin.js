// Promotes an already-signed-in user to a role by email. There is no seeded
// admin account — prisma/seed/index.js deliberately does not create one, since
// a known email sitting in a committed seed file is a credential. This is the
// "by hand, once" step that comment points to: sign in through the app or the
// admin panel first (so the user row exists), then run this.
//
// Usage (from backend/):
//   node scripts/promote-admin.js <email> [roleSlug]
//
// roleSlug defaults to super_admin.
//
// Example:
//   node scripts/promote-admin.js someshsa9860@gmail.com

import { prisma } from '../config/database.js';
import * as authService from '../services/auth.js';

async function run() {
  const [email, roleSlug = 'super_admin'] = process.argv.slice(2);
  if (!email) {
    console.error('Usage: node scripts/promote-admin.js <email> [roleSlug]');
    process.exitCode = 1;
    return;
  }

  const role = await prisma.role.findUnique({ where: { slug: roleSlug } });
  if (!role) throw new Error(`No role with slug "${roleSlug}" — run "npm run seed" first`);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error(
      `No user with email "${email}" yet — sign in once through the app or admin panel first`
    );
  }

  await prisma.user.update({ where: { id: user.id }, data: { roleId: role.id } });

  // Same reason controllers/admin/user.js's setRole calls this: the cached
  // auth payload carries the permission set, so without it the change would
  // not take effect until the cache expired.
  await authService.invalidateUser(user.id);

  console.log(`${email} is now ${role.name} (${role.slug}).`);
}

run()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    // redis stays open (services/auth.js holds the connection) — exit
    // explicitly rather than leaving the process to hang on it.
    process.exit(process.exitCode || 0);
  });
