# HariHariBol Deployment Flow - Visual Guide

## 📍 Complete Journey: From Zero to Production ($15/month)

```
START HERE
    │
    ├─→ PRE_DEPLOYMENT.md ────────┐
    │   • Gather credentials      │
    │   • Prepare .env files      │ 30 mins
    │   • Verify code locally     │
    │   • Plan domain setup       │
    │                             │
    └────────────────────────────→└─────────────────────┐
                                                          │
    AWS SETUP                                            │
    ┌──────────────────────────────────────────────────→│
    │                                                    │
    ├─→ 1. Launch EC2 Instance                          │
    │       • t3.micro (1 vCPU, 1GB RAM)               │
    │       • Ubuntu 24.04 LTS                         │
    │       • 20GB storage                             │ 30 mins
    │       • Download .pem key                        │
    │       • Note public IP                           │
    │                                                    │
    ├─→ 2. SSH Into Instance                            │
    │       • ssh -i key.pem ubuntu@IP                │
    │       • Update system                           │
    │       • Install build tools                      │
    │                                                    │
    └────────────────────────────────────────────────→┐
                                                       │
    INSTALL SERVICES (PHASE 2-5)                      │
    ┌──────────────────────────────────────────────────→└─┐
    │                                                    │
    ├─→ Node.js v20+ ──────────────────────────────────┤ 45
    │   curl -fsSL | bash ; apt install nodejs        │ mins
    │                                                  │
    ├─→ PostgreSQL 16 ─────────────────────────────────┤
    │   apt install postgresql ; systemctl start       │
    │   Create user & database                        │
    │                                                  │
    ├─→ Nginx ─────────────────────────────────────────┤
    │   apt install nginx ; systemctl start            │
    │                                                  │
    ├─→ PM2 (Process Manager) ─────────────────────────┤
    │   npm install -g pm2 ; pm2 startup              │
    │                                                  │
    ├─→ Certbot (SSL) ─────────────────────────────────┤
    │   apt install certbot python3-certbot-nginx     │
    │                                                  │
    └────────────────────────────────────────────────→┐
                                                      │
    DEPLOY APPS (PHASE 3-5)                         │
    ┌──────────────────────────────────────────────────→└─┐
    │                                                  │
    ├─→ Backend Deployment ────────────────────────────┤ 90
    │   • Clone repo: git clone                       │ mins
    │   • Create .env (database, JWT, etc)            │
    │   • npm install --production                   │
    │   • npm run build                               │
    │   • npx prisma migrate deploy                   │
    │   • pm2 start "npm start"                       │
    │   • Running on port 3000                        │
    │                                                  │
    ├─→ Admin Panel Deployment ────────────────────────┤
    │   • cd admin                                    │
    │   • npm install --production                   │
    │   • npm run build                               │
    │   • pm2 start "npm start"                       │
    │   • Running on port 3001                        │
    │                                                  │
    ├─→ Website Deployment ────────────────────────────┤
    │   • cd website                                  │
    │   • npm install --production                   │
    │   • npm run build                               │
    │   • pm2 start "npm start"                       │
    │   • Running on port 3002                        │
    │                                                  │
    └────────────────────────────────────────────────→┐
                                                      │
    NGINX CONFIGURATION (PHASE 6)                   │
    ┌──────────────────────────────────────────────────→└─┐
    │                                                  │
    ├─→ Create Nginx Config                          │ 30
    │   • 3 upstream blocks (backend, admin, web)    │ mins
    │   • HTTP redirect to HTTPS                     │
    │   • Domain routing (3 server blocks)            │
    │   • Test: nginx -t                             │
    │                                                  │
    └────────────────────────────────────────────────→┐
                                                      │
    DNS & SSL SETUP                                  │
    ┌──────────────────────────────────────────────────→└─┐
    │                                                  │
    ├─→ Update Domain DNS (At Registrar)             │ 15
    │   • A your-domain.com → EC2-IP                │ mins
    │   • A api.your-domain.com → EC2-IP            │
    │   • A admin.your-domain.com → EC2-IP          │
    │   • Wait 5-10 mins for propagation            │
    │                                                  │
    ├─→ Generate SSL Certificates                    │ 10
    │   • certbot certonly --nginx                   │ mins
    │   • Auto-renewal enabled                       │
    │   • HTTPS working                              │
    │                                                  │
    └────────────────────────────────────────────────→┐
                                                      │
    STORAGE & BACKUPS (PHASE 7-8)                  │
    ┌──────────────────────────────────────────────────→└─┐
    │                                                  │
    ├─→ Local Storage Setup                          │ 15
    │   • mkdir /opt/hariharibol/storage             │ mins
    │   • chmod 755 for Nginx access                 │
    │   • Configure upload paths                     │
    │                                                  │
    ├─→ Backup Automation                            │
    │   • Create backup.sh script                    │
    │   • Cron job: daily at 2 AM                    │
    │   • 7-day retention policy                     │
    │                                                  │
    └────────────────────────────────────────────────→┐
                                                      │
    VERIFICATION & MONITORING                       │
    ┌──────────────────────────────────────────────────→└─┐
    │                                                  │
    ├─→ Test All Services                            │ 20
    │   • curl https://your-domain.com ✓             │ mins
    │   • curl https://api.your-domain.com/health ✓ │
    │   • curl https://admin.your-domain.com ✓       │
    │   • pm2 status (all 3 running) ✓               │
    │   • psql test database ✓                       │
    │                                                  │
    ├─→ Monitor Logs                                 │
    │   • pm2 logs (watch for errors)                │
    │   • sudo tail -50 /var/log/nginx/error.log     │
    │   • Check for database connection issues       │
    │                                                  │
    └────────────────────────────────────────────────→┐
                                                      │
    PRODUCTION READY! 🎉                            │
    ┌──────────────────────────────────────────────────→└─┐
    │                                                  │
    ├─→ Final Checks                                 │
    │   ✅ All 3 apps running (pm2 list)             │
    │   ✅ SSL certificates valid                    │
    │   ✅ Database connected                        │
    │   ✅ Backups configured                        │
    │   ✅ Monitoring in place                       │
    │   ✅ Costs <$15/month                          │
    │                                                  │
    └────────────────────────────────────────────────→ DONE!

Timeline: ~2-3 hours total
```

---

## 🔄 Architecture After Deployment

```
┌─────────────────────────────────────────────────────────┐
│                    Users/Internet                        │
└────────────────────┬────────────────────────────────────┘
                     │
                ┌────▼─────┐
                │   DNS    │
                │           │
                └────┬─────┘
          ┌─────────┼─────────┐
          │         │         │
    ┌─────▼──┐ ┌───▼────┐ ┌─▼──────┐
    │ your-  │ │ api.   │ │ admin. │
    │domain  │ │domain  │ │domain  │
    └─────┬──┘ └───┬────┘ └─┬──────┘
          │        │        │
          └────────┼────────┘
                   │
         ┌─────────▼──────────┐
         │   AWS EC2 t3.micro  │
         │  (Single Instance)  │
         ├────────────────────┤
         │                    │
         │  ┌─ Nginx ─────────┼── Port 80/443
         │  │  (Reverse Proxy)│
         │  │                 │
         │  ├─ Port 3000 ◄────┼─ Backend (NestJS)
         │  │  (API)          │
         │  │                 │
         │  ├─ Port 3001 ◄────┼─ Admin Panel
         │  │  (Next.js)      │
         │  │                 │
         │  ├─ Port 3002 ◄────┼─ Website
         │  │  (Next.js)      │
         │  │                 │
         │  └─ PM2 ──────────►│ Process Manager
         │                 │
         │  ┌─ PostgreSQL ────┼── Database (Port 5432)
         │  │  (Local)        │
         │  │                 │
         │  ├─ /opt/.../     │
         │  │  storage        │ File Storage
         │  │                 │
         │  └─ /opt/...      │
         │     backups        │ Daily Backups
         │                    │
         └────────────────────┘
```

---

## 📊 Cost Over Time

```
Month 1-12: FREE TIER
├─ EC2: $0 (750 hrs/month)
├─ RDS: $0 (using local PostgreSQL)
├─ Data: $0 (1GB/month free)
└─ Total: ~$0-2/month (domain + taxes)

Month 13+: PAID
├─ EC2 on-demand: ~$8/month
│  (or $4 with reserved instance)
├─ Misc: ~$2-3
└─ Total: $13-15/month

Year 2 with 3-year reserve:
└─ Cost: ~$8/month (80% off)

Growth (>500 users):
├─ Upgrade EC2: +$10/month
├─ Add RDS: +$15/month
├─ Add CDN: +$5-20/month
└─ Total: $40-60/month
```

---

## 🚀 One-Command Summary

If you want to see the full deployment at a glance:

```bash
# Phase 1: AWS Setup
# → Launch EC2 t3.micro (Ubuntu 24.04)
# → Download .pem key

# Phase 2: System Setup
sudo apt update && sudo apt upgrade -y && \
sudo apt install -y nodejs postgresql nginx certbot && \
sudo npm install -g pm2

# Phase 3: PostgreSQL Setup
sudo systemctl start postgresql && \
sudo -u postgres psql << EOF
CREATE USER hariharibol WITH PASSWORD 'secure_pw';
CREATE DATABASE hariharibol_prod OWNER hariharibol;
EOF

# Phase 4: Deploy Apps
cd /opt/hariharibol && \
git clone YOUR_REPO . && \
for dir in backend admin website; do
  cd $dir && npm install --production && npm run build
  pm2 start "npm start" --name "hariharibol-$dir"
  cd ..
done

# Phase 5: Nginx + SSL
# → Configure Nginx (copy from DEPLOYMENT_GUIDE.md)
# → Run certbot for SSL
# → systemctl restart nginx

# Phase 6: Backups
# → Setup cron job for daily backups

# Done! Now monitoring, testing, and celebration 🎉
```

---

## ✅ Quality Checkpoints

| Point | What to Verify | How |
|-------|---|---|
| **After EC2 Launch** | Instance running, SSH works | `ssh -i key.pem ubuntu@IP` |
| **After Services Install** | Node, PostgreSQL, Nginx up | `node --version`, `psql`, `nginx -t` |
| **After App Deploy** | All 3 apps running | `pm2 list` shows 3 online |
| **After Nginx Config** | Ports accessible | `curl localhost:3000` etc |
| **After SSL Setup** | HTTPS works | `curl https://your-domain.com` |
| **Final** | All endpoints live | `curl` all 3 domains |

---

## 🎯 Expected Timeline

| Phase | Duration | Cumulative |
|-------|----------|-----------|
| Pre-deployment prep | 1-2 hrs | 1-2 hrs |
| EC2 launch | 30 mins | 2-2.5 hrs |
| Service installation | 45 mins | 2.75-3 hrs |
| App deployment | 1 hr | 3.75-4 hrs |
| Nginx config | 20 mins | 4-4.3 hrs |
| SSL setup | 15 mins | 4.25-4.5 hrs |
| Storage/Backups | 15 mins | 4.4-5 hrs |
| Testing | 30 mins | 5-5.5 hrs |
| **Total** | **~5 hrs** | |

---

## 🎓 Learning Path (If New to DevOps)

**Beginner? Consider Render.com instead:**
- Easier: Push code, auto-deploys
- No servers to manage
- 1-2 hour setup
- Cost: $7-12/month

**Want to learn DevOps?**
- Start with AWS EC2 guide
- Learn about reverse proxies (Nginx)
- Understand process managers (PM2)
- Master backups and monitoring
- Skills transferable to any job

---

## 🆘 If Something Goes Wrong

```
Problem: Can't SSH
→ Check: Key permissions (chmod 400 key.pem), security group

Problem: Apps won't start
→ Check: pm2 logs, npm install ran, npm build succeeded

Problem: 502 Bad Gateway
→ Check: pm2 status, nginx -t, firewall rules

Problem: Database error
→ Check: .env DATABASE_URL, PostgreSQL running, credentials

Problem: SSL error
→ Check: Domain DNS A record, certbot status, port 80 open
```

---

## 📚 Documentation After Deployment

Keep these files accessible:

```
/opt/hariharibol/
├─ DEPLOYMENT_GUIDE.md      ← Full reference
├─ DEPLOYMENT_CHECKLIST.md  ← Quick steps
├─ backup.sh               ← Backup script
├─ backups/                ← Daily backups
└─ storage/                ← File storage
  ├─ public/               ← Public files
  └─ private/              ← Private files
```

---

**You've got this! Start with PRE_DEPLOYMENT.md → DEPLOYMENT_CHECKLIST.md → Live! 🚀**
