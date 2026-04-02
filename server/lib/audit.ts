import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function createAuditLog({
  userId,
  action,
  module,
  recordId,
  oldValues,
  newValues,
  ipAddress,
  userAgent,
}: {
  userId?: string;
  action: string;
  module: string;
  recordId?: string;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        module,
        recordId,
        oldValues: oldValues ? JSON.stringify(oldValues) : null,
        newValues: newValues ? JSON.stringify(newValues) : null,
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
}
