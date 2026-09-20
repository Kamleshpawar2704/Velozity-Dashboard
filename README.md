# Velozity Global Solutions – Client Project Dashboard

A small internal project dashboard built with React + TypeScript, Express, PostgreSQL, Prisma and Socket.io.

> **Assessment note:** The brief says AI tools are strictly prohibited. This repository is provided as a working reference/starter implementation. If this is submitted for an assessment, review the code carefully, understand every part, and follow the employer's rules about permitted assistance.

## Stack

- **Frontend:** React + TypeScript + Vite
- **API:** Node.js + Express + TypeScript
- **Database:** PostgreSQL + Prisma
- **Realtime:** Socket.io
- **Scheduled work:** node-cron
- **Auth:** short-lived JWT access token + rotating refresh token in an HttpOnly cookie

## Local setup

### 1. Install dependencies

```bash
npm install
```

### 2. Start PostgreSQL

Make sure **Docker Desktop is running** before this command. On Windows, if Docker Desktop is stopped, Docker may report an error mentioning `dockerDesktopLinuxEngine` or `//./pipe/dockerDesktopLinuxEngine`.

```bash
docker compose up -d
```

### 3. Configure environment files

Copy the example files before running Prisma or the server.

PowerShell:

```powershell
Copy-Item server/.env.example server/.env
Copy-Item client/.env.example client/.env
```

Use different long random values for `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET`.

### 4. Create the database schema and seed demo data

```bash
npm run db:generate
npm run db:push
npm run seed
```

Seed users all use `Password123!`.

- admin@velozity.local
- ravi.pm@velozity.local
- neha.pm@velozity.local
- dev1@velozity.local through dev4@velozity.local

For Windows, the repository also includes `setup.ps1`, which performs these setup steps after Docker Desktop is running:

```powershell
.\setup.ps1
```

### 5. Start the app

```bash
npm run dev
```

Frontend: `http://localhost:5173`

API: `http://localhost:4000`

## Access rules

Authorization is checked in the API, not just in React.

- **Admin:** all projects, all tasks and global activity.
- **Project Manager:** only projects created by that PM. They can create tasks and manage their project tasks.
- **Developer:** only tasks assigned to that developer. They can update status, but cannot edit task metadata or another developer's task.

Project and activity queries repeat the ownership check so changing the UI or manually calling an endpoint does not bypass it.

## Realtime design

Socket.io was used because it provides a simple event API, reconnect handling and rooms without adding much protocol code. Each authenticated socket joins user-specific rooms and the project rooms that the user is actually allowed to see.

When a status changes, the API writes the activity event to PostgreSQL first and then broadcasts `activity:new`. The database remains the source of truth. On reconnect, the client emits `activity:catchup`; the server returns the latest 20 activities allowed for that role. This means missed events do not depend on an in-memory queue.

Presence is derived from currently connected authenticated sockets and is broadcast whenever a connection changes.

## Background job

`node-cron` runs every ten minutes and flags unfinished tasks whose due date has passed. The `overdue` value is persisted, so it is not calculated only when the dashboard loads.

For a larger deployment I would move this into a BullMQ worker backed by Redis so jobs can be retried and monitored independently of the API process.

## Database / indexes

Main relationships:

```text
User 1 ─── * Project (creator)
User 1 ─── * Task (developer)
Client 1 ─── * Project
Project 1 ─── * Task
Project 1 ─── * Activity
Task 1 ─── * Activity
User 1 ─── * Notification
User 1 ─── * RefreshToken
```

Indexes are present for project ownership/client lookup, task lists by project/status, developer task lists, priority/due-date sorting, overdue scans, and activity history by project/user/task.

## API shape

Every API error uses a structure like:

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission for this resource"
  }
}
```

Task filters are query parameters, for example:

`/api/projects/:projectId?status=IN_PROGRESS&priority=HIGH&from=2026-09-01&to=2026-09-30`

## Deployment

The React client can be deployed to Vercel. The Express + Socket.io API needs a long-running Node host rather than a Vercel serverless function because WebSocket connections must stay open. A practical setup is:

- Vercel → `client`
- Render/Railway/Fly.io → `server`
- Managed PostgreSQL → database

Set `VITE_API_URL`, `VITE_SOCKET_URL`, `DATABASE_URL`, `CLIENT_URL`, and both JWT secrets in the corresponding deployment environments. Do not commit `.env` files.

# Velozity Dashboard

A real-time project and task management dashboard built with React, TypeScript, Node.js, Express, PostgreSQL, Prisma and Socket.io.

## 🚀 Live Demo

**Frontend:** https://velozity-dashboard-client.vercel.app

**Backend API:** https://velozity-dashboard-10co.onrender.com

## Explanation field (assessment-ready draft)

The hardest part was making the activity feed real-time without turning the frontend into the source of truth. I kept activity records in PostgreSQL and only used Socket.io to deliver changes to connected clients. Each socket is authenticated and joins only the project rooms allowed for that user. Admins receive the global feed, PMs receive activity from projects they created, and developers receive events connected to their assigned tasks. When a client reconnects, it requests the latest 20 permitted records from the database, so events are not lost just because the browser was offline.

The other important decision was keeping permissions in the API. The frontend hides actions that a role should not use, but every protected route repeats the ownership and role checks on the server. Developers, for example, can only update the status of their own tasks.

If I had more time, I would move the scheduled overdue job to BullMQ with Redis. That would make retries, job monitoring and horizontal scaling easier than keeping the scheduler inside the API process.

## Known limitations

- The UI is intentionally compact and focused on the assessment requirements rather than a full design system.
- Presence is process-local; multiple API instances would need a Socket.io adapter such as Redis.
- The cron scheduler should be separated into a worker for multi-instance production deployments.
- There is no password reset or email service because those are outside the requested scope.
