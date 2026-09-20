import { Router } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';
import type { AuthedRequest } from '../types.js';
const router = Router();
router.get('/', requireAuth, async (req: AuthedRequest, res) => { const notifications = await prisma.notification.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' }, take: 30 }); const unread = await prisma.notification.count({ where: { userId: req.user!.id, read: false } }); res.json({ notifications, unread }); });
router.patch('/:id/read', requireAuth, async (req: AuthedRequest, res) => { const n = await prisma.notification.updateMany({ where: { id: String(req.params.id), userId: req.user!.id }, data: { read: true } }); res.json({ updated: n.count }); });
router.post('/read-all', requireAuth, async (req: AuthedRequest, res) => { await prisma.notification.updateMany({ where: { userId: req.user!.id, read: false }, data: { read: true } }); res.json({ ok: true }); });
export default router;
