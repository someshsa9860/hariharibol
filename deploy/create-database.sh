#!/bin/bash
# Creates the `hariharibol` database user and database on the managed PostgreSQL (RDS) that
# api.callvcal.com already uses, then writes the new DATABASE_URL into hariharibol's .env.
#
# Run it from your laptop; it asks for the new password (twice, hidden):
#
#   ssh -t GSRKHVK_Main "$(cat deploy/create-database.sh)"
#
# The RDS admin login is read from callvcal's .env on the server for the duration of this script. It is
# never printed or copied anywhere. The password you type is not sent to RDS as text either: it is hashed
# here (SCRAM-SHA-256, the way a PostgreSQL client would) so it cannot show up in a server log.
# Safe to run again: it only changes the user's password and the DATABASE_URL line.
set -euo pipefail
umask 077

ADMIN_ENV="${ADMIN_ENV:-/var/www/docker/api.callvcal.com/.env}"
APP_ENV="${APP_ENV:-/var/www/hariharibol/server/.env}"
DB_NAME="hariharibol"
DB_ROLE="hariharibol"

# ── The new password ───────────────────────────────────────────────────────
if [ -t 0 ]; then
  read -rsp "New password for database user $DB_ROLE: " pw; echo
  read -rsp "Type it again: " pw2; echo
else
  read -r pw
  read -r pw2
fi
[ "$pw" = "$pw2" ] || { echo "The two passwords differ. Nothing was changed." >&2; exit 1; }
[ "${#pw}" -ge 12 ] || { echo "Use at least 12 characters. Nothing was changed." >&2; exit 1; }
LC_ALL=C
case "$pw" in
  *[!\ -~]*) echo "Use plain keyboard characters only (letters, digits, symbols). Nothing was changed." >&2; exit 1 ;;
esac

# ── RDS admin login, from callvcal's .env (kept in this shell only) ─────────
[ -r "$ADMIN_ENV" ] || { echo "Cannot read $ADMIN_ENV" >&2; exit 1; }
admin_login="$(python3 - "$ADMIN_ENV" <<'PY'
import shlex, sys
from urllib.parse import urlsplit, unquote, parse_qs

url = None
for line in open(sys.argv[1]):
    if line.startswith('DATABASE_URL='):
        url = line.split('=', 1)[1].strip().strip('"').strip("'")
        break
if not url:
    print('echo "No DATABASE_URL in the admin .env" >&2; exit 1')
    sys.exit(0)
u = urlsplit(url)
q = parse_qs(u.query)
values = {
    'PGHOST': u.hostname or '',
    'PGPORT': str(u.port or 5432),
    'PGUSER': unquote(u.username or ''),
    'PGPASSWORD': unquote(u.password or ''),
    'PGSSLMODE': (q.get('sslmode') or ['require'])[0],
    'PGDATABASE': 'postgres',
}
print(''.join('export %s=%s\n' % (k, shlex.quote(v)) for k, v in values.items()))
PY
)"
eval "$admin_login"
unset admin_login
[ -n "${PGHOST:-}" ] && [ -n "${PGUSER:-}" ] || { echo "No host or user in the admin DATABASE_URL" >&2; exit 1; }
echo "Connecting to $PGHOST as the admin user ..."

# ── Hash the password the way PostgreSQL stores it ──────────────────────────
verifier="$(HHB_PW="$pw" python3 - <<'PY'
import base64, hashlib, hmac, os

password = os.environ['HHB_PW'].encode()
salt = os.urandom(16)
iterations = 4096
salted = hashlib.pbkdf2_hmac('sha256', password, salt, iterations)
client_key = hmac.new(salted, b'Client Key', 'sha256').digest()
stored_key = hashlib.sha256(client_key).digest()
server_key = hmac.new(salted, b'Server Key', 'sha256').digest()
b64 = lambda b: base64.b64encode(b).decode()
print('SCRAM-SHA-256$%d:%s$%s:%s' % (iterations, b64(salt), b64(stored_key), b64(server_key)))
PY
)"

# ── Create the user and the database ────────────────────────────────────────
# RDS's admin is not a true superuser: to create a database owned by another user it must be allowed to
# act as that user, hence the GRANT. (PostgreSQL 16 asks for the SET option explicitly.)
HHB_VERIFIER="$verifier" psql -X -q -v ON_ERROR_STOP=1 -v role="$DB_ROLE" -v db="$DB_NAME" <<'SQL'
\getenv verifier HHB_VERIFIER

SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'role') AS role_exists \gset
\if :role_exists
  \echo User :role already exists: setting its password.
  ALTER ROLE :"role" WITH LOGIN PASSWORD :'verifier';
\else
  CREATE ROLE :"role" WITH LOGIN PASSWORD :'verifier';
  \echo Created user :role.
\endif

SELECT current_setting('server_version_num')::int >= 160000 AS pg16 \gset
\if :pg16
  GRANT :"role" TO CURRENT_USER WITH SET TRUE;
\else
  GRANT :"role" TO CURRENT_USER;
\endif

SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'db') AS db_exists \gset
\if :db_exists
  \echo Database :db already exists: left as it is.
\else
  CREATE DATABASE :"db" OWNER :"role";
  \echo Created database :db.
\endif
SQL

# ── Check the new login works, and that it may create tables (Prisma will) ──
PGUSER="$DB_ROLE" PGPASSWORD="$pw" PGDATABASE="$DB_NAME" psql -X -q -At -v ON_ERROR_STOP=1 <<'SQL'
SELECT 'Logged in as ' || current_user || ' on ' || current_database();
BEGIN;
CREATE TABLE _hariharibol_probe (id int);
ROLLBACK;
SQL

# ── Put the URL in hariharibol's .env ───────────────────────────────────────
mkdir -p "$(dirname "$APP_ENV")"
HHB_PW="$pw" HHB_ROLE="$DB_ROLE" HHB_DB="$DB_NAME" HHB_HOST="$PGHOST" HHB_PORT="$PGPORT" HHB_SSL="$PGSSLMODE" \
python3 - "$APP_ENV" <<'PY'
import os, shutil, sys, time
from urllib.parse import quote

path = sys.argv[1]
e = os.environ
url = 'postgresql://%s:%s@%s:%s/%s?sslmode=%s' % (
    e['HHB_ROLE'], quote(e['HHB_PW'], safe=''), e['HHB_HOST'], e['HHB_PORT'], e['HHB_DB'], e['HHB_SSL'])
new_line = 'DATABASE_URL=' + url + '\n'

lines = open(path).read().splitlines(keepends=True) if os.path.exists(path) else []
if lines and not lines[-1].endswith('\n'):
    lines[-1] += '\n'
if any(l.startswith('DATABASE_URL=') for l in lines):
    out = [new_line if l.startswith('DATABASE_URL=') else l for l in lines]
else:
    out = lines + [new_line]

if os.path.exists(path):
    shutil.copy2(path, '%s.bak.%d' % (path, time.time()))
tmp = path + '.tmp'
with open(os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600), 'w') as f:
    f.writelines(out)
os.replace(tmp, path)
os.chmod(path, 0o600)
PY
echo "DATABASE_URL in $APP_ENV now points at $PGHOST, database $DB_NAME (password not shown)."
