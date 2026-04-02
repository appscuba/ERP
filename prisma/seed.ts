import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // 1. Roles
  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: { name: 'ADMIN' },
  });

  await prisma.role.upsert({
    where: { name: 'CAJERO' },
    update: {},
    create: { name: 'CAJERO' },
  });

  await prisma.role.upsert({
    where: { name: 'CONTADOR' },
    update: {},
    create: { name: 'CONTADOR' },
  });

  // 2. Admin User
  const hashedPassword = await bcrypt.hash('123456', 10);
  await prisma.user.upsert({
    where: { email: 'admin@admin.com' },
    update: {},
    create: {
      email: 'admin@admin.com',
      password: hashedPassword,
      name: 'Super Admin',
      roleId: adminRole.id,
    },
  });

  // 3. Categories
  const cat1 = await prisma.category.upsert({
    where: { name: 'Electrónica' },
    update: {},
    create: { name: 'Electrónica' },
  });

  // 4. Products
  await prisma.product.upsert({
    where: { sku: 'PROD-001' },
    update: {},
    create: {
      sku: 'PROD-001',
      name: 'Laptop Pro',
      price: 1200.00,
      cost: 800.00,
      stock: 50,
      categoryId: cat1.id,
    },
  });

  console.log('Seed completed successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
