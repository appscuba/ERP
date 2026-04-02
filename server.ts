import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createAuditLog } from './server/lib/audit';
import { authenticateToken, AuthRequest } from './server/middleware/auth';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'erp-secret-key-123';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- Auth Routes ---
  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
      const user = await prisma.user.findUnique({
        where: { email },
        include: { role: true },
      });

      if (!user || !user.isActive) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role.name },
        JWT_SECRET,
        { expiresIn: '8h' }
      );

      await createAuditLog({
        userId: user.id,
        action: 'LOGIN',
        module: 'auth',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.json({
        token,
        user: { id: user.id, email: user.email, name: user.name, role: user.role.name },
      });
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  });

  // --- Inventory Routes ---
  app.get('/api/inventory', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const products = await prisma.product.findMany({
        where: { isActive: true },
        include: { category: true },
      });
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching inventory' });
    }
  });

  app.post('/api/inventory', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const product = await prisma.product.create({
        data: { ...req.body },
      });

      await createAuditLog({
        userId: req.user?.id,
        action: 'CREATE',
        module: 'inventory',
        recordId: product.id,
        newValues: product,
        ipAddress: req.ip,
      });

      res.status(201).json(product);
    } catch (error) {
      res.status(500).json({ message: 'Error creating product' });
    }
  });

  app.put('/api/inventory/:id', authenticateToken, async (req: AuthRequest, res) => {
    const { id } = req.params;
    try {
      const oldProduct = await prisma.product.findUnique({ where: { id } });
      const product = await prisma.product.update({
        where: { id },
        data: req.body,
      });

      await createAuditLog({
        userId: req.user?.id,
        action: 'UPDATE',
        module: 'inventory',
        recordId: product.id,
        oldValues: oldProduct,
        newValues: product,
        ipAddress: req.ip,
      });

      res.json(product);
    } catch (error) {
      res.status(500).json({ message: 'Error updating product' });
    }
  });

  app.delete('/api/inventory/:id', authenticateToken, async (req: AuthRequest, res) => {
    const { id } = req.params;
    try {
      const product = await prisma.product.update({
        where: { id },
        data: { isActive: false },
      });

      await createAuditLog({
        userId: req.user?.id,
        action: 'DELETE', // Soft delete
        module: 'inventory',
        recordId: product.id,
        newValues: { isActive: false },
        ipAddress: req.ip,
      });

      res.json({ message: 'Product deactivated' });
    } catch (error) {
      res.status(500).json({ message: 'Error deleting product' });
    }
  });

  // --- Sales Routes ---
  app.get('/api/sales', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const sales = await prisma.sale.findMany({
        include: { items: { include: { product: true } }, user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      });
      res.json(sales);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching sales' });
    }
  });

  app.post('/api/sales/:id/void', authenticateToken, async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    try {
      const sale = await prisma.$transaction(async (tx) => {
        const updatedSale = await tx.sale.update({
          where: { id },
          data: { 
            status: 'VOIDED',
            voidReason: reason,
            voidedById: req.user!.id
          },
          include: { items: true }
        });

        // Restore stock
        for (const item of updatedSale.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } }
          });
        }
        return updatedSale;
      });

      await createAuditLog({
        userId: req.user?.id,
        action: 'VOID',
        module: 'sales',
        recordId: sale.id,
        newValues: { status: 'VOIDED', reason },
        ipAddress: req.ip,
      });

      res.json(sale);
    } catch (error) {
      res.status(500).json({ message: 'Error voiding sale' });
    }
  });

  app.post('/api/sales', authenticateToken, async (req: AuthRequest, res) => {
    const { items, clientId, total, tax, subtotal } = req.body;
    try {
      const sale = await prisma.$transaction(async (tx) => {
        // 1. Create Sale
        const newSale = await tx.sale.create({
          data: {
            invoiceNo: `INV-${Date.now()}`,
            total,
            tax,
            subtotal,
            userId: req.user!.id,
            clientId,
            items: {
              create: items.map((item: any) => ({
                productId: item.productId,
                quantity: item.quantity,
                price: item.price,
                tax: item.tax,
              })),
            },
          },
          include: { items: true },
        });

        // 2. Update Stock
        for (const item of items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.quantity } },
          });
        }

        return newSale;
      });

      await createAuditLog({
        userId: req.user?.id,
        action: 'CREATE',
        module: 'sales',
        recordId: sale.id,
        newValues: sale,
        ipAddress: req.ip,
      });

      res.status(201).json(sale);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error processing sale' });
    }
  });

  // --- Audit Logs Route ---
  app.get('/api/audit-logs', authenticateToken, async (req: AuthRequest, res) => {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Forbidden' });
    }
    try {
      const logs = await prisma.auditLog.findMany({
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
      });
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching audit logs' });
    }
  });

  // --- Vite Setup ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
