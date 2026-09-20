import { Router } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';
import type { AuthedRequest } from '../types.js';
const router = Router();
router.get('/global', requireAuth, async (req: AuthedRequest, res) => {
  const where = req.user!.role === 'ADMIN' ? {} : req.user!.role === 'PM' ? { project: { creatorId: req.user!.id } } : { task: { developerId: req.user!.id } };
  const activities = await prisma.activity.findMany({ where, include: { user: { select: { name: true } }, task: { select: { id: true, title: true } }, project: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' }, take: 20 });
  res.json({ activities: activities.reverse() });
});
export default router;
