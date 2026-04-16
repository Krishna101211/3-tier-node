#!/bin/bash
set -euo pipefail

echo "=== Setting up EC2 instance for deployment ==="

sudo apt-get update -y
sudo apt-get upgrade -y

sudo apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    software-properties-common \
    git \
    ufw \
    jq

curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER

sudo apt-get install -y docker-compose-plugin
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

newgrp docker <<EOF
docker --version
docker compose version
EOF

sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

mkdir -p ~/app
echo "=== Setup complete! Clone your repo into ~/app ==="
