#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${1:-/root/.codex/memories}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"

mkdir -p "$BACKUP_DIR"

if command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD=(docker-compose)
elif docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD=(docker compose)
else
  echo "[ERROR] docker compose command not found." >&2
  exit 1
fi

echo "[INFO] Backup dir: $BACKUP_DIR"
echo "[INFO] Timestamp: $TS"

copy_secret_file() {
  local src="$1"
  local name="$2"
  local dst="$BACKUP_DIR/${name}-${TS}.bak"

  if [[ -f "$src" ]]; then
    cp "$src" "$dst"
    chmod 600 "$dst" || true
    echo "[OK] $src -> $dst"
  else
    echo "[WARN] Skipped missing file: $src"
  fi
}

copy_secret_file "$ROOT_DIR/.env" "env"
copy_secret_file "$ROOT_DIR/frontend/.env.local" "frontend-env-local"

MYSQL_CID="$("${COMPOSE_CMD[@]}" -f "$ROOT_DIR/docker-compose.yml" ps -q mysql 2>/dev/null || true)"

if [[ -z "$MYSQL_CID" ]]; then
  echo "[WARN] MySQL container is not running. Skipping mysql volume backup."
else
  MYSQL_VOLUME="$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/var/lib/mysql"}}{{.Name}}{{end}}{{end}}' "$MYSQL_CID")"
  if [[ -z "$MYSQL_VOLUME" ]]; then
    echo "[WARN] Could not detect mysql volume name. Skipping mysql volume backup."
  else
    MYSQL_ARCHIVE="$BACKUP_DIR/mysql-data-${TS}.tgz"
    docker run --rm -v "$MYSQL_VOLUME:/from:ro" -v "$BACKUP_DIR:/to" alpine \
      sh -lc "cd /from && tar czf /to/$(basename "$MYSQL_ARCHIVE") ."
    chmod 600 "$MYSQL_ARCHIVE" || true
    echo "[OK] MySQL volume $MYSQL_VOLUME -> $MYSQL_ARCHIVE"
  fi
fi

echo "[DONE] Backup completed."
