# 🚀 HariHariBol Deployment Documentation

## 📚 Complete Deployment Package for $15/month AWS EC2

You have everything you need to deploy HariHariBol on a single server for **$13-15/month**.

---

## 📖 Documentation Files (Read in This Order)

### 1. **[DEPLOYMENT_SUMMARY.md](./DEPLOYMENT_SUMMARY.md)** ← START HERE
**Quick overview of the entire setup** (5 min read)

- Why AWS EC2 is the best choice
- Cost breakdown showing $13-15/month
- Comparison with alternatives (Render, Railway, Linode)
- High-level architecture diagram
- When to upgrade and scale

**👉 Read this first to understand the big picture**

---

### 2. **[HOSTING_ALTERNATIVES.md](./HOSTING_ALTERNATIVES.md)**
**Compare 5+ hosting platforms** (10 min read)

- Detailed cost breakdown for each option
- Pros/cons of each platform
- Setup complexity comparison
- Migration paths between hosts
- Decision tree to pick right option

**👉 Read if you want to compare with Render.com, Linode, Railway, etc.**

---

### 3. **[PRE_DEPLOYMENT.md](./PRE_DEPLOYMENT.md)**
**Prepare everything before starting** (30 min checklist)

- AWS account setup
- API keys and credentials gathering
- Environment variable templates
- Domain preparation
- Security pre-checks
- Local code verification

**👉 Complete this checklist before launching EC2**

---

### 4. **[DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)**
**Step-by-step quick reference** (15 min execute)

- Copy-paste commands for each phase
- Sequential steps to follow
- Verification commands
- Error checking

**👉 Use this as your execution guide (have terminal + this file open)**

---

### 5. **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)**
**Complete detailed guide with explanations** (detailed reference)

- 9 phases of setup with full context
- Why each step matters
- Detailed configurations explained
- Troubleshooting tips
- Monitoring setup
- Backup strategy

**👉 Reference this when you need details about a specific step**

---

### 6. **[DEPLOYMENT_FLOW.md](./DEPLOYMENT_FLOW.md)**
**Visual flowchart and timeline** (5 min visual reference)

- ASCII flowchart of entire process
- Expected timeline for each phase
- Architecture diagram after deployment
- Cost timeline
- One-command summary
- Quality checkpoints

**👉 Reference when you want to visualize the flow**

---

## 🎯 Quick Start (3 Hours to Production)

### For Absolute Beginners
```
1. Read: DEPLOYMENT_SUMMARY.md (understand overview)
2. Read: PRE_DEPLOYMENT.md (gather everything needed)
3. Complete: PRE_DEPLOYMENT checklist (30 mins)
4. Execute: DEPLOYMENT_CHECKLIST.md (2-3 hours)
5. Verify: All tests pass, domains working
6. Reference: DEPLOYMENT_GUIDE.md if stuck
```

### For Experienced DevOps
```
1. Skim: DEPLOYMENT_SUMMARY.md (2 mins)
2. Execute: DEPLOYMENT_CHECKLIST.md (2 hours)
3. Reference: DEPLOYMENT_GUIDE.md as needed
4. Done: Monitor logs and setup alerts
```

### If You Prefer Easier Setup
```
1. Read: HOSTING_ALTERNATIVES.md (choose Render.com)
2. Create Render account
3. Push code to GitHub
4. Create 3 Web Services on Render
5. Done in 1-2 hours!
```

---

## 🏗️ Architecture Overview

```
Single AWS EC2 t3.micro Instance
├─ Backend (NestJS) → port 3000
├─ Admin Panel (Next.js) → port 3001
├─ Website (Next.js) → port 3002
├─ Nginx Reverse Proxy → port 80/443
├─ PostgreSQL Database → port 5432 (local)
├─ PM2 Process Manager
├─ Local File Storage
└─ Daily Backups

Domains:
├─ your-domain.com → Website
├─ api.your-domain.com → Backend
└─ admin.your-domain.com → Admin Panel

SSL: Let's Encrypt (free, auto-renewal)
```

---

## 💰 Cost Summary

### First 12 Months (Free Tier)
```
AWS EC2 t3.micro:  $0 (750 hrs/month)
RDS:               $0 (using local PostgreSQL)
S3:                $0 (using local storage)
Data transfer:     $0 (1GB/month free)
Domain:            ~$1-2
Total:             ~$1-3/month
```

### After Free Tier Expires
```
EC2 t3.micro on-demand:  $6-8/month
Misc charges:            $2-3/month
Domain:                  ~$1-2/month
Total:                   $13-15/month
```

### Ways to Save Money Long-Term
- Use EC2 Reserved Instance (save 40%) → $4/month
- Monitor data transfer (stay <1GB/month)
- Enable EC2 auto-stop for off-hours
- Clean old backups regularly
- Scale up only when needed

---

## ✅ Verification Checklist

After deployment, verify everything works:

```bash
# Website
curl https://your-domain.com
# Should return HTML, no 502 errors

# Backend Health
curl https://api.your-domain.com/health
# Should return API response

# Admin Panel
curl https://admin.your-domain.com
# Should return Next.js admin page

# Check Services Running
pm2 status
# Should show: hariharibol-api, hariharibol-admin, hariharibol-website ONLINE

# Check Database
psql -U hariharibol -d hariharibol_prod -h localhost
# Should connect without errors

# Check Backups
ls -la /opt/hariharibol/backups/
# Should have at least one backup file

# Monitor Logs
pm2 logs
# Should be clean, no error messages
```

---

## 🔧 What You'll Need

### AWS Account Requirements
- [ ] AWS account created
- [ ] Free tier eligible
- [ ] Payment method on file

### Domain Requirements
- [ ] Domain registered
- [ ] Access to DNS settings
- [ ] Plan for 3 subdomains (your-domain.com, api.*, admin.*)

### Credentials
- [ ] Firebase project ID + key
- [ ] Gemini API key
- [ ] OpenAI API key (optional)
- [ ] GitHub SSH key or token

### Local Machine
- [ ] Terminal/SSH client
- [ ] Git installed
- [ ] ~100MB free space
- [ ] Text editor for .env files

### Time
- [ ] 30 mins for preparation
- [ ] 2-3 hours for deployment
- [ ] 30 mins for testing
- **Total: 3-4 hours first time**

---

## 🚀 Getting Started Right Now

### Step 1: Read the Overview (5 mins)
```bash
# Read DEPLOYMENT_SUMMARY.md
cat DEPLOYMENT_SUMMARY.md
```

### Step 2: Complete Pre-Deployment (30 mins)
```bash
# Work through PRE_DEPLOYMENT.md checklist
# Gather all credentials
# Generate JWT secrets
# Prepare .env template
```

### Step 3: Launch EC2
- Go to AWS Console
- EC2 → Launch Instance
- t3.micro, Ubuntu 24.04
- Download .pem key

### Step 4: Execute Deployment (2-3 hours)
```bash
# Use DEPLOYMENT_CHECKLIST.md
# Copy-paste commands from terminal
# Follow step by step
```

### Step 5: Test Everything (30 mins)
```bash
# Run curl commands from verification section
# Check pm2 status
# Monitor logs for errors
```

### Step 6: Celebrate! 🎉
You're now running HariHariBol on production for $13-15/month!

---

## 📊 Complexity Levels

### Easiest (1 hour, limited control)
→ Use **Render.com** instead of EC2
- See HOSTING_ALTERNATIVES.md for Render guide
- Cost: $7-12/month
- Pros: Deploy with `git push`, no server management
- Cons: Less customization

### Medium (2-3 hours, full control)
→ Use **AWS EC2** (recommended)
- Follow DEPLOYMENT_CHECKLIST.md
- Cost: $13-15/month
- Pros: Industry standard, scalable, cheapest long-term
- Cons: Requires basic DevOps knowledge

### Advanced (custom)
→ Docker + ECS, Kubernetes, etc.
- Not recommended for $15 budget
- Cost: $30-100+/month
- For >10,000 users

---

## 🆘 Getting Help

### If you're stuck:

1. **Check the relevant guide**
   - Architecture question? → DEPLOYMENT_SUMMARY.md
   - Step not working? → DEPLOYMENT_GUIDE.md detailed section
   - Quick command needed? → DEPLOYMENT_CHECKLIST.md
   - Visual help? → DEPLOYMENT_FLOW.md

2. **Review project documentation**
   - Architecture: CLAUDE.md
   - Feature docs: FEATURES.md
   - Code structure: existing modules

3. **Check logs**
   - `pm2 logs` - all app logs
   - `pm2 logs hariharibol-api` - specific app
   - `/var/log/nginx/error.log` - web server errors
   - `sudo -u postgres psql` - database test

4. **Common issues**
   - See DEPLOYMENT_GUIDE.md troubleshooting section
   - Check environment variables
   - Verify database connection
   - Test SSL certificate

---

## 📈 Growth Plan

### Now (Month 1)
- Single t3.micro EC2
- ~100-500 users
- Cost: $0-3/month (free tier)

### Later (Month 3-6)
- Same setup still works
- If >500 users → upgrade to t3.small
- Cost: $17/month

### Growing (Year 1)
- Consider RDS PostgreSQL ($15/month)
- Add CloudFront CDN ($5-20/month)
- Still single EC2 with load balancer
- Cost: $40-60/month

### Scaling (Year 2+)
- Multiple EC2 instances ($20-30/month each)
- RDS with failover ($30-50/month)
- CloudFront + S3 ($10-50/month)
- Monitoring + alerts ($10-20/month)
- Cost: $100-200+/month

---

## 🎓 Learning Resources

### If new to these tools:

**Nginx Reverse Proxy**
- [Nginx Beginner's Guide](http://nginx.org/en/docs/beginners_guide.html)
- Check DEPLOYMENT_GUIDE.md section 6

**PM2 Process Manager**
- [PM2 Documentation](https://pm2.keymetrics.io/docs/)
- Check DEPLOYMENT_CHECKLIST.md

**PostgreSQL**
- [PostgreSQL Basics](https://www.postgresql.org/docs/current/index.html)
- Check DEPLOYMENT_GUIDE.md section 2.2

**AWS EC2**
- [AWS EC2 Documentation](https://docs.aws.amazon.com/ec2/)
- Check DEPLOYMENT_GUIDE.md section 1

---

## 📋 File Reference Guide

| File | Purpose | Read Time | When to Use |
|------|---------|-----------|-----------|
| DEPLOYMENT_SUMMARY.md | Overview & cost breakdown | 5 mins | First, understand what you're doing |
| HOSTING_ALTERNATIVES.md | Compare 5+ platforms | 10 mins | If considering alternatives to EC2 |
| PRE_DEPLOYMENT.md | Prep checklist | 30 mins | Before launching EC2 |
| DEPLOYMENT_CHECKLIST.md | Execute guide | 2-3 hrs | During deployment (main guide) |
| DEPLOYMENT_GUIDE.md | Detailed reference | As needed | When you need context about a step |
| DEPLOYMENT_FLOW.md | Visual flowchart | 5 mins | When you want to see the big picture |
| This file | Navigation hub | You're reading it | Reference this to find what you need |

---

## 🎯 Success Criteria

Your deployment is successful when:

✅ EC2 instance running on AWS  
✅ Backend responding at https://api.your-domain.com  
✅ Admin panel accessible at https://admin.your-domain.com  
✅ Website live at https://your-domain.com  
✅ All 3 apps running (pm2 status shows ONLINE)  
✅ Database connected and migrations applied  
✅ Daily backups configured  
✅ SSL certificates valid (https working)  
✅ Costs <$15/month  
✅ Monitoring in place (logs accessible)  

---

## 💡 Pro Tips

1. **Start small** - t3.micro is enough for MVP
2. **Monitor costs** - Check AWS billing weekly first month
3. **Automate backups** - Set cron job day 1
4. **Document procedures** - Write down recovery steps
5. **Keep .env secure** - Never commit to Git
6. **Use SSH keys only** - Disable password auth
7. **Enable MFA on AWS** - Protects your account
8. **Test recovery** - Verify you can restore from backup
9. **Update regularly** - `apt update && apt upgrade` monthly
10. **Monitor logs** - Watch for errors daily first week

---

## 🏁 Ready to Deploy?

### Start Here:

1. **Read DEPLOYMENT_SUMMARY.md** (5 mins)
   - Understand the plan

2. **Complete PRE_DEPLOYMENT.md** (30 mins)
   - Gather all credentials
   - Prepare environment

3. **Follow DEPLOYMENT_CHECKLIST.md** (2-3 hours)
   - Execute step by step
   - Paste commands

4. **Test everything**
   - Run curl commands
   - Check logs
   - Verify functionality

5. **Celebrate! 🎉**
   - HariHariBol is live!

---

**Questions?** Check the relevant documentation file above.

**Ready to start?** Open DEPLOYMENT_SUMMARY.md next!

**Want easier setup?** See HOSTING_ALTERNATIVES.md for Render.com option.

---

**Good luck! You've got this! 🚀**
