import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import http from 'node:http';
import { Server } from 'socket.io';
import cron from 'node-cron';
import { prisma } from './prisma.js';
import auth from './routes/auth.js';
import projects from './routes/projects.js';
import dashboard from './routes/dashboard.js';
import users from './routes/users.js';
import notifications from './routes/notifications.js';
import activity from './routes/activity.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { setupSocket } from './socket.js';

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: process.env.CLIENT_URL, credentials: true } });
app.set('io', io);
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true }));
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', auth);
app.use('/api/projects', projects);
app.use('/api/dashboard', dashboard);
app.use('/api/users', users);
app.use('/api/notifications', notifications);
app.use('/api/activity', activity);
app.use(notFound);
app.use(errorHandler);
setupSocket(io);

cron.schedule('*/10 * * * *', async () => {
  await prisma.task.updateMany({ where: { dueDate: { lt: new Date() }, status: { not: 'DONE' }, overdue: false }, data: { overdue: true } });
});

const port = Number(process.env.PORT || 4000);
httpServer.listen(port, () => console.log(`API listening on http://localhost:${port}`));
