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
RUNTIME_BACKUP="${SECRETS_DIR}/runtime.env.backup"
INSTALL_LOCK="${SECRETS_DIR}/install.lock"

mkdir -p "${SECRETS_DIR}"

# ── Idempotency: if runtime.env already exists, validate it and exit ───────────
if [[ -f "${RUNTIME_ENV}" ]]; then
  log "runtime.env already exists — validating existing secrets..."

  set -a
  # shellcheck source=/dev/null
  source "${RUNTIME_ENV}"
  set +a

  CRITICAL_VARS=(JWT_SECRET DB_PASSWORD DB_ROOT_PASSWORD ADMIN_PASSWORD_HASH PUBLIC_URL PUBLIC_API_URL CORS_ORIGIN)
  missing_vars=()
  for var in "${CRITICAL_VARS[@]}"; do
    [[ -z "${!var:-}" ]] && missing_vars+=("$var")
  done

  if [[ ${#missing_vars[@]} -gt 0 ]]; then
    err "runtime.env exists but is missing critical variables: ${missing_vars[*]}"
    err ""
    err "Do NOT regenerate secrets over existing mysql_data — DB_PASSWORD would change"
    err "and MySQL would become inaccessible."
    err ""
    err "Recovery:"
    err "  - Restore runtime.env from ${RUNTIME_BACKUP} or external backup."
    err "  - If this is a test install with no real data: delete BOTH mysql_data"
    err "    and app_secrets volumes and redeploy from scratch."
    exit 1
  fi

  log "runtime.env validated OK — keeping existing secrets."
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

# ── Backup: keep a copy of runtime.env for recovery ───────────────────────────
cp "${RUNTIME_ENV}" "${RUNTIME_BACKUP}"
chmod 600 "${RUNTIME_BACKUP}"
log "Backup written to ${RUNTIME_BACKUP}"

# ── Install lock: non-sensitive metadata for desync detection ─────────────────
cat > "${INSTALL_LOCK}" << LOCKEOF
created_at=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
app_domain=${APP_DOMAIN}
api_domain=${API_DOMAIN}
db_name=${DB_NAME:-whatsupshop}
db_user=${DB_USER:-whatsupshop_user}
project_name=${COMPOSE_PROJECT_NAME:-}
LOCKEOF

log "install.lock created."
log "Secrets generated successfully."
log "IMPORTANT: Never delete the app_secrets volume without also deleting mysql_data."
log "Losing runtime.env means losing access to the database and admin panel."
