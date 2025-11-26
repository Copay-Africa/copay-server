import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { seedCooperativeCategories } from '../src/modules/cooperative-category/cooperative-category.seed';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  await seedCooperativeCategories(prisma);

  const defaultCategory = await prisma.cooperativeCategory.findFirst({
    where: { name: 'Residential Apartment' },
  });

  if (!defaultCategory) {
    throw new Error('Default category not found after seeding');
  }

  // Create Super Admin
  const superAdminPin = await bcrypt.hash('2025', 12);

  const superAdmin = await prisma.user.upsert({
    where: { phone: '+250788000001' },
    update: {},
    create: {
      phone: '+250788000001',
      pin: superAdminPin,
      firstName: 'Super',
      lastName: 'Admin',
      email: 'superadmin@copay.rw',
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      profileData: {
        isVerified: true,
        permissions: ['ALL'],
      },
    },
  });

  console.log('✅ Created super admin:', superAdmin.phone);

  // Seed cooperative categories
  await seedCooperativeCategories(prisma);

  console.log('🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
