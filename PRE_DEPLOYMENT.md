# Pre-Deployment Checklist - Before You Start

Complete these items BEFORE launching your EC2 instance. This ensures smooth deployment.

---

## 🔐 Access & Credentials (30 mins)

### AWS Account
- [ ] Create AWS account (if not already done)
- [ ] Enable free tier (eligible for 12 months)
- [ ] Enable MFA (2FA) for security
- [ ] Create IAM user for EC2 access (don't use root)
- [ ] Download EC2 key pair (.pem file) - **keep it safe**
- [ ] Setup AWS billing alerts (recommended: $30 limit)

### Domain & DNS
- [ ] Domain name registered (GoDaddy, Namecheap, Route53, etc.)
- [ ] Note down domain registrar login
- [ ] You'll need to update DNS A records later

### API Keys & Credentials
- [ ] Firebase project ID
- [ ] Firebase private key (JSON)
- [ ] Gemini API key (from Google Cloud)
- [ ] OpenAI API key (for fallback)
- [ ] SMTP credentials (if using email - optional)

### Repository Access
- [ ] GitHub SSH key generated locally
- [ ] GitHub SSH key added to your account
- [ ] OR GitHub Personal Access Token created
- [ ] Repository URL ready for cloning

---

## 📝 Configuration Files (20 mins)

### Prepare Environment Variables

Create a `.env.template` file locally with:
```env
# Database (will be local on EC2)
DATABASE_URL="postgresql://hariharibol:PASSWORD@localhost:5432/hariharibol_prod"

# JWT secrets (generate with: openssl rand -base64 32)
JWT_SECRET="your-generated-secret-here"
JWT_EXPIRY="15m"
JWT_REFRESH_EXPIRY="7d"

# Node environment
NODE_ENV="production"
LOG_LEVEL="info"

# API Configuration
API_PORT=3000
API_HOST="0.0.0.0"
CORS_ORIGIN="https://your-domain.com,https://api.your-domain.com,https://admin.your-domain.com"

# Storage
STORAGE_TYPE="local"
STORAGE_LOCAL_PATH="/opt/hariharibol/storage"
STORAGE_PUBLIC_URL="https://api.your-domain.com/uploads"

# Firebase/FCM
FIREBASE_PROJECT_ID="your-project-id"
FIREBASE_PRIVATE_KEY="your-key-json"
FIREBASE_CLIENT_EMAIL="your-email@project.iam.gserviceaccount.com"

# AI Providers
GEMINI_API_KEY="your-api-key"
OPENAI_API_KEY="your-api-key"

# Optional: Email (for later)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"

# Optional: Redis (if needed)
REDIS_URL="redis://localhost:6379"
```

### Pre-generate Secrets
```bash
# Generate JWT secret (copy this value into .env above)
openssl rand -base64 32

# Generate another one for refresh token
openssl rand -base64 32

# Generate database password
openssl rand -base64 16
```

### Save Securely
- [ ] Save .env template locally (don't commit to Git)
- [ ] Use password manager to store sensitive credentials
- [ ] Have all values ready to copy-paste during deployment

---

## 🔨 Local Verification (15 mins)

### Backend Setup
- [ ] `cd backend && npm install` - no errors
- [ ] `npm run build` - builds successfully
- [ ] Check `dist/main.js` exists
- [ ] `npx prisma generate` - Prisma client generated

### Admin Panel Setup
- [ ] `cd admin && npm install` - no errors
- [ ] `npm run build` - builds successfully
- [ ] Check `.next` folder exists

### Website Setup
- [ ] `cd website && npm install` - no errors
- [ ] `npm run build` - builds successfully
- [ ] Check `.next` folder exists

### Node Version Check
```bash
node --version  # Should be v18+ (v20 preferred)
npm --version   # Should be 10+
```

---

## 🌐 Domain Preparation (10 mins)

### Before Deployment
- [ ] Domain registered and accessible
- [ ] Access to domain registrar's DNS settings
- [ ] Note down current DNS settings (for reference)
- [ ] Decide on domain structure:
  - `your-domain.com` → Website
  - `api.your-domain.com` → Backend
  - `admin.your-domain.com` → Admin Panel

### After EC2 Launch (you'll do this later)
- [ ] Get EC2 public IP address
- [ ] Create DNS A records pointing to EC2 IP:
  - `your-domain.com A 1.2.3.4` (replace with your IP)
  - `api.your-domain.com A 1.2.3.4`
  - `admin.your-domain.com A 1.2.3.4`
  - `www.your-domain.com CNAME your-domain.com` (optional)
- [ ] Wait 5-10 minutes for DNS propagation
- [ ] Verify: `nslookup your-domain.com` should return your IP

---

## 🔍 Code Verification (20 mins)

### Ensure Code is Production-Ready
```bash
# No console.logs in production code
grep -r "console.log" backend/src --exclude-dir=node_modules

# No hardcoded API keys
grep -r "sk-" backend/src --exclude-dir=node_modules
grep -r "AIza" backend/src --exclude-dir=node_modules

# No uncommitted changes
git status
# Should show: "working tree clean"
```

### Database Verification
```bash
# Check Prisma schema is complete
cat prisma/schema.prisma | head -30

# Verify migrations exist
ls prisma/migrations/

# Check seed file (if using)
ls prisma/seed.ts
```

---

## 📊 Sizing & Capacity Assessment

### Expected Load
- [ ] Estimated concurrent users
- [ ] Estimated daily active users
- [ ] Peak traffic time (e.g., morning/evening)
- [ ] Average API response time target

### t3.micro Capacity
- **Suitable for**: ~100-500 concurrent users, <500 DAU
- **Unsuitable for**: >1,000 DAU, heavy compute (ML inference)
- **Performance**: ~500 API requests/second (under load)

**If you expect >500 DAU from day 1**: Plan to upgrade to t3.small ($17/mo)

---

## 🔒 Security Pre-Check

### Code Security
- [ ] No API keys in `.env.example` (only variables)
- [ ] `.env` added to `.gitignore`
- [ ] No secrets in git history
- [ ] Dependencies updated: `npm audit`
- [ ] CORS origins specified (not `*`)

### Database Security
- [ ] Strong database password generated
- [ ] HTTPS enforced everywhere
- [ ] JWT secrets strong (32+ characters)
- [ ] Rate limiting configured for login endpoints

### Infrastructure Security
- [ ] SSH key protected (file permissions 400)
- [ ] EC2 security group restricted (not 0.0.0.0/0 for SSH)
- [ ] Backup strategy documented
- [ ] Recovery procedure documented

---

## 📱 Mobile App Considerations

### Backend URL Configuration
- [ ] Mobile app configured to call `https://api.your-domain.com`
- [ ] Firebase configuration includes your backend URL
- [ ] CORS allows mobile app domain/protocol
- [ ] OAuth redirect URIs include mobile schemes

### Testing Before Deployment
- [ ] Local mobile testing against localhost
- [ ] Staging testing if possible
- [ ] Production rollout plan (update app version in stores)

---

## 💾 Backup & Recovery Plan

### Document These
- [ ] Database backup location: `/opt/hariharibol/backups/`
- [ ] Backup retention policy: 7 days
- [ ] Restore procedure documented
- [ ] Recovery time objective (RTO): <1 hour
- [ ] Recovery point objective (RPO): <24 hours

### Create Recovery Script
```bash
# Save this for emergency recovery
cat > /tmp/recovery.sh << 'EOF'
#!/bin/bash
# How to restore database from backup
BACKUP_FILE="/opt/hariharibol/backups/db_YYYYMMDD_HHMMSS.sql.gz"
zcat $BACKUP_FILE | psql -U hariharibol hariharibol_prod
EOF
```

---

## 📈 Post-Launch Monitoring

### Plan to Monitor
- [ ] AWS CloudWatch (set billing alerts)
- [ ] PM2 process status
- [ ] Disk usage (`df -h`)
- [ ] Memory usage (`free -h`)
- [ ] Database query performance
- [ ] API response times
- [ ] Error logs (`pm2 logs`)

### Monitoring Tools (Optional)
- [ ] PM2 Plus (advanced monitoring)
- [ ] Grafana (metrics visualization)
- [ ] ELK Stack (log aggregation)
- [ ] New Relic (APM)

---

## ✅ Final Checklist

### Before Day 1 Deployment
- [ ] AWS account with free tier active
- [ ] EC2 key pair downloaded and secured
- [ ] All API keys and credentials gathered
- [ ] Domain registered and accessible
- [ ] Code builds locally without errors
- [ ] Database schema verified
- [ ] Environment variables prepared
- [ ] Backup strategy documented
- [ ] Recovery procedure tested locally
- [ ] Team informed of deployment time
- [ ] Maintenance window scheduled (if needed)

### Ready to Launch?
If all items above are checked ✅, you're ready!

Proceed to: **[DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)**

---

## 🆘 Getting Help

### If You're Stuck
1. Check the relevant section in `DEPLOYMENT_GUIDE.md`
2. Review `HOSTING_ALTERNATIVES.md` (might prefer Render.com instead)
3. Search AWS documentation
4. Check project CLAUDE.md for architecture

### If Something Goes Wrong
1. Check logs: `pm2 logs`
2. Verify environment variables: `cat /opt/hariharibol/backend/.env`
3. Test database: `psql -U hariharibol -d hariharibol_prod`
4. Restart services: `pm2 restart all`

### Time Estimate
- **Preparation**: 1-2 hours (this checklist)
- **EC2 Setup**: 30 minutes
- **Service Installation**: 45 minutes
- **App Deployment**: 1 hour
- **Configuration**: 1 hour
- **Testing**: 30 minutes
- **TOTAL**: 3-5 hours (first time)

---

**You're almost there! Complete this checklist, then follow DEPLOYMENT_CHECKLIST.md 🚀**
