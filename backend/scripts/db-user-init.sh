#!/usr/bin/env bash
# WhatsUpShop — DB user initializer.
# Runs as a one-shot service after db is healthy and before migrate.
# Ensures DB_USER exists, has the correct password, and has full privileges
# on DB_NAME. Idempotent: safe to run on every deploy.
set -euo pipefail

log()  { echo "[db-user-init] $*"; }
err()  { echo "[db-user-init][ERROR] $*" >&2; }

RUNTIME_ENV="/app/secrets/runtime.env"

# ── Load secrets ──────────────────────────────────────────────────────────────
if [[ ! -f "${RUNTIME_ENV}" ]]; then
  err "${RUNTIME_ENV} not found. Run the setup service first."
  exit 1
fi

set -a
# shellcheck source=/dev/null
source "${RUNTIME_ENV}"
set +a

# ── Apply defaults ────────────────────────────────────────────────────────────
DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-whatsupshop_user}"
DB_NAME="${DB_NAME:-whatsupshop}"

# ── Validate required variables ───────────────────────────────────────────────
missing=()
for var in DB_ROOT_PASSWORD DB_PASSWORD DB_HOST DB_PORT DB_USER DB_NAME; do
  [[ -z "${!var:-}" ]] && missing+=("$var")
done
if [[ ${#missing[@]} -gt 0 ]]; then
  err "Missing required variables: ${missing[*]}"
  exit 1
fi

# ── Validate DB_USER and DB_NAME (prevent injection) ─────────────────────────
if [[ ! "${DB_USER}" =~ ^[a-zA-Z0-9_]+$ ]]; then
  err "DB_USER contains invalid characters: ${DB_USER}"
  exit 1
fi
if [[ ! "${DB_NAME}" =~ ^[a-zA-Z0-9_]+$ ]]; then
  err "DB_NAME contains invalid characters: ${DB_NAME}"
  exit 1
fi

# ── Wait for MySQL root connection ────────────────────────────────────────────
log "Waiting for MySQL root connection at ${DB_HOST}:${DB_PORT}..."

MAX_ATTEMPTS=30
attempt=0
until mysqladmin ping \
  --host="${DB_HOST}" \
  --port="${DB_PORT}" \
  --user=root \
  --password="${DB_ROOT_PASSWORD}" \
  --silent 2>/dev/null; do
  attempt=$((attempt + 1))
  if [[ $attempt -ge $MAX_ATTEMPTS ]]; then
    err "MySQL root not reachable after ${MAX_ATTEMPTS} attempts."
    err "Check db service logs: docker compose logs db"
    exit 1
  fi
  log "  attempt ${attempt}/${MAX_ATTEMPTS} — retrying in 2s..."
  sleep 2
done

log "MySQL root connection OK."

# ── Ensure database and user exist with correct credentials ───────────────────
log "Initializing database '${DB_NAME}' and user '${DB_USER}'..."

mysql \
  --host="${DB_HOST}" \
  --port="${DB_PORT}" \
  --user=root \
  --password="${DB_ROOT_PASSWORD}" \
  --silent \
  <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`;
CREATE USER IF NOT EXISTS '${DB_USER}'@'%' IDENTIFIED BY '${DB_PASSWORD}';
ALTER USER '${DB_USER}'@'%' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'%';
FLUSH PRIVILEGES;
SQL

# ── Verify DB_USER can connect ────────────────────────────────────────────────
log "Verifying ${DB_USER} connection..."

if mysqladmin ping \
  --host="${DB_HOST}" \
  --port="${DB_PORT}" \
  --user="${DB_USER}" \
  --password="${DB_PASSWORD}" \
  --silent 2>/dev/null; then
  log "DB user ready."
else
  err "DB user '${DB_USER}' could not connect after initialization."
  err "This is unexpected — check MySQL error logs."
  exit 1
fi
