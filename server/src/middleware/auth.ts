import jwt from 'jsonwebtoken';
import type { NextFunction, Response } from 'express';
import { prisma } from '../prisma.js';
import type { AuthedRequest, AuthUser } from '../types.js';

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
  try {
    const payload = jwt.verify(header.slice(7), process.env.ACCESS_TOKEN_SECRET!) as jwt.JwtPayload;
    const user = await prisma.user.findUnique({ where: { id: String(payload.sub) }, select: { id: true, name: true, email: true, role: true } });
    if (!user) throw new Error('missing user');
    req.user = user as AuthUser;
    next();
  } catch {
    return res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Invalid or expired access token' } });
  }
}

export function allowRoles(...roles: AuthUser['role'][]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You do not have permission for this resource' } });
    next();
  };
}
