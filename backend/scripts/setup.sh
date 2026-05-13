#!/usr/bin/env bash
set -euo pipefail

log() { echo "[setup] $*"; }
err() { echo "[setup][ERROR] $*" >&2; }

# ── Validate required variables ────────────────────────────────────────────────
missing=0
for var in APP_DOMAIN API_DOMAIN ADMIN_PASSWORD; do
  if [[ -z "${!var:-}" ]]; then
    err "Missing ${var}"
    missing=1
  fi
done
[[ $missing -eq 1 ]] && exit 1

SECRETS_DIR="/app/secrets"
RUNTIME_ENV="${SECRETS_DIR}/runtime.env"

mkdir -p "${SECRETS_DIR}"

# ── Idempotency: never overwrite existing secrets ──────────────────────────────
if [[ -f "${RUNTIME_ENV}" ]]; then
  log "runtime.env already exists, keeping existing secrets"
  exit 0
fi

log "Generating secrets for ${APP_DOMAIN} / ${API_DOMAIN}..."

JWT_SECRET=$(openssl rand -hex 32)
DB_PASSWORD=$(openssl rand -hex 24)
DB_ROOT_PASSWORD=$(openssl rand -hex 24)

log "Hashing admin password (bcrypt cost 12)..."
ADMIN_PASSWORD_HASH=$(bun run /app/scripts/hash-password.js)

log "Writing ${RUNTIME_ENV}..."

# Single-quote the bcrypt hash so that its $ signs are not misinterpreted
# when the file is later sourced by sh/bash.
cat > "${RUNTIME_ENV}" << ENVEOF
JWT_SECRET=${JWT_SECRET}
DB_PASSWORD=${DB_PASSWORD}
DB_ROOT_PASSWORD=${DB_ROOT_PASSWORD}
ADMIN_PASSWORD_HASH='${ADMIN_PASSWORD_HASH}'
PUBLIC_URL=https://${API_DOMAIN}
PUBLIC_API_URL=https://${API_DOMAIN}
CORS_ORIGIN=https://${APP_DOMAIN}
ENVEOF

chmod 600 "${RUNTIME_ENV}"

log "Secrets generated successfully."
log "IMPORTANT: Never delete the app_secrets volume without also deleting mysql_data."
log "Losing runtime.env means losing access to the database and admin panel."
