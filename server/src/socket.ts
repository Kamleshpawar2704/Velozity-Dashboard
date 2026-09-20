import jwt from 'jsonwebtoken';
import type { Server, Socket } from 'socket.io';
import { prisma } from './prisma.js';

export function setupSocket(io: Server) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET!) as jwt.JwtPayload;
      const user = await prisma.user.findUnique({ where: { id: String(payload.sub) }, select: { id: true, name: true, role: true } });
      if (!user) return next(new Error('Unauthorized'));
      socket.data.user = user; next();
    } catch { next(new Error('Unauthorized')); }
  });

  io.on('connection', async (socket: Socket) => {
    const user = socket.data.user as { id: string; role: 'ADMIN'|'PM'|'DEVELOPER'; name: string };
    socket.join(`user:${user.id}`);
    if (user.role === 'ADMIN') socket.join('admin-feed');
    const projects = await prisma.project.findMany({ where: user.role === 'ADMIN' ? {} : user.role === 'PM' ? { creatorId: user.id } : {}, select: { id: true } });
    if (user.role !== 'DEVELOPER') projects.forEach((p: { id: string }) => socket.join(`project:${p.id}`));
    if (user.role === 'DEVELOPER') {
      const tasks = await prisma.task.findMany({ where: { developerId: user.id }, select: { id: true } });
      tasks.forEach((t: { id: number }) => socket.join(`task:${t.id}`));
    }
    io.emit('presence:update', await onlineCount(io));

    socket.on('activity:catchup', async () => {
      const where = user.role === 'ADMIN' ? {} : user.role === 'PM' ? { project: { creatorId: user.id } } : { task: { developerId: user.id } };
      const activities = await prisma.activity.findMany({ where, include: { user: { select: { name: true } }, project: { select: { name: true } }, task: { select: { id: true } } }, orderBy: { createdAt: 'desc' }, take: 20 });
      socket.emit('activity:catchup', activities.reverse());
    });
    socket.on('disconnect', async () => io.emit('presence:update', await onlineCount(io)));
  });
}

async function onlineCount(io: Server) {
  const ids = new Set<string>();
  for (const [, s] of io.sockets.sockets) ids.add(s.data.user?.id);
  return ids.size;
}
