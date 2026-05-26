# AWS EC2 Deployment - Focused Guide

## Your Situation
- **Account Created**: Today (May 25, 2026)
- **Credits**: $200 total (6-month duration until Nov 25, 2026)
- **Goal**: Single t3.micro EC2 server, $15/month budget
- **Apps to Deploy**: Backend (NestJS), Admin Panel (Next.js), Website (Next.js)

---

## Phase 1: AWS Account Setup (30 mins)

### Step 1: Complete AWS Onboarding Tasks
Go to: AWS Console → Free Tier → Onboarding Tasks

Complete all 5 tasks to get extra $100 credit:
```
✓ Launch EC2 instance (just launch, terminate after verification)
✓ Launch RDS instance (just launch, terminate after verification)
✓ Create S3 bucket
✓ Create IAM user
✓ Setup CloudWatch
```

**Verify**: Check AWS Billing → Credits. Should show ~$200 available.

### Step 2: Create EC2 Key Pair
```bash
AWS Console → EC2 → Key Pairs → Create key pair
Name: hariharibol-key
Type: RSA
Format: .pem
```

Save the .pem file securely. You'll need it to SSH into the server.

### Step 3: Create Security Group
```bash
AWS Console → EC2 → Security Groups → Create security group

Name: hariharibol-sg
Inbound Rules:
├─ SSH (22): Your IP only
├─ HTTP (80): 0.0.0.0/0
└─ HTTPS (443): 0.0.0.0/0

Outbound: All traffic (default)
```

This allows HTTP/HTTPS for web traffic, SSH for your admin access.

### Step 4: Create S3 Bucket for Backups
```bash
AWS Console → S3 → Create bucket

Name: hariharibol-backups-[your-name]
Region: us-east-1 (cheapest)
Block public access: ON (keep private)
Versioning: Enable
Lifecycle: Delete after 7 days
```

**Get bucket name exact** — you'll need it in .env.

### Step 5: Create IAM User for Backups
```bash
AWS Console → IAM → Users → Create user

Username: hariharibol-backup
Access type: Programmatic access (CLI/SDK)

Permissions:
├─ Attach policy → AmazonS3FullAccess
└─ OR create custom policy:

{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::hariharibol-backups-*",
        "arn:aws:s3:::hariharibol-backups-*/*"
      ]
    }
  ]
}
```

**Save credentials**:
- Access Key ID
- Secret Access Key

You'll need these in .env.

---

## Phase 2: Launch EC2 Instance (15 mins)

### Step 1: Launch t3.micro Instance
```bash
AWS Console → EC2 → Instances → Launch instances

Name: hariharibol-server
AMI: Ubuntu 24.04 LTS (free tier eligible)
Instance type: t3.micro
Key pair: hariharibol-key
Security group: hariharibol-sg
Storage: 30 GB gp3 (free tier includes 30 GB)
```

### Step 2: Get Public IP
After launch, note your **public IP address** (e.g., 54.123.45.67).

This is your server's address. You'll use it for:
- SSH: ssh -i key.pem ubuntu@54.123.45.67
- Backend API: https://api.yourdomain.com (point to this IP)
- Admin: https://admin.yourdomain.com (point to this IP)
- Website: https://yoursite.com (point to this IP)

### Step 3: Setup Elastic IP (Optional but Recommended)
```bash
AWS Console → EC2 → Elastic IPs → Allocate
Associate with your instance

Why? IP stays same if you restart server
Cost: Free if associated with running instance
```

---

## Phase 3: Server Setup (45 mins)

SSH into your server:
```bash
chmod 600 hariharibol-key.pem
ssh -i hariharibol-key.pem ubuntu@YOUR_PUBLIC_IP
```

### Step 1: Update System
```bash
sudo apt update
sudo apt upgrade -y
```

### Step 2: Install Node.js
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # Should be v20.x.x
npm --version
```

### Step 3: Install PostgreSQL
```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql <<EOF
CREATE DATABASE hariharibol;
CREATE USER hariharibol WITH PASSWORD 'your-secure-password-here';
GRANT ALL PRIVILEGES ON DATABASE hariharibol TO hariharibol;
\q
EOF

# Verify
psql -U hariharibol -d hariharibol -h localhost
# Type: \q to exit
```

**Save credentials**:
- DB Name: hariharibol
- DB User: hariharibol
- DB Password: [what you set above]
- DB Host: localhost
- DB Port: 5432

### Step 4: Install Nginx
```bash
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### Step 5: Install PM2 (Process Manager)
```bash
sudo npm install -g pm2
pm2 startup
# Run the command it outputs to enable PM2 on boot
```

### Step 6: Install certbot for SSL
```bash
sudo apt install -y certbot python3-certbot-nginx
```

---

## Phase 4: Deploy Backend (30 mins)

### Step 1: Clone Repository
```bash
cd /home/ubuntu
git clone https://github.com/YOUR_REPO_URL.git hariharibol
cd hariharibol/backend
```

### Step 2: Setup Backend Environment
```bash
# Copy environment template
cp .env.example .env

# Edit with your values
nano .env
```

Add these environment variables:
```env
# Database
DATABASE_URL=postgresql://hariharibol:your-password@localhost:5432/hariharibol

# Backup (from IAM user credentials)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key-from-iam
AWS_SECRET_ACCESS_KEY=your-secret-key-from-iam
AWS_S3_BACKUP_BUCKET=hariharibol-backups-[your-name]

# API
PORT=3001
NODE_ENV=production

# OAuth (get from Google Console)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Optional: AI providers
GEMINI_API_KEY=your-gemini-key (optional)
OPENAI_API_KEY=your-openai-key (optional)
```

### Step 3: Install Dependencies & Build
```bash
npm install
npm run build
```

### Step 4: Run Database Migrations
```bash
npx prisma migrate deploy
npx prisma db seed  # if you have seeds
```

### Step 5: Start Backend with PM2
```bash
pm2 start dist/main.js --name "hariharibol-api"
pm2 save
pm2 logs hariharibol-api  # Watch logs

# Verify it's running
# Should see startup messages without errors
```

---

## Phase 5: Deploy Admin Panel (20 mins)

### Step 1: Setup Admin
```bash
cd /home/ubuntu/hariharibol/webapp
cp .env.example .env.local
nano .env.local
```

Set:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

### Step 2: Build Admin Panel
```bash
npm install
npm run build
```

### Step 3: Start Admin with PM2
```bash
pm2 start "npm run start" --name "hariharibol-admin" --cwd /home/ubuntu/hariharibol/webapp
pm2 save
```

---

## Phase 6: Deploy Website (20 mins)

### Step 1: Setup Website
```bash
cd /home/ubuntu/hariharibol/website
cp .env.example .env.local
nano .env.local
```

Set:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

### Step 2: Build Website
```bash
npm install
npm run build
```

### Step 3: Start Website with PM2
```bash
pm2 start "npm run start" --name "hariharibol-website" --cwd /home/ubuntu/hariharibol/website
pm2 save
```

---

## Phase 7: Configure Nginx Reverse Proxy (20 mins)

Create three Nginx config files:

### File 1: Backend API
```bash
sudo nano /etc/nginx/sites-available/api
```

Add:
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

### File 2: Admin Panel
```bash
sudo nano /etc/nginx/sites-available/admin
```

Add:
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

### File 3: Website
```bash
sudo nano /etc/nginx/sites-available/website
```

Add:
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

### Enable All Sites
```bash
sudo ln -s /etc/nginx/sites-available/api /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/admin /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/website /etc/nginx/sites-enabled/

sudo nginx -t  # Test config
sudo systemctl restart nginx
```

---

## Phase 8: Setup SSL (20 mins)

Replace yourdomain.com with your actual domain:

```bash
sudo certbot --nginx -d api.yourdomain.com -d admin.yourdomain.com -d yourdomain.com -d www.yourdomain.com
```

Follow the prompts:
1. Enter email
2. Agree to terms
3. Say yes to redirect HTTP → HTTPS

Certbot auto-renews. Verify:
```bash
sudo certbot renew --dry-run
```

---

## Phase 9: Verify Everything (15 mins)

### Check Services Running
```bash
pm2 status  # All 3 apps should be "online"
pm2 logs    # No errors in logs
```

### Test Backend
```bash
curl -i https://api.yourdomain.com/health
# Should return 200 OK
```

### Test Backups
```bash
curl -X POST https://api.yourdomain.com/api/v1/admin/backup/trigger \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
# Should return: "Backup triggered successfully"
```

Check S3:
```bash
AWS Console → S3 → hariharibol-backups-* → Objects
# Should see backup files with timestamps
```

---

## Cost Breakdown (Your Credits Cover This!)

### Months 1-6 (With $200 Credits)
```
t3.micro EC2:     $46.80 (6 months)
S3 backups:       $18 (6 months × $3/month)
Data transfer:    $10-20 (included in free tier mostly)
───────────────────────────
Subtotal:         $64-80
Covered by credits: YES ✅
Your cost:        $0-100 (out of $200)
```

### Months 7-12 (After Credits Expire)
```
t3.micro (on-demand):  $7.68/month
S3 backups:            $3/month
Domain:                ~$1/month
───────────────────────────
Total/month:           $11.68/month
✅ WITHIN $15 BUDGET
```

### Year 2+ (Optimized)
```
t3.micro (1-yr reserved):  $4/month (48% discount)
S3 backups:                $3/month
Domain:                    $1/month
───────────────────────────
Total/month:               $8/month
✅ CHEAPEST POSSIBLE
```

---

## Troubleshooting

### Backend not starting
```bash
pm2 logs hariharibol-api
# Check for database connection errors
# Verify DATABASE_URL in .env
```

### Nginx showing 502 Bad Gateway
```bash
sudo tail -f /var/log/nginx/error.log
# Check if PM2 apps are running: pm2 status
# Ensure ports 3001, 3002, 3003 aren't blocked
```

### Backups not running
```bash
pm2 logs hariharibol-api | grep -i backup
# Check cron job times (2 AM & 4:30 PM UTC)
# Verify AWS credentials in .env
# Verify S3 bucket exists and has write permissions
```

### SSL certificate expired
```bash
sudo certbot renew
# Auto-renewal runs automatically via systemd timer
```

---

## Post-Deployment

### Daily Checks
- `pm2 status` — all apps online
- AWS Console → Billing → Usage — track credit usage
- S3 bucket → verify daily backups arriving

### Weekly Maintenance
- Check logs for errors: `pm2 logs`
- Monitor disk space: `df -h`
- Update security packages: `sudo apt update && sudo apt upgrade -y`

### Monthly Tasks
- Review AWS billing
- Check backup retention (auto-deletes after 7 days)
- Update dependencies: `npm update` in each app

---

## Timeline Summary

| Phase | Task | Time | Total |
|-------|------|------|-------|
| 1 | AWS Setup | 30 min | 30 min |
| 2 | Launch EC2 | 15 min | 45 min |
| 3 | Server Setup | 45 min | 1h 30m |
| 4 | Deploy Backend | 30 min | 2h |
| 5 | Deploy Admin | 20 min | 2h 20m |
| 6 | Deploy Website | 20 min | 2h 40m |
| 7 | Configure Nginx | 20 min | 3h |
| 8 | Setup SSL | 20 min | 3h 20m |
| 9 | Verify | 15 min | 3h 35m |

**Total: ~3.5 hours from empty AWS account to live production** ✅

---

## Your Next Steps

1. **Right Now**: Go to AWS Console, start Phase 1 (account setup)
2. **Complete Onboarding**: Get full $200 credits
3. **Launch EC2**: Follow Phase 2
4. **SSH In**: Execute Phases 3-9
5. **Deploy**: Get all three apps running
6. **Monitor**: Watch PM2 logs for errors
7. **Go Live**: Update your domain DNS to point to EC2 IP

**Your $200 credits cover everything for 6 months.** After that, ~$8/month keeps it running indefinitely. ✅

---

**Questions during deployment?** Each phase has specific bash commands. Just run them in order on your EC2 server and you'll be live in 3.5 hours.
