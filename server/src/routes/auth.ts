import { Router } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma.js';
import { bcrypt, clearRefresh, hashToken, issueRefresh, refreshSecret, signAccess } from '../utils/auth.js';
import { requireAuth } from '../middleware/auth.js';
import type { AuthedRequest } from '../types.js';

const router = Router();
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(6) });

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ error: { code: 'BAD_CREDENTIALS', message: 'Email or password is incorrect' } });
    await issueRefresh(user.id, res);
    return res.json({ accessToken: signAccess(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (e) { next(e); }
});

router.post('/refresh', async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) return res.status(401).json({ error: { code: 'NO_REFRESH', message: 'Refresh token missing' } });
  try {
    const payload = jwt.verify(token, refreshSecret) as jwt.JwtPayload;
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
    if (!stored || stored.expiresAt < new Date() || stored.user.id !== String(payload.sub)) throw new Error('invalid');
    await prisma.refreshToken.delete({ where: { id: stored.id } });
    await issueRefresh(stored.userId, res);
    return res.json({ accessToken: signAccess(stored.user), user: { id: stored.user.id, name: stored.user.name, email: stored.user.email, role: stored.user.role } });
  } catch { clearRefresh(res); return res.status(401).json({ error: { code: 'INVALID_REFRESH', message: 'Refresh token is invalid or expired' } }); }
});

router.post('/logout', async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (token) await prisma.refreshToken.deleteMany({ where: { tokenHash: hashToken(token) } });
  clearRefresh(res); return res.json({ ok: true });
});

router.get('/me', requireAuth, async (req: AuthedRequest, res) => res.json({ user: req.user }));
export default router;
