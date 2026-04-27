# HariHariBol Backend — NestJS + PostgreSQL + Prisma

Complete Node.js backend for the Sanatan Devotee Platform with support for multiple AI providers (Claude, OpenAI, Gemini), real-time messaging, and moderation.

## Stack

- **Framework:** NestJS 10+ (TypeScript)
- **Database:** PostgreSQL 16
- **ORM:** Prisma 5
- **Real-time:** Socket.IO for group chat
- **Jobs:** BullMQ + Redis for async tasks
- **Cache:** Redis + cache-manager
- **Auth:** JWT + Google/Apple OAuth
- **AI:** Multi-provider abstraction (Claude, OpenAI, Gemini)
- **Push Notifications:** Firebase Cloud Messaging + APNs
- **Storage:** AWS S3 / Google Cloud Storage
- **Monitoring:** Sentry

## Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose (for PostgreSQL + Redis)
- PostgreSQL 16 (or use Docker)
- Redis (or use Docker)

### Setup

1. **Clone and install dependencies:**

```bash
cd backend
npm install
```

2. **Start Docker containers:**

```bash
docker-compose up -d
```

This starts:
- PostgreSQL on `5432`
- Redis on `6379`
- Adminer (DB UI) on `8080`

3. **Configure environment:**

```bash
cp .env.example .env
# Edit .env with your credentials
```

4. **Run migrations & seed data:**

```bash
# Generate Prisma client
npm run prisma:generate

# Create database schema
npx prisma migrate dev --name init

# Seed initial data (languages, sampradayas, verses)
npm run seed
```

5. **Start development server:**

```bash
npm run dev
```

Server runs on `http://localhost:3000`

## Project Structure

```
backend/
├── src/
│   ├── main.ts                      # Entry point
│   ├── app.module.ts               # Root module
│   ├── common/                      # Shared utilities
│   │   ├── decorators/
│   │   ├── filters/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   └── controllers/
│   ├── config/                      # Environment config
│   ├── infrastructure/              # External services
│   │   ├── database/               # Prisma service
│   │   ├── ai/                     # AI provider abstraction
│   │   ├── queue/                  # BullMQ jobs
│   │   ├── storage/                # S3/GCS wrapper
│   │   ├── push/                   # Firebase + APNs
│   │   └── cache/                  # Redis wrapper
│   ├── modules/                     # Feature modules
│   │   ├── auth/                   # Google/Apple auth, JWT
│   │   ├── users/                  # User profiles
│   │   ├── sampradayas/            # Sampraday CRUD
│   │   ├── books/                  # Books & verses
│   │   ├── verses/
│   │   ├── narrations/             # Saint commentaries
│   │   ├── mantras/                # Public mantras
│   │   ├── chanting/               # Chant logging & stats
│   │   ├── favorites/              # User favorites
│   │   ├── translations/           # i18n system
│   │   ├── languages/
│   │   ├── groups/                 # Group chats
│   │   ├── messages/               # Group messages
│   │   ├── moderation/             # AI moderation pipeline
│   │   ├── bans/                   # Ban cascade system
│   │   ├── chatbot/                # GuruDev AI chat
│   │   ├── notifications/          # Push notifications
│   │   ├── admin/                  # Admin endpoints
│   │   ├── analytics/              # Events & analytics
│   │   └── recommendations/        # Personalized content
│   └── seeders/                    # Database seeders
├── prisma/
│   ├── schema.prisma               # Database schema
│   └── migrations/                 # Database migrations
├── docker-compose.yml
├── .env.example
├── package.json
└── README.md
```

## Database Schema

**Core Models:**
- `User` — Devotees, auth via Google/Apple
- `Device` — Device tracking for multi-device support
- `Ban` — Email + device bans with cascade system

**Content:**
- `Sampraday` — Spiritual traditions
- `Book`, `Chapter`, `Verse` — Scripture hierarchy
- `Narration` — Saint commentaries
- `Mantra` — Public mantras by sampraday
- `Translation` — Multi-language translations

**User Engagement:**
- `Favorite` — Verses, mantras, narrations
- `Follow` — Followed sampradayas
- `ChantLog` — Chanting history

**Real-time:**
- `Group` — Sampraday group chats
- `GroupMember` — Group membership
- `Message` — Group messages with moderation

**AI:**
- `ChatbotSession`, `ChatbotMessage` — GuruDev conversations
- `Citation` — Verse citations in AI responses

**Monitoring:**
- `AuditLog` — Admin actions
- `QueueJob` — Async job tracking

## Key Features

### 1. Multi-Provider AI

Switch between Claude, OpenAI, or Gemini via `AI_PROVIDER` env var:

```typescript
@Inject('AI_PROVIDER')
private aiProvider: IAIProvider;

const response = await this.aiProvider.generateResponse(messages, systemPrompt);
```

### 2. Ban Cascade System

When a user is banned:
1. Email ban → finds all linked devices
2. Device ban → finds all linked emails
3. Creates full audit trail

```typescript
await this.bansService.banEmail(email, reason, adminId);
```

### 3. AI Moderation Pipeline

Every group message flows through:
1. Save as `pending`
2. Queue moderation job
3. AI verdict: safe → `approved`, unsafe → `hidden`
4. Admin can override

### 4. Translation System

Every text field has a `*_key`:
- `nameKey: "sampraday.gaudiya.name"`
- Fetches from `Translation` table per language
- Fallback to English if missing

### 5. Real-time Chat

Socket.IO namespace `/groups`:
- Join/leave group
- Send message (with moderation)
- Typing indicator
- Real-time notifications

### 6. GuruDev Personalization

System detects user's preferred guru based on:
- Followed sampradayas
- Favorite verses
- Chant history
- Adjusts AI persona accordingly

## API Endpoints

All endpoints prefixed with `/api/v1`

### Auth

```
POST   /auth/google          — Google Sign-In
POST   /auth/apple           — Apple Sign-In
POST   /auth/refresh         — Refresh JWT
POST   /auth/logout          — Revoke refresh token
DELETE /auth/account         — Delete account
```

### Content

```
GET    /sampradayas          — List all sampradayas
GET    /sampradayas/:slug    — Sampraday detail
POST   /sampradayas/:id/follow — Follow sampraday

GET    /books                — All books
GET    /books/:slug          — Book detail with chapters
GET    /verses/:id           — Verse with narrations

GET    /mantras              — List mantras
GET    /mantras/:id          — Mantra detail
```

### User

```
GET    /users/me             — Current user profile
PATCH  /users/me             — Update profile
GET    /users/me/stats       — Chant stats, favorites count
```

### Chanting

```
POST   /chanting/log         — Log chants
GET    /chanting/stats       — Daily/weekly/monthly stats
GET    /chanting/history     — Chant history
```

### Groups & Chat

```
GET    /groups/:id           — Group detail
GET    /groups/:id/messages  — Paginated messages
POST   /groups/:id/messages  — Send message

WS     /socket -> /groups    — WebSocket namespace
```

### GuruDev Chatbot

```
GET    /chatbot/sessions     — User's chat history
POST   /chatbot/sessions     — Start new session
GET    /chatbot/sessions/:id — Session with messages
POST   /chatbot/sessions/:id/messages — Send message (SSE stream)
```

### Admin (protected by role)

```
GET    /admin/dashboard      — Stats
POST   /admin/users/:id/ban  — Ban user
GET    /admin/moderation/queue — Hidden messages
POST   /admin/sampradayas    — Create sampraday
...
```

## Jobs & Queues

BullMQ workers process async jobs:

- **moderation** — AI moderation of group messages
- **notifications** — Push notifications (verse of day, group activity)
- **affinity-calculation** — Compute user's guru affinity nightly
- **email** — Transactional emails

```typescript
const job = await this.moderationQueue.add(
  { messageId, content },
  { delay: 100 },
);
```

## Authentication Flow

### Google Sign-In

1. Mobile app calls `google_sign_in` → gets `id_token`
2. POST `/auth/google` with `id_token`
3. Backend verifies token with Google's public keys
4. Create/update User, generate JWT
5. Return `access_token` + `refresh_token`

### Apple Sign-In

Similar, but uses Apple's token verification.

### Refresh Token

1. POST `/auth/refresh` with `refresh_token`
2. Verify token signature
3. Return new `access_token`
4. Tokens stored hashed in DB

## Moderation

Moderation happens in a BullMQ worker:

```typescript
// Message saved as 'pending'
await this.queue.add('moderation', { messageId, content });

// Worker processes
const verdict = await this.aiProvider.moderateMessage(content);

if (verdict.confidence > 0.85) {
  if (verdict.verdict === 'safe') {
    // Approve
  } else {
    // Hide + increment strikes
    if (strikes >= 3) await this.bansService.banEmail(email);
  }
} else {
  // Send to admin queue for manual review
}
```

## Development

### Run tests

```bash
npm run test
npm run test:cov
```

### Lint & format

```bash
npm run lint
npm run format
```

### Database studio (visual DB browser)

```bash
npm run prisma:studio
```

Opens at `http://localhost:5555`

### Generate new migration

```bash
npm run prisma:migrate "add_field_to_user"
```

This creates a migration file you can inspect before applying.

## Deployment

### Environment Variables

Set these on production:
- `DATABASE_URL` (PostgreSQL connection string)
- `REDIS_URL`
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
- `GOOGLE_CLIENT_ID_*`, `APPLE_CLIENT_ID`, etc.
- `ANTHROPIC_API_KEY` (or OpenAI/Gemini keys)
- `FIREBASE_*` (credentials)
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET`
- `SENTRY_DSN`

### Build & Run

```bash
npm run build
npm start
```

### Docker

```bash
docker build -t sanatan-backend .
docker run -p 3000:3000 --env-file .env sanatan-backend
```

## Security Checklist

- [ ] All inputs validated with class-validator
- [ ] Helmet.js for security headers
- [ ] CORS configured for specific origins
- [ ] Rate limiting on auth + AI endpoints
- [ ] Passwords hashed with bcrypt
- [ ] Refresh tokens stored hashed
- [ ] OAuth tokens verified with issuer keys
- [ ] No PII in logs
- [ ] Database backups automated daily
- [ ] Secrets rotated quarterly

## Troubleshooting

**"Cannot connect to database"**
```bash
# Check Docker containers running
docker ps

# Check PostgreSQL logs
docker logs backend-postgres-1

# Recreate containers
docker-compose down && docker-compose up -d
```

**"Prisma client not found"**
```bash
npm run prisma:generate
```

**"Redis connection failed"**
```bash
# Check Redis is running
redis-cli ping
# Output should be: PONG
```

## Contributing

1. Create feature branch: `git checkout -b feature/xyz`
2. Follow NestJS module patterns
3. Add tests for new features
4. Lint & format: `npm run lint && npm run format`
5. Create PR with clear description

## License

Proprietary — HariHariBol Platform
