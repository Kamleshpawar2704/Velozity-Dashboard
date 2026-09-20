import { prisma } from '../prisma.js';
import type { Server } from 'socket.io';
export async function notify(io: Server, userId: string, message: string) {
  const notification = await prisma.notification.create({ data: { userId, message } });
  io.to(`user:${userId}`).emit('notification:new', notification);
  return notification;
}
