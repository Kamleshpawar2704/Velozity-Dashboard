import 'dotenv/config';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { Response } from 'express';
import type { Role } from '@prisma/client';
import { prisma } from '../prisma.js';

const accessSecret = process.env.ACCESS_TOKEN_SECRET!;
const refreshSecret = process.env.REFRESH_TOKEN_SECRET!;

export function signAccess(user: { id: string; role: Role }) {
  return jwt.sign({ sub: user.id, role: user.role }, accessSecret, { expiresIn: '15m' });
}

export async function issueRefresh(userId: string, res: Response) {
  const token = jwt.sign({ sub: userId }, refreshSecret, { expiresIn: '7d' });
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  await prisma.refreshToken.create({ data: { tokenHash, userId, expiresAt: new Date(Date.now() + 7 * 86400000) } });
  const crossSite = process.env.NODE_ENV === 'production';
  res.cookie('refreshToken', token, { httpOnly: true, secure: crossSite, sameSite: crossSite ? 'none' : 'lax', path: '/api/auth' });
}

export function clearRefresh(res: Response) {
  const crossSite = process.env.NODE_ENV === 'production';
  res.clearCookie('refreshToken', { httpOnly: true, secure: crossSite, sameSite: crossSite ? 'none' : 'lax', path: '/api/auth' });
}

export function hashToken(token: string) { return crypto.createHash('sha256').update(token).digest('hex'); }
export { refreshSecret, bcrypt };
