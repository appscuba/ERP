import { AuditAction } from '@prisma/client';
import { prisma } from '../_lib/prisma';
import { readSession } from '../_lib/auth';
import { audit } from '../_lib/audit';

export default async function handler(req: any, res: any) {
  const session = readSession(req);
  if (!session) return res.status(401).json({ message: 'No autorizado' });

  if (req.method === 'GET') {
    const products = await prisma.product.findMany({ where: { companyId: session.companyId, isActive: true, deletedAt: null }, include: { category: true } });
    return res.status(200).json(products);
  }

  if (req.method === 'POST') {
    const { sku, name, price, cost, stock = 0, category = 'General' } = req.body || {};
    const cat = await prisma.category.upsert({
      where: { companyId_name: { companyId: session.companyId, name: category } },
      update: {},
      create: { companyId: session.companyId, name: category },
    });

    const product = await prisma.product.create({
      data: { companyId: session.companyId, sku, name, price, cost, stock, categoryId: cat.id },
    });

    await audit({
      companyId: session.companyId,
      userId: session.id,
      action: AuditAction.CREATE,
      module: 'inventory',
      recordId: product.id,
      newValues: product,
      ipAddress: req.headers['x-forwarded-for'] as string,
      userAgent: req.headers['user-agent'] as string,
    });

    return res.status(201).json(product);
  }

  res.status(405).json({ message: 'Method not allowed' });
}
