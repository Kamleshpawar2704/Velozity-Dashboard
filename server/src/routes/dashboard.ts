import { Router } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';
import type { AuthedRequest } from '../types.js';
const router = Router();

router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  const user = req.user!;
  if (user.role === 'ADMIN') {
    const [projects, taskCounts, overdue, recent] = await Promise.all([
      prisma.project.count(),
      prisma.task.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.task.count({ where: { overdue: true, status: { not: 'DONE' } } }),
      prisma.activity.findMany({ include: { user: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 20 })
    ]);
    return res.json({ role: user.role, projects, taskCounts, overdue, recent });
  }
  if (user.role === 'PM') {
    const projects = await prisma.project.findMany({ where: { creatorId: user.id }, include: { _count: { select: { tasks: true } } } });
    const tasks = await prisma.task.findMany({ where: { project: { creatorId: user.id } }, select: { priority: true, dueDate: true, status: true } });
    return res.json({ role: user.role, projects, tasks });
  }
  const tasks = await prisma.task.findMany({ where: { developerId: user.id }, include: { project: { select: { id: true, name: true } } }, orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }] });
  return res.json({ role: user.role, tasks });
});

export default router;
