#!/usr/bin/env bash
# Deploy DecompilingFutureCrew (Second Reality browser-port) naar HorseCloud55.
# Idempotent. Self-healing (verifieert na deploy dat eigen location block aanwezig is).
# Respecteert SHARED_INFRASTRUCTURE.md: nooit andere snippets aanraken; gedeelde
# /etc/nginx/sites-enabled/horsecloud wordt alleen via een include uitgebreid.
#
# Mirror-URL: https://horsecloud55.ddns.net/SecondReality/
# GLENZ:      https://horsecloud55.ddns.net/SecondReality/glenz/

set -euo pipefail

SSH_HOST="${SR_SSH_HOST:-horsecloud55}"
REMOTE_ROOT="/var/www/secondreality"
REMOTE_WEB="$REMOTE_ROOT/web"
SNIPPET_REMOTE="/etc/nginx/snippets/secondreality-locations.conf"
HORSECLOUD_CONF="/etc/nginx/sites-enabled/horsecloud"
INCLUDE_LINE="    include /etc/nginx/snippets/secondreality-locations.conf;"

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOCAL_WEB="$REPO_DIR/dist-hc55"
LOCAL_SNIPPET="$REPO_DIR/deploy/secondreality-locations.conf"

echo "[1/8] Build met base=/SecondReality/"
( cd "$REPO_DIR" && npx tsc -b && npx vite build --base=/SecondReality/ --outDir dist-hc55 --emptyOutDir )

echo "[2/8] Verifieer lokale bron"
test -d "$LOCAL_WEB"               || { echo "FAIL: $LOCAL_WEB ontbreekt"; exit 1; }
test -f "$LOCAL_WEB/index.html"    || { echo "FAIL: dist-hc55/index.html ontbreekt"; exit 1; }
test -f "$LOCAL_WEB/glenz/index.html" || { echo "FAIL: dist-hc55/glenz/index.html ontbreekt"; exit 1; }
test -f "$LOCAL_WEB/audio/MUSIC0.S3M" || { echo "FAIL: dist-hc55/audio/MUSIC0.S3M ontbreekt"; exit 1; }
test -f "$LOCAL_SNIPPET"           || { echo "FAIL: $LOCAL_SNIPPET ontbreekt"; exit 1; }

echo "[3/8] Maak remote directories"
ssh "$SSH_HOST" "sudo mkdir -p '$REMOTE_WEB' && sudo chown -R www-data:www-data '$REMOTE_ROOT'"

echo "[4/8] Rsync dist-hc55/ -> $SSH_HOST:$REMOTE_WEB/"
rsync -av --delete --exclude='.DS_Store' -e "ssh" "$LOCAL_WEB/" "$SSH_HOST:/tmp/secondreality-staging/"
ssh "$SSH_HOST" "sudo rsync -av --delete /tmp/secondreality-staging/ '$REMOTE_WEB/' && sudo chown -R www-data:www-data '$REMOTE_ROOT' && rm -rf /tmp/secondreality-staging"

echo "[5/8] Plaats nginx snippet"
scp "$LOCAL_SNIPPET" "$SSH_HOST:/tmp/secondreality-locations.conf"
ssh "$SSH_HOST" "sudo mv /tmp/secondreality-locations.conf '$SNIPPET_REMOTE' && sudo chown root:root '$SNIPPET_REMOTE' && sudo chmod 644 '$SNIPPET_REMOTE'"

echo "[6/8] Include in horsecloud-config (idempotent, na asm2web-include)"
ssh "$SSH_HOST" "if ! sudo grep -qF 'secondreality-locations.conf' '$HORSECLOUD_CONF'; then \
    sudo cp '$HORSECLOUD_CONF' '$HORSECLOUD_CONF.bak.\$(date +%s)'; \
    sudo sed -i '/include \\/etc\\/nginx\\/snippets\\/asm2web-locations\\.conf;/a\\
$INCLUDE_LINE' '$HORSECLOUD_CONF'; \
    echo '   -> include toegevoegd'; \
  else \
    echo '   -> include reeds aanwezig'; \
  fi"

echo "[7/8] Nginx config-test + reload"
ssh "$SSH_HOST" "sudo nginx -t"
ssh "$SSH_HOST" "sudo systemctl reload nginx"

echo "[8/8] Smoke-test"
sleep 1
HTTP_HOME=$(ssh "$SSH_HOST" "curl -s -o /dev/null -w '%{http_code}' https://horsecloud55.ddns.net/SecondReality/ -k -L")
HTTP_GLENZ=$(ssh "$SSH_HOST" "curl -s -o /dev/null -w '%{http_code}' https://horsecloud55.ddns.net/SecondReality/glenz/ -k -L")
HTTP_S3M=$(ssh "$SSH_HOST" "curl -s -o /dev/null -w '%{http_code}' https://horsecloud55.ddns.net/SecondReality/audio/MUSIC0.S3M -k")
echo "   /SecondReality/            -> $HTTP_HOME"
echo "   /SecondReality/glenz/      -> $HTTP_GLENZ"
echo "   /SecondReality/audio/...   -> $HTTP_S3M"

echo
echo "Self-healing check (top-level includes in $HORSECLOUD_CONF):"
ssh "$SSH_HOST" "sudo grep -nE 'include /etc/nginx/snippets/' '$HORSECLOUD_CONF'"

echo
echo "DONE. Live op: https://horsecloud55.ddns.net/SecondReality/  (GLENZ: /SecondReality/glenz/)"
