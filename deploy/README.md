# EC2 deployment

Everything the app needs on the server lives in one folder, `/var/www/hariharibol`.
Nothing is kept in `/home/ubuntu`.

```text
/var/www/hariharibol/
├── server/     scripts, docker-compose.yml, nginx.conf and the live .env
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
other credential material in `/var/www/hariharibol/secrets/`; Compose mounts
that directory read-only at `/app/secrets` in every backend container.

The server's AWS identity (an instance role, or an IAM user set up with
`aws configure`) only needs to pull from ECR: `ecr:GetAuthorizationToken`,
`ecr:BatchCheckLayerAvailability`, `ecr:GetDownloadUrlForLayer` and
`ecr:BatchGetImage`.

`setup.sh` also configures Nginx. `/api/` and `/health` go to the API, `/ws`
to the websocket service, `/verse`, `/sloka`, `/mantra`, `/book` and the app
link files to the deeplink service, `admin.hariharibol.com` to the admin panel
and `hariharibol.com` to the website. TLS certificates are Let's Encrypt.

## Deploying

Deploy everything with `IMAGE_TAG=<git-sha> ./deploy.sh`, or one part with
`./deploy.sh admin`, `./deploy.sh backend` or `./deploy.sh website`.
`config.sh` centralizes paths, image repositories, tags and CPU/memory limits.
`./pull.sh` pulls all configured images; `./prune.sh` removes superseded
images and build cache, and the backend and admin workflows run it after each
deploy.

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
workflow uploads the built files to `$DEPLOY_PATH/website`, uploads the compose,
nginx and website scripts to `$DEPLOY_PATH/server`, starts the small nginx
website container and reloads the host Nginx configuration. On the first
deployment it requests the `hariharibol.com` Let's Encrypt certificate using
the existing DNS record.

The website is a public nginx image plus static files, so it deploys without
any AWS login on the server.

Only those four server files are uploaded by that workflow. Anything else in
`deploy/server/` (for example `prune.sh`) reaches the server when you copy it
there yourself.

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

The server's `server/.env` must contain `ECR_REGISTRY`, `BACKEND_REPOSITORY`,
`ADMIN_REPOSITORY`, `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, and
`GOOGLE_SERVICE_ACCOUNT_PATH=/app/secrets/hari-hari-bol-service-account.json`.
Keep CloudFront keys, Firebase JSON, and all other runtime credentials in the
server's `.env` or the sibling `secrets/` folder. Do not commit them or add
them as GitHub Actions secrets.

The server stack includes local PostgreSQL and Redis containers with persistent
Docker volumes. Future schema changes run through Prisma migrations during API
deployment.

## Changing AWS account

The account appears in five places. Change them in this order, so the server
can already pull from the new registry when the first image lands there:

1. **New account** — create the ECR repositories `hariharibol-backend` and
   `hariharibol-admin`, an IAM user that can push to them (for GitHub), and one
   that can only pull (for the server).
2. **Server** — run `aws configure` with the pull user's keys, and set
   `ECR_REGISTRY` in `/var/www/hariharibol/server/.env`. Until it matches the
   GitHub variable, deploys fail on purpose (see above).
3. **GitHub** — update the `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`
   secrets and the `ECR_REGISTRY` variable.
4. **Run the Backend CI and Admin CI workflows** (Actions → Run workflow). Each
   pushes to the new registry and the server pulls from it.
5. **The app's own AWS keys** — `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` and
   `S3_BUCKET` in `server/.env` are what the API uses for media storage, not for
   deploying. A new account needs its own bucket and keys there too.
