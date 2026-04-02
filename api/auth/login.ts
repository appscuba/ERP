import bcrypt from 'bcryptjs';
import { AuditAction } from '@prisma/client';
import { prisma } from '../_lib/prisma';
import { signSession } from '../_lib/auth';
import { audit } from '../_lib/audit';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  const { email, password } = req.body || {};
  const user = await prisma.user.findFirst({ where: { email, isActive: true, deletedAt: null }, include: { role: true } });
  if (!user) return res.status(401).json({ message: 'Credenciales inválidas' });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ message: 'Credenciales inválidas' });

  const token = signSession({ id: user.id, email: user.email, companyId: user.companyId, role: user.role.name });

  await audit({
    companyId: user.companyId,
    userId: user.id,
    action: AuditAction.LOGIN,
    module: 'auth',
    ipAddress: req.headers['x-forwarded-for'] as string,
    userAgent: req.headers['user-agent'] as string,
  });

  res.status(200).json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role.name } });
}
