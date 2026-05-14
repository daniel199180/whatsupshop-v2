#!/usr/bin/env bash
# WhatsUpShop — Pre-flight validation.
# Runs as a one-shot service after setup and before db.
# Validates that app_secrets is intact and complete before the DB starts.
# Does NOT connect to MySQL — only checks files and environment variables.
set -euo pipefail

log()  { echo "[preflight] $*"; }
err()  { echo "[preflight][ERROR] $*" >&2; }
warn() { echo "[preflight][WARN]  $*"; }

SECRETS_DIR="/app/secrets"
RUNTIME_ENV="${SECRETS_DIR}/runtime.env"
RUNTIME_BACKUP="${SECRETS_DIR}/runtime.env.backup"
INSTALL_LOCK="${SECRETS_DIR}/install.lock"

# ── 1. runtime.env must exist ─────────────────────────────────────────────────
if [[ ! -f "${RUNTIME_ENV}" ]]; then
  err "${RUNTIME_ENV} not found."
  err ""
  err "app_secrets volume is empty or was deleted after the DB was initialized."
  err ""
  err "Recovery:"
  err "  - PRODUCTION: Restore runtime.env from ${RUNTIME_BACKUP} or external"
  err "    backup. Do NOT delete mysql_data or you will lose all data."
  err "  - TEST INSTALL (no real data): Delete BOTH mysql_data AND app_secrets"
  err "    volumes and redeploy from scratch."
  exit 1
fi

# ── 2. Source runtime.env and validate critical variables ─────────────────────
set -a
# shellcheck source=/dev/null
source "${RUNTIME_ENV}"
set +a

CRITICAL_VARS=(JWT_SECRET DB_PASSWORD DB_ROOT_PASSWORD ADMIN_PASSWORD_HASH PUBLIC_URL PUBLIC_API_URL CORS_ORIGIN)
missing=()
for var in "${CRITICAL_VARS[@]}"; do
  [[ -z "${!var:-}" ]] && missing+=("$var")
done

if [[ ${#missing[@]} -gt 0 ]]; then
  err "runtime.env is missing critical variables: ${missing[*]}"
  err ""
  err "Do NOT regenerate secrets over an existing mysql_data volume."
  err "DB_PASSWORD must match the MySQL user created during first install."
  err ""
  err "Recovery:"
  err "  - Restore the missing variables from ${RUNTIME_BACKUP} or external backup."
  err "  - If this is a test install: delete BOTH mysql_data AND app_secrets"
  err "    volumes and redeploy from scratch."
  exit 1
fi

# ── 3. Validate connection defaults (no DB connection yet) ────────────────────
DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-whatsupshop_user}"
DB_NAME="${DB_NAME:-whatsupshop}"

# ── 4. install.lock check ─────────────────────────────────────────────────────
if [[ -f "${INSTALL_LOCK}" ]]; then
  log "install.lock OK"
  # Warn if domains in the lock don't match current environment
  lock_app_domain=$(grep "^app_domain=" "${INSTALL_LOCK}" | cut -d= -f2 || true)
  lock_db_user=$(grep "^db_user=" "${INSTALL_LOCK}" | cut -d= -f2 || true)
  if [[ -n "${lock_db_user}" && "${lock_db_user}" != "${DB_USER}" ]]; then
    warn "DB_USER mismatch: install.lock has '${lock_db_user}', current DB_USER is '${DB_USER}'."
    warn "If mysql_data exists with the old user, migrations will fail."
  fi
else
  warn "install.lock not found — this may be a pre-v2.x installation."
  warn "Continuing without lock validation."
fi

# ── 5. runtime.env.backup check ──────────────────────────────────────────────
if [[ ! -f "${RUNTIME_BACKUP}" ]]; then
  warn "runtime.env.backup not found — no local recovery copy available."
  warn "Consider keeping an external backup of ${RUNTIME_ENV}."
fi

# ── Summary ───────────────────────────────────────────────────────────────────
log "runtime.env    OK  (all critical variables present)"
log "  PUBLIC_URL   = ${PUBLIC_URL}"
log "  CORS_ORIGIN  = ${CORS_ORIGIN}"
log "  DB_HOST:PORT = ${DB_HOST}:${DB_PORT}"
log "  DB_NAME      = ${DB_NAME}"
log "  DB_USER      = ${DB_USER}"
log "  Secrets      = [JWT_SECRET, DB_PASSWORD, DB_ROOT_PASSWORD, ADMIN_PASSWORD_HASH present]"
log "Preflight checks passed."
