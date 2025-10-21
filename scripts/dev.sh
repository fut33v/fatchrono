#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -f "${ROOT_DIR}/.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ROOT_DIR}/.env"
  set +a
else
  echo "⚠️  .env not found in ${ROOT_DIR}. Continuing without it." >&2
fi

if [[ "${DATABASE_URL:-}" == *"@db:"* ]]; then
  export DATABASE_URL="${DATABASE_URL_LOCAL:-postgresql://postgres:postgres@localhost:5432/fatchrono}"
  echo "ℹ️  Overriding DATABASE_URL for local development: ${DATABASE_URL}"
fi

wait_for_postgres() {
  local attempts=0
  local max_attempts=30
  local sleep_seconds=2
  local db_name="${POSTGRES_DB:-fatchrono}"
  local db_user="${POSTGRES_USER:-postgres}"

  echo "⏳ Waiting for PostgreSQL to become ready..."
  until (cd "${ROOT_DIR}" && docker compose exec -T db pg_isready -d "${db_name}" -U "${db_user}" >/dev/null 2>&1); do
    ((attempts++))
    if (( attempts >= max_attempts )); then
      echo "❌ PostgreSQL did not become ready after $((attempts * sleep_seconds)) seconds." >&2
      exit 1
    fi
    sleep "${sleep_seconds}"
  done
  echo "✅ PostgreSQL is ready."
}

(cd "${ROOT_DIR}" && docker compose up db -d && wait_for_postgres)

(cd "${ROOT_DIR}" && npx prisma generate --schema prisma/schema.prisma)

(cd "${ROOT_DIR}" && npx prisma migrate deploy --schema prisma/schema.prisma)

(cd "${ROOT_DIR}" && (npm run dev:backend & npm run dev:web; wait))
