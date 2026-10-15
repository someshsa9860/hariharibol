#!/bin/bash
# Copies the users and their sign-in sessions from the old server's database to the new server's, so
# people who open the app after the move are still signed in.
#
#   ./deploy/import-users.sh --dry-run   # copy inside a transaction, show the counts, undo it
#   ./deploy/import-users.sh             # copy for real (asks first)
#
# Run it from your laptop. It reads the old database through ssh and writes the new one through ssh; nothing
# is saved on your laptop. Only three tables are touched: Role, User and RefreshToken.
#
# Why this keeps people signed in:
#   - A session is a refresh token, and only its SHA-256 hash is stored. The phone holds the token, the
#     hash in the new database is the same, so the token is accepted there as it was here.
#   - The short-lived access token is checked against JWT_SECRET. It is only checked here that both servers
#     have the same one; if they differ the app just refreshes once more, which still works.
#
# When to run it, because a refresh token is replaced every time it is used:
#   Run it once now to see that it works. Then, at the moment of the switch, stop the old API
#   (docker stop hariharibol-api-1 hariharibol-socket-1 hariharibol-worker-1 on the old server), run it
#   again, then point the domain at the new server. Anyone who used the app between the first copy and the
#   switch would otherwise hold a token the new database has never heard of.
#   Running it again overwrites users that already exist on the new server with the old server's copy, so
#   never run it after the app is live on the new server.
#
# Roles are matched by name (user, admin, ...), so it does not matter whether the new server was seeded
# first. Not copied: devices (the app registers its push token again on launch), subscriptions and payments.
# Premium is stored on the user, but the daily job that checks it rebuilds it from subscriptions and
# payments, so if people have paid, copy those tables too before the app is live.
set -euo pipefail

SRC_HOST="${SRC_HOST:-HariHariBol_AWS}"
SRC_CONTAINER="${SRC_CONTAINER:-hariharibol-postgres-1}"
SRC_ENV="${SRC_ENV:-/var/www/hariharibol/server/.env}"
DST_HOST="${DST_HOST:-GSRKHVK_Main}"
DST_ENV="${DST_ENV:-/var/www/hariharibol/server/.env}"

DRY_RUN=0
case "${1:-}" in
  --dry-run) DRY_RUN=1 ;;
  "") ;;
  *) echo "usage: $0 [--dry-run]" >&2; exit 2 ;;
esac

# SQL arrives on stdin, plain rows come back. The old database is opened read-only.
src_sql () {
  ssh "$SRC_HOST" "docker exec -i -e PGOPTIONS='-c default_transaction_read_only=on' $SRC_CONTAINER sh -c 'psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -X -q -At -v ON_ERROR_STOP=1'"
}
dst_sql () {
  ssh "$DST_HOST" "exec psql \"\$(grep '^DATABASE_URL=' '$DST_ENV' | cut -d= -f2-)\" -X -q -At -v ON_ERROR_STOP=1"
}

columns_of () { # <src_sql|dst_sql> <table>
  echo "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '$2' ORDER BY ordinal_position;" | "$1"
}

# Columns present in both databases, in the new database's order. The old one can be a few migrations
# behind; a column it does not have gets its default on the new side.
shared_columns () { # <table>
  local src dst
  src="$(columns_of src_sql "$1")"
  dst="$(columns_of dst_sql "$1")"
  [ -n "$src" ] || { echo "Table $1 not found on $SRC_HOST" >&2; exit 1; }
  [ -n "$dst" ] || { echo "Table $1 not found on $DST_HOST: run the backend deploy first so the migrations create the tables" >&2; exit 1; }
  local only_dst
  only_dst="$(echo "$dst" | grep -vxFf <(echo "$src") || true)"
  [ -z "$only_dst" ] || echo "  $1: not in the old database, left to default: $(echo "$only_dst" | paste -sd' ' -)" >&2
  echo "$dst" | grep -xFf <(echo "$src")
}

quoted_list () { sed 's/.*/"&"/' | paste -sd, - | sed 's/,/, /g'; }

echo "Reading the table layouts ..."
ROLE_COLS="$(shared_columns Role)"
USER_COLS="$(shared_columns User)"
TOKEN_COLS="$(shared_columns RefreshToken)"
for c in id slug; do echo "$ROLE_COLS" | grep -qx "$c" || { echo "Role has no $c column" >&2; exit 1; }; done
echo "$USER_COLS" | grep -qx roleId || { echo "User has no roleId column" >&2; exit 1; }
for c in id userId tokenHash rotatedAt revokedAt; do echo "$TOKEN_COLS" | grep -qx "$c" || { echo "RefreshToken has no $c column" >&2; exit 1; }; done

RQ="$(echo "$ROLE_COLS" | quoted_list)"
UQ="$(echo "$USER_COLS" | quoted_list)"
TQ="$(echo "$TOKEN_COLS" | quoted_list)"
# The users' role is looked up by name on the new server, so roleId is swapped for that role's id there.
USER_SELECT="$(echo "$USER_COLS" | awk '{ if ($0 == "roleId") print "r.id"; else print "u.\"" $0 "\"" }' | paste -sd, - | sed 's/,/, /g')"
USER_UPDATE="$(echo "$USER_COLS" | awk '$0 != "id" { printf "%s\"%s\" = EXCLUDED.\"%s\"", sep, $0, $0; sep = ", " }')"

echo
echo "Old server ($SRC_HOST):"
echo "SELECT count(*) || ' users, ' || (SELECT count(*) FROM \"RefreshToken\" WHERE \"rotatedAt\" IS NULL AND \"revokedAt\" IS NULL AND \"expiresAt\" > now()) || ' live sessions' FROM \"User\";" | src_sql | sed 's/^/  /'
echo "New server ($DST_HOST) before:"
echo "SELECT count(*) || ' users, ' || (SELECT count(*) FROM \"RefreshToken\" WHERE \"rotatedAt\" IS NULL AND \"revokedAt\" IS NULL AND \"expiresAt\" > now()) || ' live sessions' FROM \"User\";" | dst_sql | sed 's/^/  /'

# Do both servers sign access tokens with the same secret? Only a hash is compared; nothing is shown.
secret_fingerprint () { # <host> <env file>: empty when the file has no JWT_SECRET line
  ssh -n "$1" "line=\$(grep '^JWT_SECRET=' '$2' || true); [ -z \"\$line\" ] || printf %s \"\$line\" | sha256sum | cut -c1-16" || true
}
src_secret="$(secret_fingerprint "$SRC_HOST" "$SRC_ENV")"
dst_secret="$(secret_fingerprint "$DST_HOST" "$DST_ENV")"
echo
if [ -n "$src_secret" ] && [ "$src_secret" = "$dst_secret" ]; then
  echo "JWT_SECRET: same on both servers."
else
  echo "JWT_SECRET: DIFFERENT (or missing) on the new server. Sessions still carry over, but every phone"
  echo "            makes one extra refresh call. To use the old one, run:"
  echo "  ssh $SRC_HOST \"grep '^JWT_SECRET=' '$SRC_ENV'\" | ssh $DST_HOST \"cat >> '$DST_ENV'\""
  echo "            (and delete the older JWT_SECRET line in that file if there was one)."
fi
echo

if [ "$DRY_RUN" = 1 ]; then
  echo "Dry run: copying inside a transaction that is rolled back at the end."
  FINISH="ROLLBACK;"
else
  echo "This copies the users and sessions above to $DST_HOST. A user that already exists there is"
  echo "overwritten by the old server's copy. Do not run it once the app is live on the new server."
  answer=""
  read -r -p "Go ahead? [y/N] " answer || true
  [ "$answer" = "y" ] || { echo "Nothing was changed."; exit 0; }
  FINISH="COMMIT;"
fi

copy_table () { # <staging table> <table> <quoted columns>
  echo "CREATE TEMP TABLE $1 AS SELECT $3 FROM \"$2\" WITH NO DATA;"
  echo "COPY $1 ($3) FROM STDIN;"
  echo "COPY (SELECT $3 FROM \"$2\") TO STDOUT;" | src_sql
  echo '\.'
}

{
  echo "BEGIN;"
  copy_table s_role Role "$RQ"
  copy_table s_user User "$UQ"
  copy_table s_token RefreshToken "$TQ"
  cat <<SQL
-- A role the new server does not have yet is created with the old id; the rest are matched by slug.
INSERT INTO "Role" ($RQ) SELECT $RQ FROM s_role ON CONFLICT (slug) DO NOTHING;

INSERT INTO "User" ($UQ)
SELECT $USER_SELECT
FROM s_user u
JOIN s_role sr ON sr.id = u."roleId"
JOIN "Role" r ON r.slug = sr.slug
ON CONFLICT (id) DO UPDATE SET $USER_UPDATE;

-- A token already copied before keeps its row; only whether it was used or revoked since can differ.
INSERT INTO "RefreshToken" ($TQ)
SELECT $TQ FROM s_token WHERE "userId" IN (SELECT id FROM "User")
ON CONFLICT (id) DO UPDATE SET "rotatedAt" = EXCLUDED."rotatedAt", "revokedAt" = EXCLUDED."revokedAt";

SELECT 'New server after: ' || count(*) || ' users, ' ||
  (SELECT count(*) FROM "RefreshToken" WHERE "rotatedAt" IS NULL AND "revokedAt" IS NULL AND "expiresAt" > now()) || ' live sessions'
FROM "User";
$FINISH
SQL
} | dst_sql

if [ "$DRY_RUN" = 1 ]; then
  echo "Dry run done: nothing was kept."
else
  echo "Done."
fi
