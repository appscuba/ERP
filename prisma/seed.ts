import { PrismaClient, RoleName } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.upsert({
    where: { id: 'seed-company-main' },
    update: {},
    create: {
      id: 'seed-company-main',
      name: 'ERP Demo Company',
      legalName: 'ERP Demo Company LLC',
      taxId: 'US-DEMO-001',
      currency: 'USD',
      defaultTaxRate: 15,
      invoicePrefix: 'INV',
      salePrefix: 'SALE',
    },
  });

  const permissions = [
    { code: 'inventory:manage', description: 'Inventario' },
    { code: 'sales:manage', description: 'Ventas' },
    { code: 'invoices:manage', description: 'Facturación' },
    { code: 'accounting:manage', description: 'Contabilidad' },
    { code: 'audit:read', description: 'Auditoría' },
    { code: 'users:manage', description: 'Usuarios' },
  ];

  await Promise.all(
    permissions.map((permission) =>
      prisma.permission.upsert({ where: { code: permission.code }, update: {}, create: permission }),
    ),
  );

  const allPermissions = await prisma.permission.findMany();

  const adminRole = await prisma.role.upsert({
    where: { name: RoleName.ADMIN },
    update: { permissions: { set: allPermissions.map((permission) => ({ id: permission.id })) } },
    create: {
      name: RoleName.ADMIN,
      permissions: { connect: allPermissions.map((permission) => ({ id: permission.id })) },
    },
  });

  await prisma.role.upsert({ where: { name: RoleName.CAJERO }, update: {}, create: { name: RoleName.CAJERO } });
  await prisma.role.upsert({ where: { name: RoleName.CONTADOR }, update: {}, create: { name: RoleName.CONTADOR } });
  await prisma.role.upsert({ where: { name: RoleName.SUPERVISOR }, update: {}, create: { name: RoleName.SUPERVISOR } });

  const password = await bcrypt.hash('123456', 10);
  await prisma.user.upsert({
    where: { companyId_email: { companyId: company.id, email: 'admin@admin.com' } },
    update: {},
    create: {
      companyId: company.id,
      email: 'admin@admin.com',
      password,
      name: 'Super Admin',
      roleId: adminRole.id,
      mustChangePassword: false,
    },
  });

  const category = await prisma.category.upsert({
    where: { companyId_name: { companyId: company.id, name: 'Electrónica' } },
    update: {},
    create: { companyId: company.id, name: 'Electrónica' },
  });

  await prisma.client.upsert({
    where: { id: 'seed-client-general' },
    update: {},
    create: { id: 'seed-client-general', companyId: company.id, name: 'Cliente General', taxId: 'CF' },
  });

  await prisma.product.upsert({
    where: { companyId_sku: { companyId: company.id, sku: 'PROD-001' } },
    update: {},
    create: {
      companyId: company.id,
      sku: 'PROD-001',
      name: 'Laptop Pro 14',
      price: 1200,
      cost: 900,
      stock: 50,
      minStock: 5,
      categoryId: category.id,
    },
  });

  await prisma.setting.createMany({
    data: [
      { companyId: company.id, key: 'company_name', value: company.name },
      { companyId: company.id, key: 'currency', value: company.currency },
      { companyId: company.id, key: 'default_tax_rate', value: '15' },
    ],
    skipDuplicates: true,
  });

  console.log('✅ Seed ready: admin@admin.com / 123456');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
