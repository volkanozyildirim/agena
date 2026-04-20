#!/bin/bash
# Smart update: git pull + apply minimal actions based on what changed.
#   frontend/**        → zero-downtime blue/green deploy
#   alembic/versions/* → alembic upgrade head
#   packages/**/*.py   → worker restart (api hot-reloads via WatchFiles)
#   deps / compose     → full rebuild prompt
# Safe to run when up-to-date (no-op).

set -e
cd "$(dirname "$0")"

BEFORE=$(git rev-parse HEAD)

echo "=== git pull ==="
git pull --ff-only
AFTER=$(git rev-parse HEAD)

if [ "$BEFORE" = "$AFTER" ]; then
  echo "Already up to date — nothing to do."
  exit 0
fi

CHANGED=$(git diff --name-only "$BEFORE" "$AFTER")
echo ""
echo "=== Changed files ==="
echo "$CHANGED" | sed 's/^/  /'
echo ""

has() { echo "$CHANGED" | grep -qE "$1"; }

NEED_FRONTEND=0
NEED_MIGRATIONS=0
NEED_WORKER=0
NEED_REBUILD=0

has '^frontend/' && NEED_FRONTEND=1
has '^alembic/versions/' && NEED_MIGRATIONS=1
has '^packages/(core|models|services|agents|worker)/.*\.py$' && NEED_WORKER=1
has '(^packages/.+/pyproject\.toml|^docker-compose\.yml|^docker/Dockerfile|^frontend/package(-lock)?\.json)' && NEED_REBUILD=1

if [ $NEED_REBUILD -eq 1 ]; then
  echo "!! Dependency / compose / Dockerfile changed — full rebuild recommended."
  echo "   Run: ./stop.sh && ./start.sh"
  echo ""
fi

if [ $NEED_MIGRATIONS -eq 1 ]; then
  echo "=== Applying alembic migrations ==="
  docker-compose exec -T backend alembic upgrade head
  echo ""
fi

if [ $NEED_WORKER -eq 1 ]; then
  echo "=== Restarting worker (api hot-reloads) ==="
  docker-compose restart worker
  echo ""
fi

if [ $NEED_FRONTEND -eq 1 ]; then
  echo "=== Zero-downtime frontend deploy ==="
  ./scripts/deploy-frontend.sh
  echo ""
fi

if [ $NEED_FRONTEND -eq 0 ] && [ $NEED_MIGRATIONS -eq 0 ] && [ $NEED_WORKER -eq 0 ] && [ $NEED_REBUILD -eq 0 ]; then
  echo "No runtime-affecting changes."
fi

echo "=== Update complete ==="
