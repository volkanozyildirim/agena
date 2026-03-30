#!/bin/bash
# Zero-downtime blue/green frontend deploy
# Nginx routes to both 3011 (blue) and 3012 (green) with least_conn.
# We rebuild one at a time so the other keeps serving traffic.

set -e
cd /var/www/tiqr

echo "=== Zero-downtime frontend deploy ==="

# 1) Rebuild BLUE while GREEN keeps serving
echo "[1/4] Rebuilding frontend_blue..."
docker-compose up -d --build --no-deps frontend_blue

echo "[2/4] Waiting for frontend_blue to be healthy..."
for i in $(seq 1 30); do
  if curl -sf -o /dev/null http://127.0.0.1:3011; then
    echo "  frontend_blue is UP"
    break
  fi
  [ "$i" -eq 30 ] && { echo "ERROR: frontend_blue failed to start"; exit 1; }
  sleep 2
done

# 2) Rebuild GREEN while BLUE keeps serving
echo "[3/4] Rebuilding frontend_green..."
docker-compose up -d --build --no-deps frontend_green

echo "[4/4] Waiting for frontend_green to be healthy..."
for i in $(seq 1 30); do
  if curl -sf -o /dev/null http://127.0.0.1:3012; then
    echo "  frontend_green is UP"
    break
  fi
  [ "$i" -eq 30 ] && { echo "ERROR: frontend_green failed to start"; exit 1; }
  sleep 2
done

echo "=== Deploy complete — zero downtime ==="
