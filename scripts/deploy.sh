#!/bin/bash
set -euo pipefail

echo "=== Deploying application ==="

cd /home/ubuntu/app || exit 1

echo "Pulling latest images..."
docker compose pull app

echo "Starting services..."
docker compose up -d

echo "Waiting for services to be healthy..."
sleep 10

echo "Checking service status..."
docker compose ps

echo ""
echo "=== Deployment complete ==="
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
echo "API:      http://$PUBLIC_IP/health"
echo "Grafana:  http://$PUBLIC_IP:4000"
