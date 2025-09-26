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

(cd "${ROOT_DIR}" && docker compose up db -d)

(cd "${ROOT_DIR}" && npx prisma generate --schema prisma/schema.prisma)

(cd "${ROOT_DIR}" && npx prisma migrate deploy --schema prisma/schema.prisma)

(cd "${ROOT_DIR}" && (npm run dev:backend & npm run dev:web; wait))
