# HariHariBol Deployment Checklist - Quick Reference

## Pre-Deployment
- [ ] Domain registered and DNS configured
- [ ] GitHub repository access ready
- [ ] AI API keys (Gemini, OpenAI) obtained
- [ ] Firebase credentials ready
- [ ] AWS account with free tier eligibility

## EC2 Setup (30 mins)
```bash
# 1. Launch t3.micro Ubuntu 24.04 on AWS
# 2. Get public IP and update security groups
# 3. SSH access: ssh -i key.pem ubuntu@IP

# 4. Initial system setup
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git build-essential postgresql postgresql-contrib
```

## Install Services (45 mins)
```bash
# Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Nginx
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# PM2
sudo npm install -g pm2
pm2 startup && pm2 save

# SSL
sudo apt install -y certbot python3-certbot-nginx
```

## Database Setup (15 mins)
```bash
sudo -u postgres psql << EOF
CREATE USER hariharibol WITH PASSWORD 'CHANGE_ME_SECURE_PASSWORD';
CREATE DATABASE hariharibol_prod OWNER hariharibol;
ALTER ROLE hariharibol CREATEDB;
\q
EOF
```

## Deploy Backend (30 mins)
```bash
# Clone repo
cd /opt && sudo mkdir hariharibol && sudo chown ubuntu:ubuntu hariharibol
cd hariharibol && git clone YOUR_REPO .

# Setup backend
cd backend
cat > .env << 'EOF'
DATABASE_URL="postgresql://hariharibol:PASSWORD@localhost:5432/hariharibol_prod"
JWT_SECRET="$(openssl rand -base64 32)"
NODE_ENV="production"
API_PORT=3000
STORAGE_TYPE="local"
STORAGE_LOCAL_PATH="/opt/hariharibol/storage"
CORS_ORIGIN="https://your-domain.com,https://api.your-domain.com,https://admin.your-domain.com"
FIREBASE_PROJECT_ID="your-id"
FIREBASE_PRIVATE_KEY="your-key"
FIREBASE_CLIENT_EMAIL="your-email"
GEMINI_API_KEY="your-key"
OPENAI_API_KEY="your-key"
EOF

npm install --production
npm run build
npx prisma migrate deploy

# Start with PM2
pm2 start "npm start" --name "hariharibol-api" --cwd /opt/hariharibol/backend
pm2 save
```

## Deploy Admin Panel (15 mins)
```bash
cd /opt/hariharibol/admin
cat > .env.production << 'EOF'
NEXT_PUBLIC_API_URL="https://api.your-domain.com"
EOF

npm install --production
npm run build
pm2 start "npm start" --name "hariharibol-admin" --cwd /opt/hariharibol/admin
pm2 save
```

## Deploy Website (15 mins)
```bash
cd /opt/hariharibol/website
cat > .env.production << 'EOF'
NEXT_PUBLIC_API_URL="https://api.your-domain.com"
EOF

npm install --production
npm run build
pm2 start "npm start" --name "hariharibol-website" --cwd /opt/hariharibol/website
pm2 save
```

## Nginx Configuration (20 mins)
```bash
# Update your-domain.com in the Nginx config from DEPLOYMENT_GUIDE.md

sudo tee /etc/nginx/sites-available/hariharibol << 'EOF'
[Copy complete Nginx config from DEPLOYMENT_GUIDE.md]
EOF

sudo ln -s /etc/nginx/sites-available/hariharibol /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## SSL Certificates (10 mins)
```bash
# First: Point domain DNS A record to EC2 IP
# Wait 5-10 mins for DNS propagation

sudo certbot certonly --nginx \
  -d your-domain.com \
  -d www.your-domain.com \
  -d api.your-domain.com \
  -d admin.your-domain.com

# Setup auto-renewal
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

## Storage Setup (5 mins)
```bash
mkdir -p /opt/hariharibol/storage/{public,private}
chmod -R 755 /opt/hariharibol/storage
```

## Verification Checklist
- [ ] `curl https://your-domain.com` → Website loads
- [ ] `curl https://api.your-domain.com/health` → Backend responds
- [ ] `curl https://admin.your-domain.com` → Admin panel loads
- [ ] Database migrated: `psql -U hariharibol -d hariharibol_prod`
- [ ] PM2 processes running: `pm2 list`
- [ ] No 502 errors in Nginx: `sudo tail -50 /var/log/nginx/error.log`

## Backup Setup (5 mins)
```bash
cat > /opt/hariharibol/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/hariharibol/backups"
mkdir -p $BACKUP_DIR
pg_dump -U hariharibol hariharibol_prod | gzip > $BACKUP_DIR/db_$(date +%Y%m%d_%H%M%S).sql.gz
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +7 -delete
EOF

chmod +x /opt/hariharibol/backup.sh

# Add to crontab
crontab -e
# Add: 0 2 * * * /opt/hariharibol/backup.sh
```

## Monitoring Commands
```bash
# Real-time logs
pm2 logs

# Specific app
pm2 logs hariharibol-api

# System health
df -h /opt
free -h
ps aux | grep node
```

## Post-Launch
1. Test all functionality (auth, verse of day, admin panel)
2. Monitor logs for 24 hours
3. Verify backups are running
4. Setup monitoring alerts (optional)
5. Document recovery procedures

## Cost Monitoring
- Check EC2 billing dashboard monthly
- Monitor data transfer (target: <1GB/month)
- Use `df -h` to track disk usage
- Expected: $13-15/month if staying in free tier

## Emergency Recovery
```bash
# Restore database from backup
psql -U hariharibol hariharibol_prod < backup.sql.gz

# Restart all services
pm2 restart all

# Check service status
pm2 status
pm2 logs
```

---

**Estimated Total Setup Time: 2-3 hours**
**Cost: $13-15/month (first 12 months free with free tier)**
