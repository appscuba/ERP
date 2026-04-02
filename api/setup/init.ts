import bcrypt from 'bcryptjs';
import { AuditAction, RoleName } from '@prisma/client';
import { prisma } from '../_lib/prisma';
import { audit } from '../_lib/audit';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  try {
    if (await prisma.company.count()) return res.status(400).json({ message: 'Sistema ya configurado' });

    const { companyName = 'Mi Empresa', name = 'Super Admin', email = 'admin@admin.com', password = '123456' } = req.body || {};

    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: { name: companyName, legalName: companyName, currency: 'USD', defaultTaxRate: 15 },
      });

      const adminRole = await tx.role.create({ data: { name: RoleName.ADMIN } });
      await tx.role.create({ data: { name: RoleName.CAJERO } });
      await tx.role.create({ data: { name: RoleName.CONTADOR } });
      await tx.role.create({ data: { name: RoleName.SUPERVISOR } });

      const user = await tx.user.create({
        data: {
          companyId: company.id,
          name,
          email,
          password: await bcrypt.hash(password, 10),
          roleId: adminRole.id,
          mustChangePassword: false,
        },
      });

      const category = await tx.category.create({ data: { companyId: company.id, name: 'General' } });
      await tx.product.create({ data: { companyId: company.id, sku: 'PROD-001', name: 'Producto Base', price: 100, cost: 70, stock: 100, categoryId: category.id } });
      await tx.client.create({ data: { companyId: company.id, name: 'Cliente General', taxId: 'CF' } });

      return { company, user };
    });

    await audit({
      companyId: result.company.id,
      userId: result.user.id,
      action: AuditAction.CREATE,
      module: 'setup',
      recordId: result.user.id,
      newValues: { companyName, email, name },
      ipAddress: req.headers['x-forwarded-for'] as string,
      userAgent: req.headers['user-agent'] as string,
    });

    res.status(200).json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: 'Error en setup' });
  }
}
