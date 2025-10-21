#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

echo "[+] Pulling latest images and rebuilding containers..."
docker compose pull || true

echo "[+] Building updated images..."
docker compose build

echo "[+] Applying database migrations..."
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/fatchrono}"
npx prisma migrate deploy --schema prisma/schema.prisma

echo "[+] Starting services with docker-compose..."
docker compose up -d

echo "[+] Deployment complete."
