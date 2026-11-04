#!/usr/bin/env bash
set -euo pipefail

# One-time VPS bootstrap. Run as root:
#   curl -fsSL ... or copy this file, then:
#   bash setup-vps.sh api.fusion-repair.website

DOMAIN="${1:?Usage: bash setup-vps.sh api.example.com}"
REPO="https://github.com/spl1n1337/test_crm.git"
APP_DIR="/opt/stroycrm"

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y git curl nginx ufw

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO" "$APP_DIR"
else
  git -C "$APP_DIR" fetch origin main
  git -C "$APP_DIR" reset --hard origin/main
fi

if [ ! -f "$APP_DIR/backend/.env" ]; then
  cp "$APP_DIR/.env.example" "$APP_DIR/backend/.env"
  echo "Fill $APP_DIR/backend/.env then: systemctl restart stroycrm-api"
fi

cd "$APP_DIR/backend"
npm ci --include=dev
npm run build

install -m 644 "$APP_DIR/deploy/stroycrm-api.service" /etc/systemd/system/stroycrm-api.service
sed "s/API_DOMAIN/${DOMAIN}/g" "$APP_DIR/deploy/nginx.conf" >/etc/nginx/sites-available/stroycrm-api
ln -sfn /etc/nginx/sites-available/stroycrm-api /etc/nginx/sites-enabled/stroycrm-api
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now stroycrm-api
systemctl reload nginx

ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw --force enable

echo
echo "Next:"
echo "  1. Edit $APP_DIR/backend/.env"
echo "  2. systemctl restart stroycrm-api"
echo "  3. Point DNS A-record ${DOMAIN} to this VPS"
echo "  4. apt-get install -y certbot python3-certbot-nginx && certbot --nginx -d ${DOMAIN}"
echo "  5. curl https://${DOMAIN}/api/health"
