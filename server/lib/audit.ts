import { PrismaClient, AuditAction } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

interface AuditPayload {
  companyId?: string;
  userId?: string;
  action: AuditAction;
  module: string;
  recordId?: string;
  oldValues?: unknown;
  newValues?: unknown;
  ipAddress?: string;
  userAgent?: string;
}

function serializePayload(payload: Omit<AuditPayload, 'action'> & { action: string }, prevHash?: string) {
  return JSON.stringify({
    ...payload,
    oldValues: payload.oldValues ?? null,
    newValues: payload.newValues ?? null,
    prevHash: prevHash ?? null,
  });
}

function createHash(payload: string) {
  return crypto.createHash('sha256').update(payload).digest('hex');
}

export async function createAuditLog(payload: AuditPayload) {
  try {
    const lastLog = await prisma.auditLog.findFirst({ orderBy: { createdAt: 'desc' } });
    const prevHash = lastLog?.hash;
    const hash = createHash(serializePayload(payload, prevHash));

    await prisma.auditLog.create({
      data: {
        companyId: payload.companyId,
        userId: payload.userId,
        action: payload.action,
        module: payload.module,
        recordId: payload.recordId,
        oldValues: payload.oldValues as object | undefined,
        newValues: payload.newValues as object | undefined,
        ipAddress: payload.ipAddress,
        userAgent: payload.userAgent,
        prevHash,
        hash,
      },
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
}
