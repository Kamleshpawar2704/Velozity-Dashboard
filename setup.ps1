$ErrorActionPreference = "Stop"

Write-Host "Velozity Workspace setup" -ForegroundColor Cyan

if (-not (Test-Path "server/.env")) {
  Copy-Item "server/.env.example" "server/.env"
  Write-Host "Created server/.env"
}

if (-not (Test-Path "client/.env")) {
  Copy-Item "client/.env.example" "client/.env"
  Write-Host "Created client/.env"
}

Write-Host "Starting PostgreSQL..."
docker compose up -d

Write-Host "Generating Prisma client..."
npm run db:generate

Write-Host "Applying database schema..."
npm run db:push

Write-Host "Loading demo data..."
npm run seed

Write-Host "Setup complete. Run: npm run dev" -ForegroundColor Green
