# HariHariBol

![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=node.js&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-10-E0234E?logo=nestjs&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-14-000000?logo=next.js&logoColor=white)
![Flutter](https://img.shields.io/badge/Flutter-3.x-02569B?logo=flutter&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)

A comprehensive spiritual learning platform for Vedic verse learning, chanting, and personalized guidance — powered by AI.

---

## Overview

HariHariBol brings together Vedic scriptures, mantras, and narrations in a single platform with AI-powered recommendations, multi-language support, and real-time engagement features.

**Key features:**
- Daily verse of the day with AI-generated explanations and imagery
- Sanskrit verse library with transliterations and multi-language translations
- Mantra chanting tracker with personal logs
- Sampradaya (spiritual tradition) follow system
- GuruDev AI chatbot for spiritual guidance
- Push notifications via Firebase Cloud Messaging
- Admin panel for content management and moderation

---

## Architecture

```
hariharibol/
├── backend/        NestJS REST API + WebSocket server (port 3001)
├── webapp/         Next.js progressive web app — user-facing (port 3002)
├── website/        Next.js marketing & landing website (port 3003)
├── admin/          Next.js admin panel (port 3000)
├── mobile_app/     Flutter iOS & Android client
└── data-pipeline/  Python scripts for seed data and ETL
```

**Infrastructure:** PostgreSQL 16 · Redis 7 · Firebase · AWS S3 (optional) · Bull Queue

---

## Quick Start

### Option A — Docker Compose (recommended)

Runs all services with a single command.

```bash
# 1. Clone
git clone https://github.com/someshsa9860/hariharibol.git
cd hariharibol

# 2. Copy and fill in environment files
cp backend/.env.example backend/.env
cp webapp/.env.example   webapp/.env
cp website/.env.example  website/.env
cp admin/.env.example    admin/.env

# 3. Edit backend/.env with your secrets (DB, JWT, AI keys, etc.)
# At minimum, change: JWT_ACCESS_SECRET, JWT_REFRESH_SECRET

# 4. Start all services
docker compose up -d

# 5. Run database migrations (first time only)
docker compose exec backend npx prisma migrate deploy
```

Services will be available at:

| Service  | URL                   |
|----------|-----------------------|
| Admin    | http://localhost:3000 |
| Backend  | http://localhost:3001 |
| Web App  | http://localhost:3002 |
| Website  | http://localhost:3003 |
| PgAdmin  | http://localhost:5050 (run with `--profile tools`) |

**With optional services:**
```bash
# DB management UI (pgAdmin)
docker compose --profile tools up -d

# Nginx reverse proxy
docker compose --profile proxy up -d
```

### Option B — Individual Services

#### Backend (NestJS)
```bash
cd backend
npm install
cp .env.example .env   # fill in values
npx prisma migrate dev
npm run dev            # starts on port 3000 (mapped to 3001 in compose)
```

#### Admin Panel (Next.js)
```bash
cd admin
npm install
cp .env.example .env
npm run dev            # starts on port 3009
```

#### Web App (Next.js)
```bash
cd webapp
npm install
cp .env.example .env
npm run dev            # starts on port 3000
```

#### Marketing Website (Next.js)
```bash
cd website
npm install
cp .env.example .env
npm run dev            # starts on port 3000
```

#### Mobile App (Flutter)
```bash
cd mobile_app
flutter pub get
flutter run
```

---

## Environment Setup

Each service needs a `.env` file. Start from the provided `.env.example` in each directory.

### Minimum required for local development

**`backend/.env`** — the most critical file:
```env
DATABASE_URL=postgresql://sanatan:sanatan_dev_password@localhost:5432/sanatan
JWT_ACCESS_SECRET=<random-32+-char-string>
JWT_REFRESH_SECRET=<random-32+-char-string>
REDIS_HOST=localhost
REDIS_PORT=6379
```

For AI features, add one of:
```env
GEMINI_API_KEY=your_key    # preferred
OPENAI_API_KEY=your_key
ANTHROPIC_API_KEY=your_key
```

Generate secure JWT secrets:
```bash
openssl rand -base64 64
```

---

## Development

### Common Commands

```bash
# Backend
cd backend
npm run dev                        # Dev server with hot reload
npm run build                      # Production build
npx prisma studio                  # Visual DB browser
npx prisma migrate dev --name xyz  # Create and apply migration
npx prisma migrate deploy          # Apply migrations (production)

# Admin Panel / Web App / Website
npm run dev     # Dev server
npm run build   # Production build
npm run lint    # ESLint check

# Mobile
flutter pub get          # Install dependencies
flutter run              # Run on connected device/emulator
flutter build apk        # Build Android APK
flutter build ios        # Build iOS (macOS only)
```

### API Documentation

The backend exposes a REST API at `http://localhost:3001/api/v1`.

Key endpoint groups:
- `GET  /api/v1/verses/of-day`        — today's verse (public)
- `POST /api/v1/auth/google`           — Google OAuth sign-in
- `GET  /api/v1/sampradayas`           — list traditions
- `GET  /api/v1/mantras`               — list mantras
- `POST /api/v1/chanting-logs`         — log a chanting session (auth required)

Admin endpoints are prefixed with `/api/v1/admin/`.

### Database

The project uses **Prisma ORM** with PostgreSQL.

```bash
# View schema
cat backend/prisma/schema.prisma

# Reset DB (development only — destroys all data)
cd backend && npx prisma migrate reset
```

---

## Deployment

### Docker (Production)

```bash
# Build production images
docker build -t hariharibol-backend:latest ./backend
docker build -t hariharibol-admin:latest   ./admin

# Run with production env
docker compose -f docker-compose.yml up -d
```

Pre-built images are published to GitHub Container Registry:
- `ghcr.io/someshsa9860/hariharibol-backend:latest`
- `ghcr.io/someshsa9860/hariharibol-admin:latest`

### Production Checklist

- [ ] Strong `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` set
- [ ] `DATABASE_URL` points to production PostgreSQL
- [ ] `REDIS_URL` or `REDIS_HOST`/`REDIS_PORT` configured
- [ ] Firebase credentials configured for push notifications
- [ ] `STORAGE_PROVIDER=s3` with valid AWS credentials (or keep `local`)
- [ ] `ALLOWED_ORIGINS` includes your production domains
- [ ] `NODE_ENV=production` on all services
- [ ] Database migrations run: `npx prisma migrate deploy`
- [ ] HTTPS configured (via nginx or cloud load balancer)

---

## Tech Stack

| Layer        | Technology                                    |
|--------------|-----------------------------------------------|
| Backend      | NestJS 10, Prisma ORM, PostgreSQL, Redis      |
| Mobile       | Flutter 3.x, Riverpod, Dio                    |
| Admin        | Next.js 14, React 18, Tailwind CSS, Zustand   |
| Web App      | Next.js 14, React 18, Tailwind CSS            |
| AI           | Google Gemini (default), OpenAI, Anthropic    |
| Push         | Firebase Cloud Messaging (FCM)                |
| Storage      | Local filesystem or AWS S3                    |
| Auth         | JWT (15 min access + 30 day refresh rotation) |
| OAuth        | Google Sign-In, Apple Sign-In                 |

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Follow the guidelines in [CLAUDE.md](./CLAUDE.md)
4. Commit with conventional commits: `feat: add ...`, `fix: ...`, `chore: ...`
5. Open a pull request

---

## License

Private — All rights reserved.
