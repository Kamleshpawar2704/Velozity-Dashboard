import { PrismaClient, Role, TaskStatus, Priority, ActivityType } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();

async function main() {
  await prisma.activity.deleteMany(); await prisma.notification.deleteMany(); await prisma.task.deleteMany(); await prisma.project.deleteMany(); await prisma.client.deleteMany(); await prisma.refreshToken.deleteMany(); await prisma.user.deleteMany();
  const passwordHash = await bcrypt.hash('Password123!', 10);
  const admin = await prisma.user.create({ data: { name: 'Amit Admin', email: 'admin@velozity.local', passwordHash, role: Role.ADMIN } });
  const pm1 = await prisma.user.create({ data: { name: 'Ravi Sharma', email: 'ravi.pm@velozity.local', passwordHash, role: Role.PM } });
  const pm2 = await prisma.user.create({ data: { name: 'Neha Joshi', email: 'neha.pm@velozity.local', passwordHash, role: Role.PM } });
  const devs = await Promise.all(['Arjun Mehta','Priya Singh','Karan Patil','Sneha Kulkarni'].map((name, i) => prisma.user.create({ data: { name, email: `dev${i+1}@velozity.local`, passwordHash, role: Role.DEVELOPER } })));
  const clients = await Promise.all(['Northstar Labs','BrightCart','Greenfield Foods'].map(name => prisma.client.create({ data: { name } })));
  const projects = await Promise.all([
    prisma.project.create({ data: { name: 'Northstar Website', description: 'Marketing website refresh', creatorId: pm1.id, clientId: clients[0].id } }),
    prisma.project.create({ data: { name: 'BrightCart Checkout', description: 'Checkout and payment improvements', creatorId: pm1.id, clientId: clients[1].id } }),
    prisma.project.create({ data: { name: 'Greenfield Portal', description: 'Internal client portal', creatorId: pm2.id, clientId: clients[2].id } })
  ]);
  const statuses = [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW, TaskStatus.DONE, TaskStatus.TODO, TaskStatus.IN_PROGRESS];
  const priorities = [Priority.HIGH, Priority.CRITICAL, Priority.MEDIUM, Priority.LOW, Priority.HIGH, Priority.MEDIUM];
  for (let pi = 0; pi < projects.length; pi++) {
    for (let i = 0; i < 6; i++) {
      const dueDate = new Date(Date.now() + (i < 2 ? -(i + 1) : i + 1) * 86400000);
      const task = await prisma.task.create({ data: { projectId: projects[pi].id, title: ['Landing page','API integration','Responsive layout','QA pass','Payment webhook','Deployment'][i], description: 'Seed task for the dashboard demo.', developerId: devs[(pi + i) % devs.length].id, status: statuses[(i + pi) % statuses.length], priority: priorities[i], dueDate, overdue: dueDate < new Date() && statuses[(i + pi) % statuses.length] !== TaskStatus.DONE } });
      if (i < 2) await prisma.activity.create({ data: { projectId: projects[pi].id, taskId: task.id, userId: i % 2 ? pm1.id : admin.id, type: ActivityType.STATUS_CHANGED, message: `${i % 2 ? pm1.name : admin.name} moved Task #${task.id} from TODO → ${task.status}`, fromValue: 'TODO', toValue: task.status } });
    }
  }
  await prisma.notification.create({ data: { userId: devs[0].id, message: 'Task #1 was assigned to you' } });
  console.log('Seed complete. Password for all demo users: Password123!');
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
