import { AuditAction, InventoryMovementType } from '@prisma/client';
import { prisma } from '../_lib/prisma';
import { readSession } from '../_lib/auth';
import { audit } from '../_lib/audit';

export default async function handler(req: any, res: any) {
  const session = readSession(req);
  if (!session) return res.status(401).json({ message: 'No autorizado' });
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  const { items = [], clientId, subtotal, tax, total } = req.body || {};

  const sale = await prisma.$transaction(async (tx) => {
    const company = await tx.company.findUnique({ where: { id: session.companyId } });
    const salesCount = await tx.sale.count({ where: { companyId: session.companyId } });
    const invCount = await tx.invoice.count({ where: { companyId: session.companyId } });

    const saleNo = `${company?.salePrefix || 'SALE'}-${String(salesCount + 1).padStart(8, '0')}`;
    const invoiceNo = `${company?.invoicePrefix || 'INV'}-${String(invCount + 1).padStart(8, '0')}`;

    const created = await tx.sale.create({
      data: {
        companyId: session.companyId,
        saleNo,
        invoiceNo,
        userId: session.id,
        clientId,
        subtotal,
        tax,
        total,
        items: {
          create: items,
        },
      },
      include: { items: true },
    });

    await tx.invoice.create({
      data: {
        companyId: session.companyId,
        invoiceNo,
        saleId: created.id,
        clientId,
        subtotal,
        tax,
        total,
        createdById: session.id,
      },
    });

    for (const item of items) {
      await tx.product.update({ where: { id: item.productId }, data: { stock: { decrement: item.quantity } } });
      await tx.inventoryMovement.create({
        data: {
          companyId: session.companyId,
          productId: item.productId,
          type: InventoryMovementType.OUT,
          quantity: item.quantity,
          reference: created.id,
          createdById: session.id,
          createdBy: session.email,
        },
      });
    }

    return created;
  });

  await audit({
    companyId: session.companyId,
    userId: session.id,
    action: AuditAction.CREATE,
    module: 'sales',
    recordId: sale.id,
    newValues: sale,
    ipAddress: req.headers['x-forwarded-for'] as string,
    userAgent: req.headers['user-agent'] as string,
  });

  return res.status(201).json(sale);
}
