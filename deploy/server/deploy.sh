#!/bin/bash
set -e

DIR="$(dirname "$0")"

# ./deploy.sh [backend|admin|website|all]
# One service on its own: ./api.sh, ./worker.sh, ./socket.sh, ./deeplink.sh, ./admin.sh, ./website.sh
# (they restart the image already pulled; ./pull.sh fetches it).

deploy_backend () {
  "$DIR/pull.sh" backend
  "$DIR/redis.sh"
  "$DIR/migrate.sh"
  "$DIR/api.sh"
  "$DIR/socket.sh"
  "$DIR/deeplink.sh"
  "$DIR/worker.sh"
}

deploy_admin () {
  "$DIR/pull.sh" admin
  "$DIR/admin.sh"
}

deploy_website () {
  "$DIR/pull.sh" website
  "$DIR/website.sh"
}

case "${1:-all}" in
  backend) deploy_backend ;;
  admin)   deploy_admin ;;
  website) deploy_website ;;
  all)
    deploy_backend
    deploy_admin
    deploy_website
    ;;
  *)
    echo "usage: $0 [backend|admin|website|all]" >&2
    exit 2
    ;;
esac
