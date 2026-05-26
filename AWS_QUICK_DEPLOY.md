# AWS Quick Deploy Checklist

## Before You Start
- [ ] Have AWS account created (TODAY: May 25, 2026)
- [ ] Have .pem key file saved locally
- [ ] Have your domain name ready (yourdomain.com)
- [ ] Have your GitHub repo SSH key configured on local machine

---

## Phase 1: AWS Console Setup (30 mins)

### Account & Billing
- [ ] Complete 5 onboarding tasks → get extra $100 credit
- [ ] Verify credits: AWS Console → Billing → Credits (should show ~$200)

### EC2 Key Pair
- [ ] EC2 Console → Key Pairs → Create
- [ ] Name: `hariharibol-key`
- [ ] Format: `.pem`
- [ ] Download and save securely

### Security Group
- [ ] EC2 Console → Security Groups → Create
- [ ] Name: `hariharibol-sg`
- [ ] Inbound: SSH (22) from your IP, HTTP (80), HTTPS (443) from anywhere

### S3 Bucket
- [ ] S3 Console → Create bucket
- [ ] Name: `hariharibol-backups-[your-name]`
- [ ] Region: `us-east-1`
- [ ] Enable Versioning
- [ ] Enable Lifecycle (delete after 7 days)
- [ ] Note exact bucket name

### IAM User for Backups
- [ ] IAM → Users → Create user
- [ ] Username: `hariharibol-backup`
- [ ] Create access key
- [ ] Attach S3 full access policy
- [ ] Save Access Key ID & Secret Key

---

## Phase 2: Launch EC2 (15 mins)

### Launch Instance
- [ ] EC2 Console → Launch instances
- [ ] AMI: Ubuntu 24.04 LTS
- [ ] Instance type: t3.micro
- [ ] Key pair: hariharibol-key
- [ ] Security group: hariharibol-sg
- [ ] Storage: 30 GB gp3

### After Launch
- [ ] Wait for instance to be "running"
- [ ] Copy Public IPv4 address (e.g., 54.123.45.67)
- [ ] (Optional) Allocate Elastic IP for permanent address

---

## Phase 3: SSH Into Server

```bash
chmod 600 hariharibol-key.pem
ssh -i hariharibol-key.pem ubuntu@YOUR_PUBLIC_IP
```

From here, all commands below run **on the server** (inside SSH session).

---

## Phase 4: Install Software (45 mins)

### Update System
```bash
sudo apt update && sudo apt upgrade -y
```
- [ ] Complete

### Install Node.js
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version
```
- [ ] Complete (should show v20.x.x)

### Install PostgreSQL
```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql

sudo -u postgres psql <<EOF
CREATE DATABASE hariharibol;
CREATE USER hariharibol WITH PASSWORD 'YOUR_DB_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE hariharibol TO hariharibol;
\q
EOF
```
- [ ] Complete
- [ ] Save: DB User = `hariharibol`, DB Password = `YOUR_DB_PASSWORD`

### Install Nginx
```bash
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```
- [ ] Complete

### Install PM2
```bash
sudo npm install -g pm2
pm2 startup
# Run the command it outputs
```
- [ ] Complete

### Install Certbot
```bash
sudo apt install -y certbot python3-certbot-nginx
```
- [ ] Complete

---

## Phase 5: Clone & Deploy Backend (30 mins)

### Clone Repository
```bash
cd /home/ubuntu
git clone https://github.com/YOUR_REPO_URL.git hariharibol
cd hariharibol/backend
```
- [ ] Complete

### Setup .env
```bash
cp .env.example .env
nano .env  # Edit with your values
```

Add to .env:
```
DATABASE_URL=postgresql://hariharibol:YOUR_DB_PASSWORD@localhost:5432/hariharibol
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=YOUR_IAM_ACCESS_KEY
AWS_SECRET_ACCESS_KEY=YOUR_IAM_SECRET_KEY
AWS_S3_BACKUP_BUCKET=hariharibol-backups-[name]
PORT=3001
NODE_ENV=production
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```
- [ ] .env saved

### Build & Run
```bash
npm install
npm run build
npx prisma migrate deploy
pm2 start dist/main.js --name "hariharibol-api"
pm2 save
pm2 logs hariharibol-api
```
- [ ] Installation complete
- [ ] Migrations complete
- [ ] Backend running (check logs for no errors)

---

## Phase 6: Deploy Admin Panel (20 mins)

```bash
cd /home/ubuntu/hariharibol/webapp
cp .env.example .env.local
nano .env.local
```

Add to .env.local:
```
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

```bash
npm install
npm run build
pm2 start "npm run start" --name "hariharibol-admin" --cwd /home/ubuntu/hariharibol/webapp
pm2 save
```
- [ ] Admin running

---

## Phase 7: Deploy Website (20 mins)

```bash
cd /home/ubuntu/hariharibol/website
cp .env.example .env.local
nano .env.local
```

Add to .env.local:
```
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

```bash
npm install
npm run build
pm2 start "npm run start" --name "hariharibol-website" --cwd /home/ubuntu/hariharibol/website
pm2 save
```
- [ ] Website running

---

## Phase 8: Configure Nginx (20 mins)

Replace `yourdomain.com` with your actual domain throughout.

### Backend API Config
```bash
sudo nano /etc/nginx/sites-available/api
```

Paste:
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
- [ ] Saved

### Admin Config
```bash
sudo nano /etc/nginx/sites-available/admin
```

Paste:
```nginx
server {
    listen 80;
    server_name admin.yourdomain.com;
    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
- [ ] Saved

### Website Config
```bash
sudo nano /etc/nginx/sites-available/website
```

Paste:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    location / {
        proxy_pass http://localhost:3003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
- [ ] Saved

### Enable All
```bash
sudo ln -s /etc/nginx/sites-available/api /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/admin /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/website /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```
- [ ] All enabled and Nginx restarted

---

## Phase 9: Setup SSL with Certbot (20 mins)

```bash
sudo certbot --nginx \
  -d api.yourdomain.com \
  -d admin.yourdomain.com \
  -d yourdomain.com \
  -d www.yourdomain.com
```

Follow prompts:
1. Enter email
2. Agree to terms (y)
3. Redirect HTTP to HTTPS (y)

Verify auto-renewal:
```bash
sudo certbot renew --dry-run
```
- [ ] SSL certificates issued
- [ ] Auto-renewal verified

---

## Phase 10: Final Verification (15 mins)

### Check Services
```bash
pm2 status
```
All three apps should show "online" in green.
- [ ] Backend: online
- [ ] Admin: online
- [ ] Website: online

### Check Logs
```bash
pm2 logs
```
Should show startup messages, no errors.
- [ ] No errors in logs

### Test Backend Health
```bash
curl -i https://api.yourdomain.com/health
```
Should return HTTP 200.
- [ ] Backend responding

### Test Backups
```bash
curl -X POST https://api.yourdomain.com/api/v1/admin/backup/trigger \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```
Should return success message.
- [ ] Backup triggered

Check S3:
AWS Console → S3 → Your bucket → Objects
Should see backup files with timestamps.
- [ ] Backup files in S3

---

## Post-Deployment

### Update DNS
Go to your domain registrar and point these subdomains to your EC2 public IP:
- [ ] `api.yourdomain.com` → 54.xxx.xxx.xxx
- [ ] `admin.yourdomain.com` → 54.xxx.xxx.xxx
- [ ] `yourdomain.com` → 54.xxx.xxx.xxx
- [ ] `www.yourdomain.com` → 54.xxx.xxx.xxx

Wait 24 hours for DNS to propagate.

### Daily Monitoring
```bash
# SSH into server daily
ssh -i hariharibol-key.pem ubuntu@YOUR_IP
pm2 status
pm2 logs | head -50
df -h  # Check disk space
```

### Weekly Maintenance
```bash
sudo apt update && sudo apt upgrade -y
```

### Monthly Review
- AWS Console → Billing (check credit usage)
- S3 → Backups (verify files arriving daily)
- PM2 logs (check for any errors)

---

## Useful Commands

```bash
# Status & Logs
pm2 status                      # All app status
pm2 logs APP_NAME               # View logs
pm2 restart APP_NAME            # Restart app
pm2 stop APP_NAME               # Stop app
pm2 start APP_NAME              # Start app

# Database
psql -U hariharibol -d hariharibol -h localhost

# Nginx
sudo nginx -t                   # Test config
sudo systemctl restart nginx    # Restart
sudo tail -f /var/log/nginx/error.log

# System
df -h                           # Disk space
free -h                         # Memory
htop                            # System monitor (install: sudo apt install htop)

# SSL
sudo certbot certificates       # List certificates
sudo certbot renew              # Renew certificates
```

---

## Troubleshooting

**PM2 app shows "stopped"?**
```bash
pm2 logs APP_NAME
# Check output for errors, fix issue, then:
pm2 restart APP_NAME
```

**Nginx 502 Bad Gateway?**
```bash
pm2 status  # Check if backend is running
sudo tail -f /var/log/nginx/error.log  # Check Nginx errors
```

**Database connection error?**
```bash
# Verify DATABASE_URL in .env matches:
# postgresql://hariharibol:YOUR_PASSWORD@localhost:5432/hariharibol
psql -U hariharibol -d hariharibol -h localhost
```

**Backups not running?**
```bash
pm2 logs hariharibol-api | grep -i backup
# Check AWS credentials in .env are correct
# Check S3 bucket exists and IAM user has access
```

**SSL certificate issues?**
```bash
sudo certbot certificates  # List certs
sudo certbot renew        # Force renewal
```

---

## You're Done! 🎉

All three apps are live on AWS:
- **Backend**: https://api.yourdomain.com
- **Admin**: https://admin.yourdomain.com
- **Website**: https://yourdomain.com

**Cost**: $0/month for 6 months (covered by $200 credits)
**After 6 months**: ~$8-12/month (within budget forever)

**Your backups run automatically** at 2 AM & 4:30 PM UTC, saved to S3.
