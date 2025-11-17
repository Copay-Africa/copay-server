import {
  PrismaClient,
  UserRole,
  UserStatus,
  CooperativeStatus,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { seedCooperativeCategories } from '../src/modules/cooperative-category/cooperative-category.seed';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Create a default cooperative
  const defaultCooperative = await prisma.cooperative.upsert({
    where: { code: 'DEFAULT_COOP' },
    update: {},
    create: {
      name: 'Default Cooperative',
      code: 'DEFAULT_COOP',
      description: 'Default cooperative for testing',
      address: 'Kigali, Rwanda',
      phone: '+250788123456',
      email: 'admin@defaultcoop.rw',
      status: CooperativeStatus.ACTIVE,
      settings: {
        currency: 'RWF',
        timezone: 'Africa/Kigali',
        paymentDueDay: 1,
        reminderDays: [3, 1],
      },
    },
  });

  console.log('✅ Created default cooperative:', defaultCooperative.name);

  // Create Super Admin
  const superAdminPin = await bcrypt.hash('1234', 12);
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

  // Create Organization Admin for the default cooperative
  const orgAdminPin = await bcrypt.hash('2345', 12);
  const orgAdmin = await prisma.user.upsert({
    where: { phone: '+250788000002' },
    update: {},
    create: {
      phone: '+250788000002',
      pin: orgAdminPin,
      firstName: 'Organization',
      lastName: 'Admin',
      email: 'admin@defaultcoop.rw',
      role: UserRole.ORGANIZATION_ADMIN,
      status: UserStatus.ACTIVE,
      cooperativeId: defaultCooperative.id,
      profileData: {
        isVerified: true,
        permissions: ['MANAGE_MEMBERS', 'VIEW_TRANSACTIONS', 'MANAGE_PAYMENTS'],
      },
    },
  });

  console.log('✅ Created organization admin:', orgAdmin.phone);

  // Create a few tenant users
  const tenantPin = await bcrypt.hash('3456', 12);
  const tenant1 = await prisma.user.upsert({
    where: { phone: '+250788000003' },
    update: {},
    create: {
      phone: '+250788000003',
      pin: tenantPin,
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      role: UserRole.TENANT,
      status: UserStatus.ACTIVE,
      cooperativeId: defaultCooperative.id,
      profileData: {
        roomNumber: 'A101',
        membershipId: 'MEM001',
      },
    },
  });

  const tenant2 = await prisma.user.upsert({
    where: { phone: '+250788000004' },
    update: {},
    create: {
      phone: '+250788000004',
      pin: tenantPin,
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@example.com',
      role: UserRole.TENANT,
      status: UserStatus.ACTIVE,
      cooperativeId: defaultCooperative.id,
      profileData: {
        roomNumber: 'A102',
        membershipId: 'MEM002',
      },
    },
  });

  console.log('✅ Created tenant users:', [tenant1.phone, tenant2.phone]);

  // Create payment types
  const paymentTypes = [
    {
      name: 'Monthly Rent',
      description: 'Monthly rental payment',
      amount: 50000,
      isRecurring: true,
      dueDay: 1,
    },
    {
      name: 'Security Deposit',
      description: 'One-time security deposit',
      amount: 100000,
      isRecurring: false,
    },
    {
      name: 'Cleaning Fee',
      description: 'Monthly cleaning fee',
      amount: 5000,
      isRecurring: true,
      dueDay: 1,
    },
    {
      name: 'Utility Bill',
      description: 'Monthly utility payments',
      amount: 15000,
      isRecurring: true,
      dueDay: 5,
    },
  ];

  for (const paymentTypeData of paymentTypes) {
    const paymentType = await prisma.paymentType.upsert({
      where: {
        cooperativeId_name: {
          cooperativeId: defaultCooperative.id,
          name: paymentTypeData.name,
        },
      },
      update: {},
      create: {
        ...paymentTypeData,
        cooperativeId: defaultCooperative.id,
        isActive: true,
        allowPartialPayment: false,
        amountType: 'FIXED',
      },
    });
    console.log('✅ Created payment type:', paymentType.name);
  }

  // Seed cooperative categories
  await seedCooperativeCategories(prisma);

  console.log('🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
