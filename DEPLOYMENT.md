# Quick deployment checklist

## Vercel frontend

1. Import the repository into Vercel.
2. Set **Root Directory** to `client`.
3. Build command: `npm run build`.
4. Output directory: `dist`.
5. Add `VITE_API_URL=https://YOUR-API-HOST/api`.
6. Add `VITE_SOCKET_URL=https://YOUR-API-HOST`.

## Node API

Deploy `server` to a long-running Node service such as Render/Railway/Fly.io.

Build: `npm install && npm run prisma:generate && npm run build`

Start: `npm start`

Environment variables:

- `DATABASE_URL`
- `ACCESS_TOKEN_SECRET`
- `REFRESH_TOKEN_SECRET`
- `CLIENT_URL` = your Vercel frontend URL
- `NODE_ENV=production`

Run the schema and seed once against the production database if seed data is wanted:

```bash
npm run prisma:push
npm run prisma:seed
```

For production, replace the seed/demo password and use managed PostgreSQL credentials.
