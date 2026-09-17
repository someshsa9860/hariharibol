#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

sudo apt-get update
sudo apt-get install -y awscli ca-certificates curl nginx

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
  echo "Docker installed; log in again before deploying."
fi

if [[ ! -f .env ]]; then
  cp .env.example .env
  chmod 600 .env
  echo "Created .env. Fill in its values, then run ./deploy.sh."
fi

mkdir -p "$SCRIPT_DIR/../secrets"
chmod 700 "$SCRIPT_DIR/../secrets"
echo "Place Google service-account JSON and other credential files in:"
echo "  $SCRIPT_DIR/../secrets"

sudo install -m 0644 "$SCRIPT_DIR/nginx.conf" /etc/nginx/sites-available/hariharibol
sudo ln -sfn /etc/nginx/sites-available/hariharibol /etc/nginx/sites-enabled/hariharibol
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx
