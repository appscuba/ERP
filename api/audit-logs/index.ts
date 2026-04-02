import { prisma } from '../_lib/prisma';
import { readSession } from '../_lib/auth';

export default async function handler(req: any, res: any) {
  const session = readSession(req);
  if (!session) return res.status(401).json({ message: 'No autorizado' });
  if (session.role !== 'ADMIN') return res.status(403).json({ message: 'Solo ADMIN' });

  const logs = await prisma.auditLog.findMany({
    where: { companyId: session.companyId },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  res.status(200).json(logs);
}
