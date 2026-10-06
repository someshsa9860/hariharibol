# EC2 deployment

The GitHub workflows build two independent images and push them to ECR:

- `hariharibol-backend` — API, worker, websocket and deeplink containers
- `hariharibol-admin` — the Vite build served by nginx

On the server, copy `deploy/server/` and `deploy/secrets/` into a parent
directory such as `/opt/hariharibol`, run `server/setup.sh`, and fill in the
generated `server/.env`. Put Google service-account JSON, CloudFront key files,
and other credential material in `/opt/hariharibol/secrets/`; Compose mounts
that directory read-only at `/app/secrets` in every backend container. The
server's IAM role should have
read-only ECR permissions (`ecr:GetAuthorizationToken`,
`ecr:BatchCheckLayerAvailability`, `ecr:GetDownloadUrlForLayer`,
`ecr:BatchGetImage`).

`setup.sh` installs and configures Nginx. The initial config uses one default
HTTP virtual host: `/api/` and `/health` go to the API, `/ws` goes to the
websocket service, and all other paths go to the admin panel. Replace the
`server_name _;` block with the production domains before enabling TLS.

Make the scripts executable:

```bash
chmod +x /opt/hariharibol/*.sh
```

Deploy everything manually with `IMAGE_TAG=<git-sha> ./deploy.sh`, or deploy
only one independently with `./deploy.sh admin` or `./deploy.sh backend`.
`config.sh` centralizes paths, image repositories, tags, and CPU/memory limits.
Use `./pull.sh` to pull all configured images and `./prune.sh` to remove
unused Docker images and build cache.
The workflows use the latter commands after pushing their image when
`DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, and `DEPLOY_PATH` GitHub
secrets are configured. GitHub Actions does not write runtime environment
variables or credential files to the server; those remain on the server.

The public landing page lives in `website/`. Changes to it deploy through
`.github/workflows/deploy-website.yml` to the root `hariharibol.com` host. The
workflow uploads the static files, starts the small nginx website container,
and reloads the host Nginx configuration. On the first deployment it requests
the `hariharibol.com` Let's Encrypt certificate using the existing DNS record.
If `DEPLOY_HOST` is unset, the image build still completes and no SSH
deployment is attempted.

The admin workflow also requires `VITE_API_URL` and `VITE_GOOGLE_CLIENT_ID`
GitHub secrets because Vite embeds these values into the static bundle at build
time.

## GitHub secrets

Add these under **Settings → Secrets and variables → Actions**:

| Secret | Used for |
|---|---|
| `AWS_ACCESS_KEY_ID` | GitHub Actions ECR login |
| `AWS_SECRET_ACCESS_KEY` | GitHub Actions ECR login |
| `DEPLOY_HOST` | EC2 hostname or IP |
| `DEPLOY_USER` | SSH user, normally `ubuntu` |
| `DEPLOY_SSH_KEY` | Full private SSH key contents |
| `DEPLOY_PATH` | Server parent directory, for example `/home/ubuntu/hariharibol` |
| `VITE_API_URL` | Public API URL embedded in the admin bundle |
| `VITE_GOOGLE_CLIENT_ID` | Google web client ID embedded in the admin bundle |

The server's `server/.env` must contain `ECR_REGISTRY`,
`BACKEND_REPOSITORY`, `ADMIN_REPOSITORY`, `DATABASE_URL`, `REDIS_URL`,
`JWT_SECRET`, and
`GOOGLE_SERVICE_ACCOUNT_PATH=/app/secrets/hari-hari-bol-service-account.json`.
Keep CloudFront keys, Firebase JSON, and all other runtime credentials in the
server's `.env` or sibling `secrets/` directory. Do not commit them or add
them as GitHub Actions secrets.

The server stack includes local PostgreSQL and Redis containers with persistent
Docker volumes. The initial database was restored from the development
PostgreSQL database; future schema changes should run through Prisma migrations
during API deployment.
