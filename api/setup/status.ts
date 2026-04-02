import { prisma } from '../_lib/prisma';

export default async function handler(_req: any, res: any) {
  const count = await prisma.company.count();
  res.status(200).json({ isSetup: count > 0 });
}
