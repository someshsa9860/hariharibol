# HariHariBol Backend Setup Guide

Complete step-by-step guide to set up the Node.js backend with PostgreSQL, Prisma, Firebase, and multiple AI providers.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Database Configuration](#database-configuration)
4. [AI Provider Setup](#ai-provider-setup)
5. [Firebase Configuration](#firebase-configuration)
6. [Jobs & Queue Setup](#jobs--queue-setup)
7. [WebSocket Setup](#websocket-setup)
8. [Running the Backend](#running-the-backend)
9. [Seeding Data](#seeding-data)
10. [Deployment](#deployment)

---

## Prerequisites

### Required

- **Node.js:** 18+ (LTS recommended)
- **npm:** 8+
- **PostgreSQL:** 14+ (or Docker)
- **Redis:** 6+ (or Docker)

### Optional but Recommended

- **Docker & Docker Compose** — for local PostgreSQL + Redis
- **Git** — for version control
- **Postman or VS Code REST Client** — for API testing

### API Keys/Credentials Needed

- **Google OAuth** — Client IDs for iOS, Android, Web
- **Apple Sign-In** — Client ID, Team ID, Key ID, Private Key
- **Claude/OpenAI/Gemini** — API keys for at least one provider
- **Firebase** — Project ID, Private Key, Client Email
- **AWS S3** — Access Key, Secret Key, Bucket name (optional)

---

## Initial Setup

### 1. Clone Repository

```bash
cd ~/projects
git clone <repo-url> hariharibol
cd hariharibol/backend
```

### 2. Install Dependencies

```bash
npm install
```

This installs all packages including:
- NestJS framework
- Prisma ORM
- BullMQ for jobs
- Firebase Admin
- AI provider SDKs (Anthropic, OpenAI)

### 3. Verify Installation

```bash
node -v      # Should be v18+
npm -v       # Should be v8+
npx prisma version   # Should be v5.11+
```

---

## Database Configuration

### Option A: Docker (Recommended for Local Dev)

**Start PostgreSQL + Redis:**

```bash
docker-compose up -d
```

This starts:
- **PostgreSQL** on `localhost:5432`
  - User: `sanatan`
  - Password: `sanatan_dev_password`
  - Database: `sanatan`
- **Redis** on `localhost:6379`
- **Adminer** (DB UI) on `http://localhost:8080`

**Verify services running:**

```bash
docker ps
# Should show postgres, redis, adminer containers
```

**Access database UI:**

Navigate to http://localhost:8080
- Server: `postgres`
- Username: `sanatan`
- Password: `sanatan_dev_password`
- Database: `sanatan`

### Option B: Local PostgreSQL

If you have PostgreSQL installed locally:

```bash
# Create database
createdb -U postgres sanatan

# Create user
createuser sanatan
# When prompted, set password: sanatan_dev_password

# Grant privileges
psql -U postgres -c "ALTER ROLE sanatan WITH CREATEDB"
```

Update `.env`:

```
DATABASE_URL=postgresql://sanatan:sanatan_dev_password@localhost:5432/sanatan
```

---

## Environment Configuration

### 1. Create `.env` File

```bash
cp .env.example .env
```

### 2. Configure Required Variables

Edit `.env` with your credentials:

```bash
# Application
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000

# Database (already configured if using Docker)
DATABASE_URL=postgresql://sanatan:sanatan_dev_password@localhost:5432/sanatan

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT (generate secure secrets)
JWT_ACCESS_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=30d

# Admin Panel
ADMIN_PANEL_URL=http://localhost:3001
ALLOWED_ORIGINS=http://localhost:3001,http://localhost:3000

# Logging
LOG_LEVEL=debug
```

---

## AI Provider Setup

### Choose Your AI Provider

The system supports **Claude** (recommended), **OpenAI**, or **Gemini**. You can switch anytime via `AI_PROVIDER` env var.

### Option 1: Anthropic Claude (Recommended)

**Best for:** Accurate scripture understanding, low hallucination

1. **Get API Key:**
   - Go to https://console.anthropic.com
   - Create account or sign in
   - Navigate to API Keys
   - Create new key

2. **Add to `.env`:**

```bash
AI_PROVIDER=claude
ANTHROPIC_API_KEY=sk-ant-xxxxxxxx
```

3. **Test:**

```bash
# Will be used by moderation and GuruDev chatbot
curl http://localhost:3000/health
```

### Option 2: OpenAI

**Best for:** Faster responses, ChatGPT ecosystem**

1. **Get API Key:**
   - Go to https://platform.openai.com/api-keys
   - Create new secret key

2. **Add to `.env`:**

```bash
AI_PROVIDER=openai
OPENAI_API_KEY=sk-proj-xxxxxxxx
```

### Option 3: Google Gemini

**Best for:** Cost-effective, good performance**

1. **Get API Key:**
   - Go to https://ai.google.dev/
   - Get API Key

2. **Add to `.env`:**

```bash
AI_PROVIDER=gemini
GEMINI_API_KEY=xxxxxxxx
```

### Switch Providers at Runtime

Just change the env var:

```bash
export AI_PROVIDER=openai
npm run dev
```

---

## Firebase Configuration

Firebase is used for **push notifications** (FCM for Android, APNs for iOS).

### 1. Create Firebase Project

1. Go to https://console.firebase.google.com
2. Click "Add project"
3. Fill in project details
4. Enable Firestore (we use it indirectly via Firebase Admin)

### 2. Create Service Account

1. **Project Settings** → **Service Accounts**
2. Click **Generate New Private Key**
3. Save the JSON file

### 3. Extract Credentials

From the downloaded JSON:

```bash
# Extract and add to .env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project-id.iam.gserviceaccount.com
```

**Important:** The FIREBASE_PRIVATE_KEY must have literal `\n` characters (not actual newlines).

### 4. Set Up APNs (iOS)

For iOS push notifications:

1. **In Firebase Console:**
   - Project Settings → Cloud Messaging
   - Scroll to iOS App Configuration
   - Upload your APNs key

2. **Add to `.env`:**

```bash
APNS_KEY_ID=xxxx
APNS_TEAM_ID=xxxx
APNS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
```

---

## Jobs & Queue Setup

Jobs run asynchronously via BullMQ + Redis.

### Configured Job Queues

1. **moderation** — AI moderation of group messages
2. **notifications** — Push notifications
3. **affinity-calculation** — Compute user's guru affinity
4. **email** — Transactional emails

### Testing Jobs Locally

Jobs automatically process when Redis is running:

```bash
# Ensure Redis is running
redis-cli ping
# Output: PONG

# Jobs will be processed by background workers
npm run dev
```

### Monitoring Jobs

Install **Bull Dashboard** (optional):

```bash
npm install @bull-board/express @bull-board/ui
```

Then add to your main.ts and access at `/admin/queues`.

---

## WebSocket Setup

Socket.IO is configured for real-time group chat.

### Configuration

In `src/modules/groups/groups.gateway.ts` (to be created):

```typescript
import { WebSocketGateway, SubscribeMessage, MessageBody } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@WebSocketGateway({
  namespace: '/groups',
  cors: { origin: process.env.ALLOWED_ORIGINS?.split(',') },
})
export class GroupsGateway {
  @SubscribeMessage('join_group')
  handleJoinGroup(client: Socket, data: { groupId: string }) {
    client.join(`group-${data.groupId}`);
  }

  @SubscribeMessage('send_message')
  async handleMessage(client: Socket, data: { groupId: string; content: string }) {
    // Moderation happens here
    // Message broadcast to group via WebSocket
  }
}
```

### Test WebSocket

```bash
# Using websocat (install via brew/apt)
websocat ws://localhost:3000/socket.io/?EIO=4&transport=websocket

# Then send:
{"type": "40"}  # CONNECT
{"type": "42", "data": ["join_group", {"groupId": "xxx"}]}
```

Or use a WebSocket client like **Postman** or **Socket.IO Client**.

---

## Running the Backend

### Start Development Server

```bash
npm run dev
```

Output:
```
✅ Application running on http://localhost:3000
✅ Database connected
```

### Check Health

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "statusCode": 200,
  "message": "Success",
  "data": {
    "status": "ok",
    "timestamp": "2026-04-27T10:00:00.000Z",
    "uptime": 5.234
  }
}
```

### Build for Production

```bash
npm run build
npm start
```

---

## Seeding Data

### 1. Generate Prisma Client

```bash
npm run prisma:generate
```

### 2. Run Database Migrations

```bash
npx prisma migrate dev --name init
```

This:
- Creates all database tables
- Sets up indexes
- Creates a migration file you can inspect

### 3. Seed Initial Data

Create `src/seeders/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1. Create languages
  const en = await prisma.language.create({
    data: { code: 'en', nameEnglish: 'English', nameNative: 'English' },
  });
  const hi = await prisma.language.create({
    data: { code: 'hi', nameEnglish: 'Hindi', nameNative: 'हिन्दी' },
  });

  // 2. Create translations (UI strings)
  await prisma.translation.create({
    data: {
      key: 'ui.home.welcome',
      namespace: 'ui',
      translations: {
        en: { text: 'Welcome to HariHariBol', status: 'approved' },
        hi: { text: 'हरि हरि बोल में स्वागत है', status: 'approved' },
      },
    },
  });

  // 3. Create sampradayas
  const gaudiya = await prisma.sampraday.create({
    data: {
      slug: 'gaudiya-vaishnavism',
      nameKey: 'sampraday.gaudiya.name',
      descriptionKey: 'sampraday.gaudiya.description',
      isPublished: true,
      displayOrder: 1,
    },
  });

  // 4. Import Bhagavad Gita verses
  // (Load from JSON file and create verses)

  console.log('✅ Seed completed');
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
```

Run:

```bash
npm run seed
```

### 4. Verify Data

Open Prisma Studio:

```bash
npm run prisma:studio
```

Navigate to `http://localhost:5555` to browse your data.

---

## API Testing

### Using cURL

```bash
# Health check
curl http://localhost:3000/health

# List sampradayas
curl http://localhost:3000/api/v1/sampradayas?lang=en

# Get verse of the day
curl http://localhost:3000/api/v1/verses/of-the-day?lang=en
```

### Using Postman

1. Import `backend.postman_collection.json` (to be created)
2. Set `base_url` to `http://localhost:3000`
3. Run requests

### Using REST Client (VS Code)

Create `test.http`:

```http
### Health Check
GET http://localhost:3000/health

### List Sampradayas
GET http://localhost:3000/api/v1/sampradayas?lang=en
Authorization: Bearer <token>

### Create User (requires Google ID token)
POST http://localhost:3000/api/v1/auth/google
Content-Type: application/json

{
  "id_token": "<google_id_token>",
  "device_info": {
    "type": "ios",
    "model": "iPhone 14",
    "osVersion": "17.0"
  }
}
```

---

## Deployment

### Pre-deployment Checklist

- [ ] All environment variables configured
- [ ] Database migrated: `npx prisma migrate deploy`
- [ ] Redis is accessible
- [ ] Firebase credentials valid
- [ ] AI API key working
- [ ] CORS origins updated
- [ ] Rate limits configured
- [ ] Backups scheduled

### Deploying to AWS EC2

```bash
# 1. SSH into instance
ssh -i key.pem ubuntu@your-server

# 2. Install Node.js
curl -sL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install nodejs

# 3. Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# 4. Clone repo
git clone <repo-url>
cd hariharibol/backend

# 5. Install dependencies
npm ci

# 6. Set environment variables
cp .env.example .env
# Edit .env with production values

# 7. Run migrations
npx prisma migrate deploy

# 8. Build and start
npm run build
npm start
```

### Deploying to Vercel (Serverless)

Unfortunately, NestJS isn't ideal for Vercel's serverless model due to long-running jobs. Better alternatives:

- **Railway.app** — One-click PostgreSQL + Node.js
- **Render.com** — Background workers + Node.js
- **AWS Lambda + RDS** — Requires restructuring

### Deploying via Docker

```bash
# Build image
docker build -t sanatan-backend:1.0 .

# Push to registry
docker tag sanatan-backend:1.0 <registry>/sanatan-backend:1.0
docker push <registry>/sanatan-backend:1.0

# Deploy with docker-compose or Kubernetes
docker run -p 3000:3000 --env-file .env.prod <registry>/sanatan-backend:1.0
```

---

## Troubleshooting

### Database Connection Error

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Check connection string
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"
```

### Prisma Migration Issues

```bash
# Reset database (⚠️ deletes all data)
npx prisma migrate reset

# Check migration status
npx prisma migrate status

# Create new migration
npx prisma migrate dev --name add_field_name
```

### Redis Connection Error

```bash
# Verify Redis
redis-cli ping
# Output: PONG

# Check Redis config
cat /etc/redis/redis.conf | grep port
```

### AI API Key Not Working

```bash
# Test Claude API
curl -X POST https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model": "claude-3-opus-20240229", "max_tokens": 100, "messages": [{"role": "user", "content": "Hi"}]}'
```

### Slow API Responses

```bash
# Check logs
npm run dev

# Enable query logging in Prisma
# Set `@prisma/client` log level to debug
```

---

## Next Steps

Once the backend is running:

1. **Set up Admin Panel** — Next.js dashboard for content management
2. **Build Mobile App** — Flutter iOS/Android app
3. **Configure CI/CD** — GitHub Actions for automated tests
4. **Set up Monitoring** — Sentry for error tracking
5. **Optimize Performance** — Database indexes, caching

---

## Resources

- **NestJS Docs:** https://docs.nestjs.com
- **Prisma Docs:** https://www.prisma.io/docs
- **PostgreSQL Docs:** https://www.postgresql.org/docs
- **Firebase Docs:** https://firebase.google.com/docs
- **BullMQ Docs:** https://docs.bullmq.io

---

## Support

For issues:

1. Check the logs: `npm run dev`
2. Read `.env.example` for all required variables
3. Test database: `npm run prisma:studio`
4. Check Redis: `redis-cli ping`

Good luck! 🙏
