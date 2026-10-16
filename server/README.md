# Server Deployment (`/var/www/server`)

Production deployment layout for the HariHariBol live server. Images are built by
GitHub Actions and pushed to **ECR**; the server **pulls** them — it never builds.

## Layout

```
/var/www/server/
├── config.sh              # shared: ECR registry, image names, ecr_login()
├── prune.sh               # shared: reclaim disk (safe — keeps data volumes)
├── bootstrap.sh           # ONE-TIME: install docker/aws-cli, create dirs
│
├── website/
│   ├── config.sh          # pull website image + docker compose up
│   ├── prune.sh           # → runs ../prune.sh
│   ├── docker-compose.yml # website container (port 3000)
│   ├── .env               # NOT committed — copy from .env.example
│   └── security/          # NOT committed — website secret files (usually empty)
│
└── backend/
    ├── config.sh          # pull api image + postgres/redis + migrate + up
    ├── prune.sh           # → runs ../prune.sh
    ├── docker-compose.yml # api (3001) + postgres + redis
    ├── .env               # NOT committed — copy from .env.example
    └── security/          # NOT committed — firebase json, apple/apns .p8, etc.
```

## First-time setup

```bash
# On the EC2 instance:
sudo bash bootstrap.sh           # installs docker + aws cli, creates /var/www/server

cd /var/www/server/website && cp .env.example .env && nano .env
cd /var/www/server/backend && cp .env.example .env && nano .env

# Upload secret key files into backend/security/ (see its README)
# Configure AWS so ECR pull works:
aws configure                     # or attach an IAM instance role with ECR read
```

## Deploy / redeploy

```bash
cd /var/www/server/website && ./config.sh    # deploy website
cd /var/www/server/backend && ./config.sh    # deploy backend (db + redis + api)
```

`config.sh` is idempotent — run it again after a new image is pushed to ECR to
pull and restart with the latest version.

## Maintenance

```bash
cd /var/www/server && ./prune.sh             # free disk; preserves db/redis data
docker compose logs -f                        # tail logs (run inside a folder)
docker compose ps                             # container status
```

## Ports

| Service  | Host port | Notes |
|----------|-----------|-------|
| Website  | 3000      | Next.js |
| Backend  | 3001      | REST API (container's 3000) |
| Postgres | internal  | only reachable on the compose network |
| Redis    | internal  | only reachable on the compose network |

## Security

- `.env` files and everything under `security/` are git-ignored.
- `security/` folders are `chmod 700`; put key files at `chmod 600`.
- Secret files are mounted **read-only** into the API at `/app/security/`.
