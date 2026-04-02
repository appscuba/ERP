import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me';

export function signSession(payload: { id: string; email: string; companyId: string; role: string }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
}

export function readSession(req: any): null | { id: string; email: string; companyId: string; role: string } {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(auth.replace('Bearer ', ''), JWT_SECRET) as any;
  } catch {
    return null;
  }
}
