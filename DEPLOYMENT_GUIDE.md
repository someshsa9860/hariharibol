# HariHariBol Single-Server Deployment Guide ($15/month AWS Setup)

## 🎯 Budget Breakdown ($15/month)

| Service | Cost | Details |
|---------|------|---------|
| **AWS EC2** | $6-8 | t3.micro (1 vCPU, 1GB RAM) or t4g.micro |
| **RDS PostgreSQL** | $0 | Use local PostgreSQL on EC2 instead |
| **S3 Storage** | $0 | Use local storage + backups to S3 monthly |
| **Elastic IP** | $0 | Optional (dynamic IP fine for testing) |
| **Data Transfer** | ~$2 | Free tier: 1GB/month included, then $0.09/GB |
| **Domain + Backup** | $3-5 | Domain registration elsewhere, manage backups locally |
| **Buffer** | $2 | Miscellaneous/overages |

**Total: ~$13-15/month**

---

## 🏗️ Architecture Overview

```
Single EC2 Instance (t3.micro or t4g.micro)
│
├─ PostgreSQL Database (local)
├─ NestJS Backend (port 3000)
├─ Next.js Admin Panel (port 3001)
├─ Static Website (port 80/443)
├─ Nginx Reverse Proxy (port 80/443)
├─ PM2 Process Manager
└─ SSL Certificates (Let's Encrypt)
```

### Key Optimization Decisions

✅ **No RDS** - Use local PostgreSQL to save $20+/month
✅ **No S3 for serving files** - Use Nginx + local storage
✅ **No Separate Containers** - Use PM2 for process management
✅ **No Load Balancers** - Nginx handles routing
✅ **No CloudFront** - Direct Nginx caching
✅ **Minimal Instance** - t3.micro sufficient for ~100 concurrent users

---

## 📋 Step-by-Step Setup

### Phase 1: EC2 Instance Setup

#### 1.1 Launch EC2 Instance

```bash
# AWS Console: EC2 → Launch Instance
# Configuration:
- AMI: Ubuntu 24.04 LTS (t3.micro or t4g.micro)
- Instance Type: t3.micro (1 vCPU, 1GB RAM) ← FREE TIER
- Storage: 20GB gp3 (sufficient for data + app code)
- Security Group: 
  * SSH: 0.0.0.0/0 (from your IP only in production)
  * HTTP: 0.0.0.0/0
  * HTTPS: 0.0.0.0/0
  * Custom: 5432 (PostgreSQL, restricted)
```

#### 1.2 Connect & Update System

```bash
# SSH into instance
ssh -i your-key.pem ubuntu@YOUR_EC2_IP

# Update system
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git build-essential

# Set timezone
sudo timedatectl set-timezone UTC
```

### Phase 2: Install Core Services

#### 2.1 Install Node.js & npm

```bash
# Using NodeSource repository (latest stable)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version  # v20.x
npm --version   # 10.x
```

#### 2.2 Install PostgreSQL

```bash
# Install PostgreSQL 16
sudo apt install -y postgresql postgresql-contrib

# Start and enable service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql << EOF
CREATE USER hariharibol WITH PASSWORD 'secure_password_here';
CREATE DATABASE hariharibol_prod OWNER hariharibol;
ALTER ROLE hariharibol CREATEDB;
\q
EOF

# Verify connection
psql -U hariharibol -d hariharibol_prod -h localhost
```

#### 2.3 Install Nginx

```bash
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Remove default config
sudo rm /etc/nginx/sites-enabled/default
```

#### 2.4 Install Certbot (SSL)

```bash
sudo apt install -y certbot python3-certbot-nginx
# Will use later after domain setup
```

#### 2.5 Install PM2 (Process Manager)

```bash
sudo npm install -g pm2
pm2 startup
pm2 save

# This ensures apps restart on server reboot
```

### Phase 3: Deploy Backend

#### 3.1 Clone Repository

```bash
cd /opt  # Use /opt for application directory
sudo mkdir -p /opt/hariharibol
sudo chown ubuntu:ubuntu /opt/hariharibol
cd /opt/hariharibol

# Clone your repo (use deployment key or HTTPS token)
git clone https://your-repo-url.git .
cd backend
```

#### 3.2 Setup Environment Variables

```bash
# Create .env file
cat > .env << 'EOF'
# Database
DATABASE_URL="postgresql://hariharibol:secure_password_here@localhost:5432/hariharibol_prod"

# JWT
JWT_SECRET="generate-a-random-string-here"
JWT_EXPIRY="15m"
JWT_REFRESH_EXPIRY="7d"

# Node Environment
NODE_ENV="production"
LOG_LEVEL="info"

# API Configuration
API_PORT=3000
API_HOST="0.0.0.0"
CORS_ORIGIN="https://your-domain.com,https://admin.your-domain.com,https://app.your-domain.com"

# Storage (Local)
STORAGE_TYPE="local"
STORAGE_LOCAL_PATH="/opt/hariharibol/storage"
STORAGE_PUBLIC_URL="https://api.your-domain.com/uploads"

# Firebase/FCM (keep existing config)
FIREBASE_PROJECT_ID="your-project-id"
FIREBASE_PRIVATE_KEY="..."
FIREBASE_CLIENT_EMAIL="..."

# AI Providers
GEMINI_API_KEY="your-key"
OPENAI_API_KEY="your-key"

# Email (optional for now)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"

# Redis (optional - use if you have extra capacity)
REDIS_URL="redis://localhost:6379"
EOF

chmod 600 .env
```

#### 3.3 Install Dependencies & Build

```bash
cd /opt/hariharibol/backend

npm install --production
npm run build

# Run Prisma migrations
npx prisma migrate deploy

# Optional: Seed database
npx prisma db seed
```

#### 3.4 Start Backend with PM2

```bash
# Start backend
pm2 start "npm start" --name "hariharibol-api" --cwd /opt/hariharibol/backend

# Verify
pm2 list
pm2 logs hariharibol-api

# Save PM2 state
pm2 save
```

### Phase 4: Deploy Admin Panel (Next.js)

#### 4.1 Setup Admin Panel

```bash
cd /opt/hariharibol/admin
npm install --production

# Create .env.production
cat > .env.production << 'EOF'
NEXT_PUBLIC_API_URL="https://api.your-domain.com"
NEXT_PUBLIC_APP_NAME="HariHariBol"
EOF

# Build
npm run build
```

#### 4.2 Start Admin with PM2

```bash
pm2 start "npm start" --name "hariharibol-admin" --cwd /opt/hariharibol/admin

# Verify
pm2 logs hariharibol-admin
```

### Phase 5: Deploy Website (Static/Next.js)

#### 5.1 Setup Website

```bash
cd /opt/hariharibol/website
npm install --production

# Create .env.production
cat > .env.production << 'EOF'
NEXT_PUBLIC_API_URL="https://api.your-domain.com"
EOF

npm run build
```

#### 5.2 Start Website with PM2

```bash
pm2 start "npm start" --name "hariharibol-website" --cwd /opt/hariharibol/website

# OR if static site, use Nginx directly (see below)
```

### Phase 6: Nginx Configuration

#### 6.1 Create Nginx Config

```bash
sudo tee /etc/nginx/sites-available/hariharibol << 'EOF'
# Upstream backends
upstream backend {
    server 127.0.0.1:3000;
}

upstream admin_panel {
    server 127.0.0.1:3001;
}

upstream website {
    server 127.0.0.1:3002;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name your-domain.com *.your-domain.com;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# Main domain → Website
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    client_max_body_size 50M;

    location / {
        proxy_pass http://website;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://website;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}

# api.domain.com → Backend
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    client_max_body_size 50M;

    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # API caching (optional)
    location ~* ^/api/v1/verses/of-day$ {
        proxy_pass http://backend;
        expires 1h;
        add_header Cache-Control "public";
    }
}

# admin.domain.com → Admin Panel
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name admin.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    client_max_body_size 50M;

    location / {
        proxy_pass http://admin_panel;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Enable config
sudo ln -s /etc/nginx/sites-available/hariharibol /etc/nginx/sites-enabled/

# Test Nginx config
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

#### 6.2 Setup SSL with Let's Encrypt

```bash
# First, point your domain to the EC2 public IP in DNS

# Get SSL certificate
sudo certbot certonly --nginx -d your-domain.com -d www.your-domain.com -d api.your-domain.com -d admin.your-domain.com

# Auto-renewal
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# Verify renewal
sudo certbot renew --dry-run
```

### Phase 7: Storage Setup

#### 7.1 Setup Local Storage

```bash
# Create storage directories
sudo mkdir -p /opt/hariharibol/storage/public
sudo mkdir -p /opt/hariharibol/storage/private
sudo chown -R ubuntu:ubuntu /opt/hariharibol/storage
chmod -R 755 /opt/hariharibol/storage

# Symlink to public directory (Nginx will serve)
sudo mkdir -p /var/www/uploads
sudo ln -s /opt/hariharibol/storage/public /var/www/uploads/public

# Nginx config for uploads
sudo tee -a /etc/nginx/sites-available/hariharibol << 'EOF'

# Serve uploads from API domain
server {
    listen 443 ssl http2;
    server_name api.your-domain.com;
    
    location /uploads {
        alias /opt/hariharibol/storage/public;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
EOF

sudo nginx -t && sudo systemctl restart nginx
```

### Phase 8: Monitoring & Maintenance

#### 8.1 Setup Log Monitoring

```bash
# View real-time logs
pm2 logs

# Specific app logs
pm2 logs hariharibol-api
pm2 logs hariharibol-admin

# System logs
tail -f /var/log/nginx/error.log
tail -f /var/log/postgresql/postgresql.log
```

#### 8.2 Backup Strategy

```bash
# Create backup script
cat > /opt/hariharibol/backup.sh << 'EOF'
#!/bin/bash

BACKUP_DIR="/opt/hariharibol/backups"
DB_NAME="hariharibol_prod"
BACKUP_DATE=$(date +"%Y%m%d_%H%M%S")

mkdir -p $BACKUP_DIR

# Database backup
pg_dump -U hariharibol $DB_NAME | gzip > $BACKUP_DIR/db_$BACKUP_DATE.sql.gz

# Storage backup (optional - sync to S3)
# aws s3 sync /opt/hariharibol/storage s3://your-bucket/backups/$BACKUP_DATE/ --delete

# Keep only last 7 days
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR/db_$BACKUP_DATE.sql.gz"
EOF

chmod +x /opt/hariharibol/backup.sh

# Run daily at 2 AM
crontab -e
# Add: 0 2 * * * /opt/hariharibol/backup.sh
```

#### 8.3 Performance Monitoring

```bash
# Monitor disk usage
df -h /opt
du -sh /opt/hariharibol

# Monitor memory/CPU
free -h
top -b -n 1 | head -20

# Monitor database
sudo -u postgres psql hariharibol_prod -c "SELECT datname, pg_size_pretty(pg_database_size(datname)) FROM pg_database;"
```

### Phase 9: Production Checklist

- [ ] Domain DNS pointing to EC2 IP
- [ ] SSL certificates installed and auto-renewal enabled
- [ ] PostgreSQL credentials secured in .env
- [ ] PM2 processes configured to restart on reboot
- [ ] Nginx reverse proxy routing all services correctly
- [ ] Backup script running daily
- [ ] Environment variables set for production
- [ ] Database migrations completed
- [ ] Firebase/AI keys configured
- [ ] Rate limiting enabled on sensitive endpoints
- [ ] CORS properly configured for your domains
- [ ] File upload size limits set
- [ ] Nginx gzip compression enabled

---

## 💾 Upgrade Path (When You Grow)

| Metric | Current ($15) | Next Step | Cost |
|--------|---------------|-----------|------|
| **Users** | ~100-500 concurrent | 1,000+ concurrent | t3.small ($20) |
| **Database** | PostgreSQL on EC2 | RDS PostgreSQL | +$15 |
| **Static Assets** | Nginx caching | CloudFront CDN | +$10-50 |
| **Storage** | Local 20GB | S3 + CloudFront | +$5-20 |
| **Monitoring** | PM2 logs | CloudWatch | +$2-5 |

---

## 🚨 Cost Optimization Tips

1. **Use t3/t4g.micro** - Eligible for free tier for 12 months
2. **Reserved Instances** - Save 40% if committing to 1 year
3. **Local Storage** - Avoid S3 charges entirely
4. **Compress Assets** - Gzip in Nginx reduces bandwidth
5. **Cache Aggressively** - Nginx caching reduces database hits
6. **Monitor Data Transfer** - Stay under 1GB/month free tier
7. **No Unused Services** - Kill anything not needed

---

## 🔐 Security Checklist

- [ ] SSH key-based auth only (no passwords)
- [ ] Security group restricted to necessary ports
- [ ] Fail2ban for SSH brute-force protection
- [ ] Database password in .env (not in code)
- [ ] API keys for AI services in .env
- [ ] HTTPS everywhere with valid SSL
- [ ] Regular security updates (`apt update && apt upgrade`)
- [ ] Backup encryption (if using S3)
- [ ] Database backups with encryption

---

## 📞 Troubleshooting

### Backend won't start
```bash
pm2 logs hariharibol-api
# Check: Node version, npm modules, .env file, database connection
```

### Nginx 502 Bad Gateway
```bash
sudo nginx -t
pm2 status
# Check if backend/admin/website processes are running
```

### Database connection error
```bash
sudo -u postgres psql -U hariharibol -d hariharibol_prod -h localhost
# Verify credentials in .env
```

### SSL certificate issues
```bash
sudo certbot status
sudo certbot renew --dry-run
# Check domain DNS A record points to EC2 IP
```

### Out of disk space
```bash
df -h
du -sh /opt/hariharibol
# Clean old backups or increase storage
```

---

## 🎯 Next Steps

1. **Launch EC2** (t3.micro, Ubuntu 24.04)
2. **Install Services** (Node, PostgreSQL, Nginx)
3. **Deploy Backend** (PM2 + database migrations)
4. **Deploy Admin/Website** (PM2 process management)
5. **Configure Nginx** (Reverse proxy + SSL)
6. **Setup Backups** (Daily cron job)
7. **Monitor & Scale** (Watch costs, upgrade when needed)

---

**Total Setup Time: 2-4 hours | Monthly Cost: $13-15 | Capacity: 100-500 concurrent users**
