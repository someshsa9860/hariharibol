# Backend Quick Start (5 Minutes)

## Prerequisites Installed?

```bash
node --version    # Should be v18+
npm --version     # Should be v8+
docker --version  # For PostgreSQL + Redis
```

If not, install from:
- Node.js: https://nodejs.org
- Docker: https://docker.com/products/docker-desktop

## 1️⃣ Setup (2 minutes)

```bash
cd backend

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

## 2️⃣ Start Services (1 minute)

```bash
# Terminal 1: Start Docker containers (PostgreSQL + Redis)
docker-compose up -d

# Verify running
docker ps
# Should show: postgres, redis, adminer
```

## 3️⃣ Initialize Database (1 minute)

```bash
# Generate Prisma client
npm run prisma:generate

# Create tables
npx prisma migrate dev --name init
```

## 4️⃣ Start Server (1 minute)

```bash
# Terminal 2: Start development server
npm run dev
```

Expected output:
```
✅ Application running on http://localhost:3000
✅ Database connected
```

## ✅ Verify It Works

```bash
# Terminal 3: Test health endpoint
curl http://localhost:3000/health

# Should return:
{
  "statusCode": 200,
  "message": "Success",
  "data": {
    "status": "ok"
  }
}
```

---

## 🎯 What's Running

| Service | URL | Credentials |
|---------|-----|-------------|
| **API** | http://localhost:3000 | None (local dev) |
| **Health Check** | http://localhost:3000/health | Public |
| **Database UI** | http://localhost:8080 | User: `sanatan`, Pass: `sanatan_dev_password` |
| **Prisma Studio** | `npm run prisma:studio` | Local only |
| **Redis** | localhost:6379 | None (local dev) |

---

## 📝 Next Steps

### 1. Set AI Provider (Required for chatbot)

```bash
# Edit .env and add ONE of:

# Option 1: Claude (Recommended)
AI_PROVIDER=claude
ANTHROPIC_API_KEY=sk-ant-xxxxx

# Option 2: OpenAI
AI_PROVIDER=openai
OPENAI_API_KEY=sk-proj-xxxxx

# Option 3: Gemini
AI_PROVIDER=gemini
GEMINI_API_KEY=xxxxx
```

Get API keys from:
- Claude: https://console.anthropic.com
- OpenAI: https://platform.openai.com/api-keys
- Gemini: https://ai.google.dev

### 2. Seed Sample Data

```bash
npm run seed
```

This creates:
- Sample languages
- 5 sampradayas (Gaudiya, Sri, Madhva, etc.)
- Bhagavad Gita verses
- Sample mantras

### 3. Test an API Endpoint

```bash
# Get list of sampradayas
curl "http://localhost:3000/api/v1/sampradayas?lang=en"

# Try with your AI provider setup
curl http://localhost:3000/health
```

---

## 🛠️ Common Commands

```bash
# Development
npm run dev          # Start server with hot-reload
npm run build        # Build for production
npm start            # Run production build

# Database
npm run prisma:studio    # Visual database browser
npm run seed             # Populate sample data
npx prisma migrate dev --name <name>  # Create new migration

# Code Quality
npm run lint         # Check code style
npm run format       # Auto-fix formatting
npm run test         # Run tests

# Docker
docker-compose up -d      # Start containers
docker-compose down       # Stop containers
docker ps                 # See running containers
docker logs -f <container>  # View container logs
```

---

## 🐛 Troubleshooting

### "Cannot connect to database"

```bash
# Check Docker
docker ps | grep postgres

# Start Docker if needed
docker-compose up -d

# Check connection string
echo $DATABASE_URL
```

### "Prisma client not found"

```bash
npm run prisma:generate
```

### "Redis connection failed"

```bash
# Check Redis is running
redis-cli ping
# Should output: PONG

# If not installed via Docker
docker-compose up -d redis
```

### "Port 3000 already in use"

```bash
# Change port in .env
PORT=3001

# Then restart
npm run dev
```

### "Module not found: @infrastructure/..."

```bash
# Ensure all infrastructure modules exist
ls -la src/infrastructure/*/

# If missing, create them:
mkdir -p src/infrastructure/{database,ai,queue,storage,push}
```

---

## 📚 Full Documentation

- **Setup Guide:** `BACKEND_SETUP.md` — Complete walkthrough
- **Architecture:** `README.md` — Design decisions & API overview
- **Implementation** — `BACKEND_IMPLEMENTATION_SUMMARY.md` — What's done & what's next

---

## 🎯 What You Can Do Now

✅ **API calls** to read content (verses, sampradayas, mantras)
✅ **Health monitoring** via `/health` endpoint
✅ **Database browsing** via Adminer or Prisma Studio
✅ **Job queue monitoring** (when jobs queue is ready)
✅ **Multi-provider AI** (once you add an API key)

❌ Not yet implemented:
- Authentication (coming next)
- Real-time chat (coming in Phase 2)
- Admin panel (separate Next.js project)

---

## 🚀 You're Ready!

```
Frontend (Flutter)  ────>  Backend API  ────>  PostgreSQL
                          (NestJS)             (Running)
                              │
                              ├─> Redis Cache
                              ├─> BullMQ Jobs
                              ├─> Firebase Push
                              └─> AI Providers
```

Happy coding! 🙏

Need help? Check `BACKEND_SETUP.md` for detailed troubleshooting.
