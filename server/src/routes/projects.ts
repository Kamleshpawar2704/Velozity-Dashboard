import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { allowRoles, requireAuth } from '../middleware/auth.js';
import type { AuthedRequest } from '../types.js';
import { recordActivity } from '../services/activity.js';
import { notify } from '../services/notifications.js';
import type { Server } from 'socket.io';

const projectSchema = z.object({ name: z.string().min(2), description: z.string().optional(), clientId: z.string().min(1) });
const taskSchema = z.object({ title: z.string().min(2), description: z.string().optional(), developerId: z.string(), status: z.enum(['TODO','IN_PROGRESS','IN_REVIEW','DONE']).default('TODO'), priority: z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).default('MEDIUM'), dueDate: z.coerce.date() });
const router = Router();
const statusLabel = (status: string) => ({ TODO: 'To Do', IN_PROGRESS: 'In Progress', IN_REVIEW: 'In Review', DONE: 'Done' }[status] ?? status);
const canSeeProject = async (req: AuthedRequest, projectId: string) => {
  const p = await prisma.project.findUnique({ where: { id: projectId } });
  if (!p) return null;
  if (req.user!.role === 'ADMIN') return p;
  if (req.user!.role === 'PM' && p.creatorId === req.user!.id) return p;
  if (req.user!.role === 'DEVELOPER') {
    const assigned = await prisma.task.count({ where: { projectId, developerId: req.user!.id } });
    return assigned > 0 ? p : undefined;
  }
  return undefined;
};

router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  const where = req.user!.role === 'ADMIN' ? {} : req.user!.role === 'PM' ? { creatorId: req.user!.id } : { tasks: { some: { developerId: req.user!.id } } };
  const projects = await prisma.project.findMany({ where, include: { client: true, creator: { select: { id: true, name: true } }, _count: { select: { tasks: true } } }, orderBy: { updatedAt: 'desc' } });
  res.json({ projects });
});

router.patch('/:projectId', requireAuth, allowRoles('ADMIN','PM'), async (req: AuthedRequest, res, next) => {
  try {
    const project = await prisma.project.findUnique({ where: { id: String(req.params.projectId) } });
    if (!project) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found' } });
    if (req.user!.role === 'PM' && project.creatorId !== req.user!.id) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Project access denied' } });
    const body = z.object({ name: z.string().min(2).optional(), description: z.string().optional(), clientId: z.string().min(1).optional() }).parse(req.body);
    const updated = await prisma.project.update({ where: { id: project.id }, data: body });
    res.json({ project: updated });
  } catch (e) { next(e); }
});

router.delete('/:projectId', requireAuth, allowRoles('ADMIN','PM'), async (req: AuthedRequest, res) => {
  const project = await prisma.project.findUnique({ where: { id: String(req.params.projectId) } });
  if (!project) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found' } });
  if (req.user!.role === 'PM' && project.creatorId !== req.user!.id) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Project access denied' } });
  await prisma.project.delete({ where: { id: project.id } });
  res.json({ ok: true });
});

router.post('/', requireAuth, allowRoles('ADMIN','PM'), async (req: AuthedRequest, res, next) => {
  try { const body = projectSchema.parse(req.body); const project = await prisma.project.create({ data: { ...body, creatorId: req.user!.id } }); res.status(201).json({ project }); } catch(e) { next(e); }
});

router.get('/:projectId', requireAuth, async (req: AuthedRequest, res) => {
  const p = await canSeeProject(req, String(req.params.projectId));
  if (!p) return res.status(p === null ? 404 : 403).json({ error: { code: p === null ? 'NOT_FOUND' : 'FORBIDDEN', message: p === null ? 'Project not found' : 'Project access denied' } });
  const query = z.object({ status: z.enum(['TODO','IN_PROGRESS','IN_REVIEW','DONE']).optional(), priority: z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).optional(), from: z.coerce.date().optional(), to: z.coerce.date().optional() }).parse(req.query);
  const tasks = await prisma.task.findMany({ where: { projectId: p.id, ...(req.user!.role === 'DEVELOPER' ? { developerId: req.user!.id } : {}), ...(query.status ? { status: query.status } : {}), ...(query.priority ? { priority: query.priority } : {}), ...(query.from || query.to ? { dueDate: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } } : {}) }, include: { developer: { select: { id: true, name: true, email: true } } }, orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }] });
  res.json({ project: p, tasks });
});

router.post('/:projectId/tasks', requireAuth, allowRoles('ADMIN','PM'), async (req: AuthedRequest, res, next) => {
  try {
    const p = await canSeeProject(req, String(req.params.projectId)); if (!p) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Project access denied' } });
    const body = taskSchema.parse(req.body);
    const dev = await prisma.user.findUnique({ where: { id: body.developerId } }); if (!dev || dev.role !== 'DEVELOPER') return res.status(400).json({ error: { code: 'BAD_DEVELOPER', message: 'Assigned user must be a developer' } });
    const task = await prisma.task.create({ data: { ...body, projectId: p.id }, include: { developer: { select: { id: true, name: true } } } });
    const io = req.app.get('io') as Server; await recordActivity(io, { projectId: p.id, taskId: task.id, userId: req.user!.id, type: 'TASK_CREATED', message: `${req.user!.name} created Task #${task.id}` }); await notify(io, body.developerId, `Task #${task.id} was assigned to you`);
    res.status(201).json({ task });
  } catch(e) { next(e); }
});

router.patch('/:projectId/tasks/:taskId', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const taskId = Number(String(req.params.taskId)); const task = await prisma.task.findUnique({ where: { id: taskId }, include: { project: true } });
    if (!task || task.projectId !== String(req.params.projectId)) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Task not found' } });
    const isAdmin = req.user!.role === 'ADMIN'; const isOwnerPm = req.user!.role === 'PM' && task.project.creatorId === req.user!.id; const isDev = req.user!.role === 'DEVELOPER' && task.developerId === req.user!.id;
    if (!isAdmin && !isOwnerPm && !isDev) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Task access denied' } });
    const body = z.object({ status: z.enum(['TODO','IN_PROGRESS','IN_REVIEW','DONE']).optional(), priority: z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).optional(), title: z.string().min(2).optional(), description: z.string().optional(), dueDate: z.coerce.date().optional(), developerId: z.string().optional() }).parse(req.body);
    if (isDev && Object.keys(body).some(k => k !== 'status')) return res.status(403).json({ error: { code: 'STATUS_ONLY', message: 'Developers can only update task status' } });
    if (body.developerId) { const d = await prisma.user.findUnique({ where: { id: body.developerId } }); if (!d || d.role !== 'DEVELOPER') return res.status(400).json({ error: { code: 'BAD_DEVELOPER', message: 'Assigned user must be a developer' } }); }
    const nextDueDate = body.dueDate ?? task.dueDate;
    const nextStatus = body.status ?? task.status;
    const updated = await prisma.task.update({ where: { id: taskId }, data: { ...body, overdue: nextDueDate < new Date() && nextStatus !== 'DONE' }, include: { developer: { select: { id: true, name: true } } } });
    const io = req.app.get('io') as Server;
    if (body.status && body.status !== task.status) {
      const message = `${req.user!.name} moved Task #${task.id} from ${statusLabel(task.status)} → ${statusLabel(body.status)}`;
      await recordActivity(io, { projectId: task.projectId, taskId: task.id, userId: req.user!.id, type: 'STATUS_CHANGED', message, fromValue: task.status, toValue: body.status });
      if (body.status === 'IN_REVIEW' && task.project.creatorId !== req.user!.id) await notify(io, task.project.creatorId, `Task #${task.id} is ready for review`);
    }
    if (body.developerId && body.developerId !== task.developerId) await notify(io, body.developerId, `Task #${task.id} was assigned to you`);
    res.json({ task: updated });
  } catch(e) { next(e); }
});

router.get('/:projectId/activity', requireAuth, async (req: AuthedRequest, res) => {
  const p = await canSeeProject(req, String(req.params.projectId)); if (!p) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Project access denied' } });
  const activities = await prisma.activity.findMany({ where: { projectId: p.id, ...(req.user!.role === 'DEVELOPER' ? { task: { developerId: req.user!.id } } : {}) }, include: { user: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 20 });
  res.json({ activities: activities.reverse() });
});

export default router;
