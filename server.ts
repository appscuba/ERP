import express from 'express';
import path from 'path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createServer as createViteServer } from 'vite';
import {
  AuditAction,
  InvoiceStatus,
  PrismaClient,
  RoleName,
  SaleStatus,
  InventoryMovementType,
} from '@prisma/client';
import { createAuditLog } from './server/lib/audit';
import { authenticateToken, AuthRequest } from './server/middleware/auth';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'erp-secret-key-123';

function toSequence(prefix: string, current: number) {
  return `${prefix}-${String(current + 1).padStart(8, '0')}`;
}

async function getActiveCompanyId() {
  const company = await prisma.company.findFirst({ where: { isActive: true } });
  if (!company) throw new Error('Company not configured');
  return company.id;
}

function getIp(req: express.Request) {
  return req.ip || req.socket.remoteAddress;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  app.use(express.json({ limit: '1mb' }));

  app.get('/api/setup/status', async (_, res) => {
    const companyCount = await prisma.company.count();
    res.json({ isSetup: companyCount > 0 });
  });

  app.post('/api/setup/init', async (req, res) => {
    const { email = 'admin@admin.com', password = '123456', name = 'Super Admin', companyName = 'Mi Empresa' } = req.body;
    try {
      const companyCount = await prisma.company.count();
      if (companyCount > 0) return res.status(400).json({ message: 'El sistema ya fue configurado' });

      const permissions = [
        { code: 'inventory:manage', description: 'Gestión de inventario' },
        { code: 'sales:manage', description: 'Gestión de ventas POS' },
        { code: 'invoices:manage', description: 'Gestión de facturación' },
        { code: 'accounting:manage', description: 'Gestión contable' },
        { code: 'audit:read', description: 'Ver auditoría' },
        { code: 'users:manage', description: 'Gestión de usuarios' },
      ];

      const created = await prisma.$transaction(async (tx) => {
        const company = await tx.company.create({
          data: {
            name: companyName,
            legalName: companyName,
            currency: 'USD',
            defaultTaxRate: 15,
            invoicePrefix: 'INV',
            salePrefix: 'SALE',
          },
        });

        await Promise.all(permissions.map((permission) => tx.permission.upsert({ where: { code: permission.code }, update: {}, create: permission })));
        const allPermissions = await tx.permission.findMany();

        const adminRole = await tx.role.create({
          data: {
            name: RoleName.ADMIN,
            permissions: { connect: allPermissions.map((permission) => ({ id: permission.id })) },
          },
        });

        await tx.role.create({ data: { name: RoleName.CAJERO } });
        await tx.role.create({ data: { name: RoleName.CONTADOR } });
        await tx.role.create({ data: { name: RoleName.SUPERVISOR } });

        const hashedPassword = await bcrypt.hash(password, 10);
        const admin = await tx.user.create({
          data: {
            companyId: company.id,
            email,
            password: hashedPassword,
            name,
            roleId: adminRole.id,
            mustChangePassword: false,
          },
        });

        const category = await tx.category.create({ data: { companyId: company.id, name: 'General' } });
        await tx.client.create({ data: { companyId: company.id, name: 'Cliente General', taxId: 'CF' } });
        await tx.product.create({
          data: {
            companyId: company.id,
            sku: 'PROD-001',
            name: 'Producto Demo',
            price: 100,
            cost: 60,
            stock: 100,
            categoryId: category.id,
          },
        });

        await tx.setting.createMany({
          data: [
            { companyId: company.id, key: 'company_name', value: companyName },
            { companyId: company.id, key: 'currency', value: 'USD' },
            { companyId: company.id, key: 'default_tax_rate', value: '15' },
          ],
        });

        return { admin, company };
      });

      await createAuditLog({
        companyId: created.company.id,
        userId: created.admin.id,
        action: AuditAction.CREATE,
        module: 'setup',
        recordId: created.admin.id,
        newValues: { email, name, company: companyName },
        ipAddress: getIp(req),
        userAgent: req.get('user-agent') || undefined,
      });

      res.json({ message: 'Configuración completada' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'No se pudo completar configuración inicial' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
      const user = await prisma.user.findFirst({ where: { email, deletedAt: null }, include: { role: true } });
      if (!user || !user.isActive) return res.status(401).json({ message: 'Credenciales inválidas' });

      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) return res.status(401).json({ message: 'Credenciales inválidas' });

      await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role.name, companyId: user.companyId },
        JWT_SECRET,
        { expiresIn: '8h' },
      );

      await createAuditLog({
        companyId: user.companyId,
        userId: user.id,
        action: AuditAction.LOGIN,
        module: 'auth',
        ipAddress: getIp(req),
        userAgent: req.get('user-agent') || undefined,
      });

      res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role.name, mustChangePassword: user.mustChangePassword } });
    } catch {
      res.status(500).json({ message: 'Error de servidor' });
    }
  });

  app.post('/api/auth/logout', authenticateToken, async (req: AuthRequest, res) => {
    await createAuditLog({
      companyId: req.user?.companyId,
      userId: req.user?.id,
      action: AuditAction.LOGOUT,
      module: 'auth',
      ipAddress: getIp(req),
      userAgent: req.get('user-agent') || undefined,
    });
    res.json({ message: 'Sesión cerrada' });
  });

  app.get('/api/products', authenticateToken, async (req: AuthRequest, res) => {
    const products = await prisma.product.findMany({
      where: { companyId: req.user!.companyId, deletedAt: null },
      include: { category: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(products);
  });

  app.post('/api/products', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      const product = await prisma.product.create({ data: { ...req.body, companyId } });
      await createAuditLog({
        companyId,
        userId: req.user?.id,
        action: AuditAction.CREATE,
        module: 'inventory',
        recordId: product.id,
        newValues: product,
        ipAddress: getIp(req),
      });
      res.status(201).json(product);
    } catch {
      res.status(400).json({ message: 'No se pudo crear producto' });
    }
  });

  app.put('/api/products/:id', authenticateToken, async (req: AuthRequest, res) => {
    const { id } = req.params;
    const oldValues = await prisma.product.findFirst({ where: { id, companyId: req.user!.companyId } });
    if (!oldValues) return res.status(404).json({ message: 'Producto no encontrado' });

    const product = await prisma.product.update({ where: { id }, data: req.body });
    await createAuditLog({
      companyId: req.user!.companyId,
      userId: req.user?.id,
      action: AuditAction.UPDATE,
      module: 'inventory',
      recordId: id,
      oldValues,
      newValues: product,
      ipAddress: getIp(req),
    });

    res.json(product);
  });

  app.delete('/api/products/:id', authenticateToken, async (req: AuthRequest, res) => {
    const { id } = req.params;
    const oldValues = await prisma.product.findFirst({ where: { id, companyId: req.user!.companyId } });
    if (!oldValues) return res.status(404).json({ message: 'Producto no encontrado' });

    const product = await prisma.product.update({ where: { id }, data: { isActive: false, deletedAt: new Date() } });
    await createAuditLog({
      companyId: req.user!.companyId,
      userId: req.user?.id,
      action: AuditAction.DELETE,
      module: 'inventory',
      recordId: id,
      oldValues,
      newValues: product,
      ipAddress: getIp(req),
    });

    res.json({ message: 'Producto desactivado' });
  });

  app.post('/api/sales', authenticateToken, async (req: AuthRequest, res) => {
    const { items, clientId, subtotal, tax, total } = req.body;
    const companyId = req.user!.companyId;

    try {
      const sale = await prisma.$transaction(async (tx) => {
        const [company, saleCount, invoiceCount] = await Promise.all([
          tx.company.findUnique({ where: { id: companyId } }),
          tx.sale.count({ where: { companyId } }),
          tx.invoice.count({ where: { companyId } }),
        ]);

        const saleNo = toSequence(company?.salePrefix || 'SALE', saleCount);
        const invoiceNo = toSequence(company?.invoicePrefix || 'INV', invoiceCount);

        const createdSale = await tx.sale.create({
          data: {
            companyId,
            saleNo,
            subtotal,
            tax,
            total,
            userId: req.user!.id,
            clientId,
            invoiceNo,
            items: {
              create: items.map((item: { productId: string; quantity: number; price: number; tax: number; total: number }) => ({
                productId: item.productId,
                quantity: item.quantity,
                price: item.price,
                tax: item.tax,
                total: item.total,
              })),
            },
          },
          include: { items: true },
        });

        await tx.invoice.create({
          data: {
            companyId,
            invoiceNo,
            saleId: createdSale.id,
            clientId,
            subtotal,
            tax,
            total,
            createdById: req.user!.id,
          },
        });

        for (const item of items) {
          await tx.product.update({ where: { id: item.productId }, data: { stock: { decrement: item.quantity } } });
          await tx.inventoryMovement.create({
            data: {
              companyId,
              productId: item.productId,
              type: InventoryMovementType.OUT,
              quantity: item.quantity,
              reason: `Venta ${saleNo}`,
              reference: createdSale.id,
              createdById: req.user!.id,
              createdBy: req.user!.email,
            },
          });
        }

        await tx.accountingEntry.createMany({
          data: [
            {
              companyId,
              entryNo: `${saleNo}-D`,
              accountCode: '1101',
              description: `Venta ${saleNo}`,
              debit: total,
              credit: 0,
              reference: createdSale.id,
            },
            {
              companyId,
              entryNo: `${saleNo}-C`,
              accountCode: '4101',
              description: `Ingreso de venta ${saleNo}`,
              debit: 0,
              credit: total,
              reference: createdSale.id,
            },
          ],
        });

        return createdSale;
      });

      await createAuditLog({
        companyId,
        userId: req.user!.id,
        action: AuditAction.CREATE,
        module: 'sales',
        recordId: sale.id,
        newValues: sale,
        ipAddress: getIp(req),
      });

      res.status(201).json(sale);
    } catch (error) {
      console.error(error);
      res.status(400).json({ message: 'No se pudo registrar venta' });
    }
  });

  app.post('/api/sales/:id/void', authenticateToken, async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    const companyId = req.user!.companyId;

    const oldSale = await prisma.sale.findFirst({ where: { id, companyId }, include: { items: true } });
    if (!oldSale) return res.status(404).json({ message: 'Venta no encontrada' });

    const sale = await prisma.$transaction(async (tx) => {
      const voidedSale = await tx.sale.update({
        where: { id },
        data: {
          status: SaleStatus.VOIDED,
          voidReason: reason,
          voidedById: req.user!.id,
          voidedAt: new Date(),
        },
        include: { items: true },
      });

      await tx.invoice.updateMany({
        where: { saleId: id },
        data: { status: InvoiceStatus.VOIDED, voidReason: reason, voidedById: req.user!.id, voidedAt: new Date() },
      });

      for (const item of voidedSale.items) {
        await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
        await tx.inventoryMovement.create({
          data: {
            companyId,
            productId: item.productId,
            type: InventoryMovementType.RETURN,
            quantity: item.quantity,
            reason: `Anulación de venta ${voidedSale.saleNo}`,
            reference: voidedSale.id,
            createdById: req.user!.id,
            createdBy: req.user!.email,
          },
        });
      }

      return voidedSale;
    });

    await createAuditLog({
      companyId,
      userId: req.user!.id,
      action: AuditAction.VOID,
      module: 'sales',
      recordId: sale.id,
      oldValues: oldSale,
      newValues: { status: SaleStatus.VOIDED, reason },
      ipAddress: getIp(req),
    });

    res.json(sale);
  });

  app.get('/api/invoices', authenticateToken, async (req: AuthRequest, res) => {
    const invoices = await prisma.invoice.findMany({
      where: { companyId: req.user!.companyId },
      include: { client: true, sale: true, createdBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(invoices);
  });

  app.post('/api/users', authenticateToken, async (req: AuthRequest, res) => {
    if (req.user?.role !== RoleName.ADMIN) return res.status(403).json({ message: 'Solo ADMIN' });
    const { email, name, roleName, password = '123456' } = req.body;

    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) return res.status(400).json({ message: 'Rol inválido' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        companyId: req.user.companyId,
        email,
        name,
        password: hashed,
        roleId: role.id,
      },
      include: { role: true },
    });

    await createAuditLog({
      companyId: req.user.companyId,
      userId: req.user.id,
      action: AuditAction.CREATE,
      module: 'users',
      recordId: user.id,
      newValues: { email, name, role: role.name },
      ipAddress: getIp(req),
    });

    res.status(201).json(user);
  });

  app.patch('/api/users/:id/role', authenticateToken, async (req: AuthRequest, res) => {
    if (req.user?.role !== RoleName.ADMIN) return res.status(403).json({ message: 'Solo ADMIN' });
    const role = await prisma.role.findUnique({ where: { name: req.body.roleName } });
    if (!role) return res.status(400).json({ message: 'Rol inválido' });

    const existing = await prisma.user.findFirst({ where: { id: req.params.id, companyId: req.user.companyId }, include: { role: true } });
    if (!existing) return res.status(404).json({ message: 'Usuario no encontrado' });

    const updated = await prisma.user.update({ where: { id: req.params.id }, data: { roleId: role.id }, include: { role: true } });
    await createAuditLog({
      companyId: req.user.companyId,
      userId: req.user.id,
      action: AuditAction.PERMISSION_CHANGE,
      module: 'users',
      recordId: updated.id,
      oldValues: { role: existing.role.name },
      newValues: { role: updated.role.name },
      ipAddress: getIp(req),
    });

    res.json(updated);
  });

  app.get('/api/reports/dashboard', authenticateToken, async (req: AuthRequest, res) => {
    const companyId = req.user!.companyId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [activeProducts, todaySales, pendingInvoices, recentAuditEvents] = await Promise.all([
      prisma.product.count({ where: { companyId, deletedAt: null, isActive: true } }),
      prisma.sale.aggregate({
        where: { companyId, status: SaleStatus.COMPLETED, createdAt: { gte: today } },
        _sum: { total: true },
        _count: true,
      }),
      prisma.invoice.count({ where: { companyId, status: InvoiceStatus.ISSUED } }),
      prisma.auditLog.findMany({ where: { companyId }, take: 8, orderBy: { createdAt: 'desc' } }),
    ]);

    res.json({
      activeProducts,
      todaySales: todaySales._sum.total || 0,
      transactionsToday: todaySales._count,
      pendingInvoices,
      recentAuditEvents,
    });
  });

  app.get('/api/reports/daily-close', authenticateToken, async (req: AuthRequest, res) => {
    const companyId = req.user!.companyId;
    const date = req.query.date ? new Date(String(req.query.date)) : new Date();
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const sales = await prisma.sale.findMany({
      where: { companyId, createdAt: { gte: start, lte: end } },
      select: { id: true, saleNo: true, total: true, status: true, createdAt: true },
    });

    const totals = sales.reduce(
      (acc, sale) => {
        const value = Number(sale.total);
        if (sale.status === SaleStatus.VOIDED) acc.voided += value;
        else acc.completed += value;
        return acc;
      },
      { completed: 0, voided: 0 },
    );

    res.json({ date: start.toISOString(), sales, totals, net: totals.completed - totals.voided });
  });

  app.get('/api/accounting/entries', authenticateToken, async (req: AuthRequest, res) => {
    const entries = await prisma.accountingEntry.findMany({
      where: { companyId: req.user!.companyId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(entries);
  });

  app.get('/api/audit-logs', authenticateToken, async (req: AuthRequest, res) => {
    if (req.user?.role !== RoleName.ADMIN) return res.status(403).json({ message: 'Solo ADMIN puede ver auditoría completa' });

    const { action, module, userId, from, to, recordId } = req.query;
    const logs = await prisma.auditLog.findMany({
      where: {
        companyId: req.user.companyId,
        action: action ? (String(action).toUpperCase() as AuditAction) : undefined,
        module: module ? String(module) : undefined,
        userId: userId ? String(userId) : undefined,
        recordId: recordId ? String(recordId) : undefined,
        createdAt: from || to ? { gte: from ? new Date(String(from)) : undefined, lte: to ? new Date(String(to)) : undefined } : undefined,
      },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });

    res.json(logs);
  });

  app.get('/api/audit-logs/timeline/:module/:recordId', authenticateToken, async (req: AuthRequest, res) => {
    if (req.user?.role !== RoleName.ADMIN) return res.status(403).json({ message: 'Solo ADMIN' });

    const timeline = await prisma.auditLog.findMany({
      where: { companyId: req.user.companyId, module: req.params.module, recordId: req.params.recordId },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });

    res.json(timeline);
  });

  app.get('/api/audit-logs/export', authenticateToken, async (req: AuthRequest, res) => {
    if (req.user?.role !== RoleName.ADMIN) return res.status(403).json({ message: 'Solo ADMIN' });

    const logs = await prisma.auditLog.findMany({
      where: { companyId: req.user.companyId },
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    const header = ['id', 'timestamp', 'usuario', 'accion', 'modulo', 'record_id', 'ip', 'hash'];
    const rows = logs.map((log) => [
      log.id,
      log.createdAt.toISOString(),
      log.user?.email || '',
      log.action,
      log.module,
      log.recordId || '',
      log.ipAddress || '',
      log.hash,
    ]);

    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="audit_logs.csv"');
    res.send(csv);
  });

  app.get('/api/audit-logs/suspicious', authenticateToken, async (req: AuthRequest, res) => {
    if (req.user?.role !== RoleName.ADMIN) return res.status(403).json({ message: 'Solo ADMIN' });
    const lastHour = new Date(Date.now() - 60 * 60 * 1000);

    const [voidEvents, adminActions, deletes] = await Promise.all([
      prisma.auditLog.count({ where: { companyId: req.user.companyId, action: AuditAction.VOID, createdAt: { gte: lastHour } } }),
      prisma.auditLog.count({ where: { companyId: req.user.companyId, action: AuditAction.ADMIN_ACTION, createdAt: { gte: lastHour } } }),
      prisma.auditLog.count({ where: { companyId: req.user.companyId, action: AuditAction.DELETE, createdAt: { gte: lastHour } } }),
    ]);

    const alerts = [];
    if (voidEvents >= 5) alerts.push({ severity: 'high', reason: 'Alto número de anulaciones en la última hora', value: voidEvents });
    if (deletes >= 10) alerts.push({ severity: 'high', reason: 'Alto número de eliminaciones lógicas', value: deletes });
    if (adminActions >= 20) alerts.push({ severity: 'medium', reason: 'Muchas acciones administrativas', value: adminActions });

    res.json({ lastHour: lastHour.toISOString(), alerts });
  });

  // Legacy route compatibility
  app.get('/api/inventory', authenticateToken, async (req: AuthRequest, res) => {
    const products = await prisma.product.findMany({ where: { companyId: req.user!.companyId, deletedAt: null }, include: { category: true } });
    res.json(products);
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', async () => {
    try {
      await getActiveCompanyId();
    } catch {
      console.warn('Sistema sin inicializar. Usa /api/setup/init');
    }
    console.log(`ERP running at http://localhost:${PORT}`);
  });
}

startServer();
