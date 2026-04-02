import crypto from 'crypto';
import { AuditAction } from '@prisma/client';
import { prisma } from './prisma';

export async function audit(data: {
  companyId?: string;
  userId?: string;
  action: AuditAction;
  module: string;
  recordId?: string;
  oldValues?: unknown;
  newValues?: unknown;
  ipAddress?: string;
  userAgent?: string;
}) {
  const last = await prisma.auditLog.findFirst({ orderBy: { createdAt: 'desc' } });
  const prevHash = last?.hash || null;
  const hash = crypto.createHash('sha256').update(JSON.stringify({ ...data, prevHash })).digest('hex');

  await prisma.auditLog.create({
    data: {
      ...data,
      oldValues: data.oldValues as object | undefined,
      newValues: data.newValues as object | undefined,
      prevHash,
      hash,
    },
  });
}
