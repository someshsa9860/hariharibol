# EC2 deployment

Everything the app needs on the server lives in one folder, `/var/www/hariharibol`.
Nothing is kept in `/home/ubuntu`.

```text
/var/www/hariharibol/
├── server/     the deploy scripts (one per container) and the live .env; nginx.conf and apache/ are the web-server configs
├── secrets/    Google service-account JSON, CloudFront key, other credential files
└── website/    the built landing page, served read-only by the website container
```

The GitHub workflows build two independent images and push them to ECR:

- `hariharibol-backend` — API, worker, websocket and deeplink containers
- `hariharibol-admin` — the Vite build served by nginx

The landing page is not an image: its workflow builds `website/` and uploads
the files.

## Setting up a server

```bash
sudo install -d -o ubuntu -g ubuntu /var/www/hariharibol
scp -r deploy/server ubuntu@<host>:/var/www/hariharibol/server
ssh ubuntu@<host>
cd /var/www/hariharibol/server && chmod +x *.sh && ./setup.sh
```

`setup.sh` installs Docker, the AWS CLI and Nginx, creates `.env` from
`.env.example`, and creates the empty `secrets/` and `website/` folders. Fill in
`server/.env`, then put the Google service-account JSON, CloudFront key files and
other credential material in `/var/www/hariharibol/secrets/`; the backend
containers mount that directory read-only at `/app/secrets`.

The server's AWS identity (an instance role, or an IAM user set up with
`aws configure`) only needs to pull from ECR: `ecr:GetAuthorizationToken`,
`ecr:BatchCheckLayerAvailability`, `ecr:GetDownloadUrlForLayer` and
`ecr:BatchGetImage`.

`setup.sh` also configures Nginx, for a server that hosts only this project. `/api/` and `/health` go to the API, `/ws`
to the websocket service, `/verse`, `/sloka`, `/mantra`, `/book` and the app
link files to the deeplink service, `admin.hariharibol.com` to the admin panel
and `hariharibol.com` to the website. TLS certificates are Let's Encrypt.

### On a shared Apache server

The production server also hosts other sites behind Apache, so `setup.sh` is not
run there. `apache/hariharibol.conf` (port 80, redirects to https) and
`apache/hariharibol-le-ssl.conf` (the three https hosts, same routes as the Nginx
file) go in `/etc/apache2/sites-available/`. Once DNS points at the server:

```bash
sudo a2ensite hariharibol && sudo systemctl reload apache2   # port 80 first: certbot answers its challenge through it
sudo certbot certonly --apache -d hariharibol.com -d www.hariharibol.com
sudo certbot certonly --apache -d api.hariharibol.com -d admin.hariharibol.com
sudo a2ensite hariharibol-le-ssl
sudo apache2ctl configtest && sudo systemctl reload apache2
```

`www.hariharibol.com` is on the first certificate and is redirected to the bare domain.

### The database

The database there is the shared managed PostgreSQL (RDS), so there is no postgres container. From your
laptop, once:

```bash
ssh -t GSRKHVK_Main "$(cat deploy/create-database.sh)"
```

It asks for the new password (twice), creates the `hariharibol` user and database using the admin login it
reads from api.callvcal.com's `.env` (never printed), and writes `DATABASE_URL` into
`/var/www/hariharibol/server/.env`. Running it again only changes the password. Then deploy the backend so the
Prisma migrations create the tables.

### Memory

Every container has a memory limit, all in `config.sh`. The Node containers also get a heap ceiling
(`*_HEAP_MB`, about 60% of the limit) so Node collects garbage instead of being killed at the limit, and Redis
has `maxmemory` with `noeviction` so a full Redis refuses writes rather than dropping queued jobs. When you
raise a container's limit, raise its heap with it, then run that container's script (`./api.sh`, ...). Redis
is left running by deploys: to apply a new limit, `docker rm -f hariharibol-redis && ./redis.sh`. All limits
together are about 1.7 GB if every container hit its ceiling at once; normal use is a quarter of that, so
give the server 4 GB or more.

## Releasing: merge `main` into `production`

Nothing runs from `main`: pushing to it starts no workflow at all. Every workflow is tied to the
**`production`** branch — a push to it (or a pull request into it) first checks the code (install and
generate the Prisma client for the backend, typecheck and build for the admin panel) and then deploys,
so a release is:

```bash
git checkout production && git pull
git merge main            # or open a pull request main → production on GitHub
git push origin production
```

Each workflow still decides by what changed: a merge that only touches `backend/` deploys the backend,
`admin/` the admin panel, `website/` the landing page. To redeploy without a new commit, use **Actions →
the workflow → Run workflow** and pick the `production` branch; run by hand from any other branch it only
checks the code and does not deploy. `production` is only ever updated by merging `main` into it, never committed to
directly.

The **iOS app** is released the same way, by Xcode Cloud rather than a GitHub workflow: its workflow starts on
branch changes to `production` and ships a build to TestFlight. Its setup, secrets and what must be enabled on
Apple's side are in "Releasing the iOS app (Xcode Cloud)" in [app/CLAUDE.md](../app/CLAUDE.md#releasing-the-ios-app-xcode-cloud).

## Deploying

Deploy everything with `IMAGE_TAG=<git-sha> ./deploy.sh`, or one part with
`./deploy.sh admin`, `./deploy.sh backend` or `./deploy.sh website`. Each container has its own small script
that stops the old container and starts the new one with `docker run`: `redis.sh`, `api.sh`, `worker.sh`,
`socket.sh`, `deeplink.sh`, `admin.sh`, `website.sh`. `deploy.sh backend` is: pull the image, start Redis if it
is not running, run the migrations in a throwaway container (`migrate.sh`, so a failed migration stops the
deploy while the old containers keep serving), then restart the four backend containers. `config.sh` holds
the paths, image names, tags and CPU/memory limits; `common.sh` holds the little functions the scripts share.
`./pull.sh` pulls the images; `./prune.sh` removes superseded images, and the backend and admin workflows run
it after each deploy.

The backend and admin workflows run `deploy.sh` over SSH when the
`DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY` and `DEPLOY_PATH` secrets are
set; without `DEPLOY_HOST` the image still builds and is pushed, and no
deployment is attempted. GitHub Actions does not write runtime environment
variables or credential files to the server; those stay on the server.

The two workflows also tell the server which registry they just pushed to
(`EXPECT_ECR_REGISTRY`), and `deploy.sh` stops if `server/.env` names a different
one. Without that, a server still pointing at the old account would pull the old
image and the run would pass while nothing changed.

The public landing page lives in `website/`. Changes to it deploy through
`.github/workflows/deploy-website.yml` to the root `hariharibol.com` host. The
workflow uploads the built files to `$DEPLOY_PATH/website`, uploads the website
scripts to `$DEPLOY_PATH/server`, starts the small nginx
website container and checks it answers on `127.0.0.1:8081`. It does not touch
the host web server or request a certificate; do that once as described above.

The website is a public nginx image plus static files, so it deploys without
any AWS login on the server.

Only those four server files (`config.sh`, `common.sh`, `deploy.sh`, `website.sh`) are uploaded by that
workflow. Anything else in `deploy/server/` (for example `prune.sh`) reaches the server when you copy it
there yourself.

## Shared links and refer and earn

After merging `main` into `production`: the deploy applies `20261027000000_share_referral`. Then set, in the API's env
file, `APPLE_TEAM_ID` (Apple Developer team id), `ANDROID_CERT_SHA256` (signing-certificate fingerprint from Play
Console → App integrity) and, once the apps are listed, `PLAY_STORE_URL` and `APP_STORE_URL`. The nginx change
(`/.well-known/apple-app-site-association` and `assetlinks.json` proxied to the deeplink container on the apex domain)
needs `deploy/server/nginx.conf` installed and nginx reloaded. Check
`https://hariharibol.com/.well-known/assetlinks.json` and `apple-app-site-association` return JSON with no redirect.

## GitHub secrets and variables

Add these under **Settings → Secrets and variables → Actions**.

**Secrets** (credentials):

| Secret | Used for |
|---|---|
| `AWS_ACCESS_KEY_ID` | Pushing images to ECR — an IAM user in the account named by `ECR_REGISTRY` |
| `AWS_SECRET_ACCESS_KEY` | Pushing images to ECR |
| `DEPLOY_HOST` | EC2 hostname or IP |
| `DEPLOY_USER` | SSH user, normally `ubuntu` |
| `DEPLOY_SSH_KEY` | Full private SSH key contents |
| `DEPLOY_PATH` | Server folder, `/var/www/hariharibol` |

**Variables** (not secret):

| Variable | Used for |
|---|---|
| `AWS_REGION` | `ap-south-1` |
| `ECR_REGISTRY` | `<account-id>.dkr.ecr.ap-south-1.amazonaws.com`. The backend and admin workflows stop if the AWS keys belong to a different account, so images can't land in the wrong one. |
| `VITE_API_URL` | Public API URL embedded in the admin bundle: `https://api.hariharibol.com` |
| `VITE_GOOGLE_CLIENT_ID` | Google web client ID embedded in the admin bundle. `https://admin.hariharibol.com` must be one of its authorised JavaScript origins. |

The two `VITE_*` values are variables because Vite writes them into the public
bundle; the admin workflow refuses to build if either is empty (an empty build
cannot reach the API or sign anyone in).

The server's `server/.env` must contain `DATABASE_URL`, `REDIS_PASSWORD`, `REDIS_URL`, `JWT_SECRET`, and
`GOOGLE_SERVICE_ACCOUNT_PATH=/app/secrets/hari-hari-bol-service-account.json`.
Keep CloudFront keys, Firebase JSON, and all other runtime credentials in the
server's `.env` or the sibling `secrets/` folder. Do not commit them or add
them as GitHub Actions secrets.

The server stack includes a Redis container (reachable as `redis` on the `hariharibol` Docker network) with a
persistent Docker volume; the database is external (see "On a shared Apache server"). Schema changes run
through Prisma migrations during API deployment.

## Changing AWS account

The account appears in five places. Change them in this order, so the server
can already pull from the new registry when the first image lands there:

1. **New account** — create the ECR repositories `hariharibol-backend` and
   `hariharibol-admin`, an IAM user that can push to them (for GitHub), and one
   that can only pull (for the server).
2. **Server** — run `aws configure` with the pull user's keys, and set
   `ECR_REGISTRY` in `/var/www/hariharibol/server/config.sh`. Until it matches the
   GitHub variable, deploys fail on purpose (see above).
3. **GitHub** — update the `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`
   secrets and the `ECR_REGISTRY` variable.
4. **Run the Backend CI and Admin CI workflows** (Actions → Run workflow). Each
   pushes to the new registry and the server pulls from it.
5. **The app's own AWS keys** — `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` and
   `S3_BUCKET` in `server/.env` are what the API uses for media storage, not for
   deploying. A new account needs its own bucket and keys there too.

## Moving to another server

1. Create the database (above), then deploy the backend so the tables exist.
2. At the switch, stop the old API (`docker stop hariharibol-api-1 hariharibol-socket-1 hariharibol-worker-1`
   on the old server) and run `./deploy/import-users.sh` from your laptop. It copies the users and their
   sign-in sessions, so people who open the app on the new server are still signed in. Try it first with
   `--dry-run`, which copies inside a transaction and rolls it back. Its header says why the order matters.
3. Point the domain at the new server.
