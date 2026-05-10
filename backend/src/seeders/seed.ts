import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('HariHariBol', 12);

  const admin = await prisma.adminUser.upsert({
    where: { email: 'someshsa01@gmail.com' },
    update: { passwordHash },
    create: {
      email: 'someshsa01@gmail.com',
      passwordHash,
      name: 'Somesh',
      role: 'superadmin',
    },
  });

  console.log(`✅ Admin seeded: ${admin.email}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
