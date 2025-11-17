// Seed data for cooperative categories
export const cooperativeCategorySeedData = [
  {
    name: 'Residential Apartment',
    description: 'Residential apartment complexes and housing cooperatives',
    icon: '🏠',
    color: '#3B82F6',
    isActive: true,
    sortOrder: 1,
  },
  {
    name: 'Business Complex',
    description: 'Commercial buildings and business centers',
    icon: '🏢',
    color: '#10B981',
    isActive: true,
    sortOrder: 2,
  },
  {
    name: 'Coworking Space',
    description: 'Shared workspaces and coworking facilities',
    icon: '💼',
    color: '#F59E0B',
    isActive: true,
    sortOrder: 3,
  },
  {
    name: 'Student Housing',
    description: 'Student dormitories and residential facilities',
    icon: '🎓',
    color: '#8B5CF6',
    isActive: true,
    sortOrder: 4,
  },
  {
    name: 'Mixed Use',
    description: 'Properties with both residential and commercial use',
    icon: '🏘️',
    color: '#EF4444',
    isActive: true,
    sortOrder: 5,
  },
  {
    name: 'Industrial',
    description: 'Warehouses, factories, and industrial facilities',
    icon: '🏭',
    color: '#6B7280',
    isActive: true,
    sortOrder: 6,
  },
  {
    name: 'Retail',
    description: 'Shopping centers and retail complexes',
    icon: '🛍️',
    color: '#EC4899',
    isActive: true,
    sortOrder: 7,
  },
  {
    name: 'Hospitality',
    description: 'Hotels, hostels, and hospitality services',
    icon: '🏨',
    color: '#06B6D4',
    isActive: true,
    sortOrder: 8,
  },
];

// Function to seed cooperative categories
export async function seedCooperativeCategories(prisma: any) {
  console.log('🌱 Seeding cooperative categories...');

  for (const categoryData of cooperativeCategorySeedData) {
    try {
      const existingCategory = await prisma.cooperativeCategory.findUnique({
        where: { name: categoryData.name },
      });

      if (!existingCategory) {
        await prisma.cooperativeCategory.create({
          data: categoryData,
        });
        console.log(`✅ Created category: ${categoryData.name}`);
      } else {
        console.log(`⏭️  Category already exists: ${categoryData.name}`);
      }
    } catch (error) {
      console.error(
        `❌ Error creating category ${categoryData.name}:`,
        error.message,
      );
    }
  }

  console.log('✨ Cooperative categories seeding completed!');
}
