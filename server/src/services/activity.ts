import { prisma } from '../prisma.js';
import type { Server } from 'socket.io';

export async function recordActivity(io: Server, data: { projectId: string; taskId?: number; userId: string; message: string; type: 'STATUS_CHANGED'|'TASK_ASSIGNED'|'TASK_CREATED'; fromValue?: string; toValue?: string }) {
  const activity = await prisma.activity.create({ data });
  if (data.taskId) io.to(`task:${data.taskId}`).emit('activity:new', activity);
  io.to(`project:${data.projectId}`).emit('activity:new', activity);
  io.to('admin-feed').emit('activity:new', activity);
  return activity;
}
