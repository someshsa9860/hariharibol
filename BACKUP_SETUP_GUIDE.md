# Database Backup Setup Guide - S3 Automated Backup Cron Jobs

## 📋 Overview

Your HariHariBol backend now has automated database backups that run on a daily schedule:
- **Nightly backup**: 2:00 AM every day
- **Afternoon backup**: 4:30 PM every day

Both backups are automatically uploaded to AWS S3 with:
- Automatic compression (gzip)
- Encryption at rest
- 7-day retention (old backups deleted automatically)
- Failed backup notifications

---

## 🔧 Environment Configuration

Add these variables to your `.env` file:

```bash
# AWS S3 Backup Configuration
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_REGION=us-east-1
AWS_S3_BACKUP_BUCKET=hariharibol-backups

# Optional: Database URL (if using custom connection string)
# DATABASE_URL=postgresql://user:password@host:5432/database
```

### Getting AWS Credentials

If you don't have AWS credentials yet, here's how to set them up:

#### 1. Create IAM User for Backups (Least Privilege)

```bash
# In AWS Console:
1. Go to IAM → Users → Add user
2. Name: "hariharibol-backup"
3. Permissions:
   - Attach policy: AmazonS3FullAccess
   - OR create custom policy (recommended for security):
```

**Custom S3 Policy for Least Privilege:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket",
        "s3:GetBucketVersioning"
      ],
      "Resource": "arn:aws:s3:::hariharibol-backups"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:PutObjectAcl",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::hariharibol-backups/*"
    }
  ]
}
```

#### 2. Create S3 Bucket

```bash
# In AWS Console → S3:
1. Create bucket: "hariharibol-backups"
2. Region: Choose closest to your EC2
3. Settings:
   - Block all public access: YES
   - Enable versioning: YES (for recovery)
   - Enable server-side encryption: YES
   - Lifecycle: Auto-delete after 30 days (optional)
```

Or via AWS CLI:
```bash
aws s3api create-bucket \
  --bucket hariharibol-backups \
  --region us-east-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket hariharibol-backups \
  --versioning-configuration Status=Enabled

# Block public access
aws s3api put-public-access-block \
  --bucket hariharibol-backups \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

#### 3. Generate Access Keys

```bash
# In AWS Console → IAM → Users → hariharibol-backup:
1. Security credentials tab
2. Create access key
3. Copy: Access Key ID and Secret Access Key
4. Add to .env file (KEEP SECURE!)
```

---

## 📍 Backup Schedule

### Nightly Backup
- **Time**: 2:00 AM UTC (adjust for your timezone)
- **Frequency**: Every day
- **S3 Path**: `s3://hariharibol-backups/database-backups/nightly/YYYY-MM-DD/`
- **Compression**: gzip (reduces size ~90%)
- **Encryption**: AES-256

### Afternoon Backup
- **Time**: 4:30 PM UTC (adjust for your timezone)
- **Frequency**: Every day
- **S3 Path**: `s3://hariharibol-backups/database-backups/afternoon/YYYY-MM-DD/`
- **Compression**: gzip
- **Encryption**: AES-256

### Timezone Adjustment

The cron times above are in UTC. To adjust for your timezone:

**Current Schedule (UTC):**
- Nightly: 2:00 AM UTC
- Afternoon: 4:30 PM UTC

**Example adjustments:**
- EST (UTC-5): 9:00 PM + 11:30 AM
- IST (UTC+5:30): 7:30 AM + 9:30 PM
- PST (UTC-8): 6:00 PM + 8:30 AM

**To change schedule**, edit `backup.service.ts`:

```typescript
// Change 2 AM to your desired time
@Cron(CronExpression.EVERY_DAY_AT_2AM)
async nightlyBackup(): Promise<void> { ... }

// Change 4:30 PM (16:30) to your time
@Cron('30 16 * * *')
async afternoonBackup(): Promise<void> { ... }

// Cron format: minute hour day month weekday
// Examples:
// '0 2 * * *'    = 2:00 AM daily
// '30 16 * * *'  = 4:30 PM daily
// '0 0 * * 0'    = Sunday midnight
```

---

## 🎯 API Endpoints

### 1. Trigger Manual Backup

```bash
POST /api/v1/admin/backup/trigger
Authorization: Bearer <jwt-token>

Response:
{
  "success": true,
  "message": "manual backup completed successfully"
}
```

### 2. Get Backup Status

```bash
GET /api/v1/admin/backup/status
Authorization: Bearer <jwt-token>

Response:
{
  "lastNightlyBackup": "2026-05-25T02:00:00.000Z",
  "lastAfternoonBackup": "2026-05-25T16:30:00.000Z",
  "totalBackups": 45
}
```

---

## 📊 Backup Structure in S3

```
s3://hariharibol-backups/
└── database-backups/
    ├── nightly/
    │   ├── 2026-05-25/
    │   │   └── hariharibol-db-nightly-2026-05-25.sql.gz (50-200 MB)
    │   ├── 2026-05-26/
    │   │   └── hariharibol-db-nightly-2026-05-26.sql.gz
    │   └── ... (last 7 days)
    └── afternoon/
        ├── 2026-05-25/
        │   └── hariharibol-db-afternoon-2026-05-25.sql.gz
        ├── 2026-05-26/
        │   └── hariharibol-db-afternoon-2026-05-26.sql.gz
        └── ... (last 7 days)
```

---

## 💾 Backup Details

### File Format
- **Compression**: Gzip (.sql.gz)
- **Size**: ~50-200 MB (depending on data)
- **Reduction**: 90% smaller than raw SQL
- **Time**: ~1-5 minutes per backup

### Metadata Stored in S3
- `backup-type`: "database"
- `backup-date`: ISO timestamp
- `file-size`: Size in bytes
- Tags for easy filtering and cost analysis

### Retention Policy
- **Keep for**: 7 days (automatically)
- **Auto-cleanup**: Old backups deleted automatically
- **Manual management**: Can override in S3 lifecycle

---

## 🔄 Restore Backup

### From S3 to PostgreSQL

```bash
# 1. Download backup from S3
aws s3 cp s3://hariharibol-backups/database-backups/nightly/2026-05-25/hariharibol-db-nightly-2026-05-25.sql.gz ./backup.sql.gz

# 2. Decompress
gunzip backup.sql.gz

# 3. Restore to database
psql -U hariharibol -d hariharibol_prod < backup.sql

# 4. Verify
psql -U hariharibol -d hariharibol_prod -c "SELECT COUNT(*) FROM users;"
```

### Restore to New Database

```bash
# 1. Create new database
psql -U postgres -c "CREATE DATABASE hariharibol_recovery;"

# 2. Restore backup
psql -U hariharibol -d hariharibol_recovery < backup.sql

# 3. Test recovery
psql -U hariharibol -d hariharibol_recovery -c "SELECT VERSION();"

# 4. When verified, swap names (or keep as recovery copy)
```

---

## 🚨 Monitoring & Alerts

### Check Backup Logs

```bash
# SSH into EC2
ssh -i key.pem ubuntu@your-ec2-ip

# View backup logs
pm2 logs hariharibol-api | grep -i backup

# Or use journalctl (if available)
journalctl -u hariharibol-api -g backup
```

### Expected Log Output

```
[SUCCESS] Starting nightly database backup...
[SUCCESS] Backup file created: hariharibol-db-nightly-2026-05-25.sql.gz (125.3 MB)
[SUCCESS] Backup uploaded to S3: s3://hariharibol-backups/database-backups/nightly/2026-05-25/hariharibol-db-nightly-2026-05-25.sql.gz
[SUCCESS] Nightly backup completed successfully
```

### Setup CloudWatch Alarms (Optional)

To get email alerts if backup fails:

```bash
# In AWS Console → CloudWatch → Alarms → Create alarm
1. Select metric: S3 PutObject count
2. Condition: If count < 1 in 1 hour
3. Action: Send SNS email notification
```

---

## ✅ Post-Deploy Verification

After deploying with BackupModule, verify setup:

### 1. Check Service Started

```bash
# SSH into EC2
ssh -i key.pem ubuntu@your-ec2-ip

# Check service status
pm2 logs hariharibol-api | grep -i "backup"

# Should see: "Starting nightly database backup..."
```

### 2. Manual Trigger Test

```bash
# From your admin panel or curl:
curl -X POST http://localhost:3000/api/v1/admin/backup/trigger \
  -H "Authorization: Bearer <your-jwt-token>"

# Should get response:
# {
#   "success": true,
#   "message": "manual backup completed successfully"
# }
```

### 3. Check S3 Bucket

```bash
# List backups in S3
aws s3 ls s3://hariharibol-backups/database-backups/

# Should see:
# 2026-05-25 12:34:56            0 nightly/
# 2026-05-25 15:45:23            0 afternoon/
```

### 4. Check Status Endpoint

```bash
curl http://localhost:3000/api/v1/admin/backup/status \
  -H "Authorization: Bearer <your-jwt-token>"

# Should show:
# {
#   "lastNightlyBackup": "2026-05-25T02:00:00.000Z",
#   "lastAfternoonBackup": "2026-05-25T16:30:00.000Z",
#   "totalBackups": 2
# }
```

---

## 📋 Backup Deployment Checklist

- [ ] Created IAM user "hariharibol-backup"
- [ ] Created S3 bucket "hariharibol-backups"
- [ ] Generated AWS access keys
- [ ] Added AWS credentials to .env:
  - [ ] AWS_ACCESS_KEY_ID
  - [ ] AWS_SECRET_ACCESS_KEY
  - [ ] AWS_REGION
  - [ ] AWS_S3_BACKUP_BUCKET
- [ ] Rebuilt backend: `npm run build`
- [ ] Restarted API: `pm2 restart hariharibol-api`
- [ ] Verified backup logs: `pm2 logs hariharibol-api`
- [ ] Tested manual backup via API
- [ ] Checked S3 bucket for backup files
- [ ] Tested restore procedure with sample backup
- [ ] Configured CloudWatch alarms (optional)
- [ ] Documented backup recovery procedure

---

## 🆘 Troubleshooting

### Issue: "DATABASE_URL environment variable is not set"
```
Fix: Add DATABASE_URL to .env file
DATABASE_URL=postgresql://user:password@host:5432/database
```

### Issue: "Access Denied" when uploading to S3
```
Fix: 
1. Check AWS credentials are correct in .env
2. Verify IAM user has S3 permissions
3. Check S3 bucket exists and is accessible
4. Verify bucket name matches AWS_S3_BACKUP_BUCKET
```

### Issue: Backup is taking too long
```
Cause: Large database or slow network
Fix:
1. Check S3 upload speed: aws s3 ls
2. Optimize database (indexes, cleanup)
3. Use multipart upload (for >100MB files)
```

### Issue: Backup fails silently (no logs)
```
Fix:
1. Check pm2 logs: pm2 logs hariharibol-api
2. Verify pg_dump is installed: which pg_dump
3. Check disk space: df -h
4. Test PostgreSQL connection manually:
   psql $DATABASE_URL -c "SELECT 1;"
```

---

## 💡 Production Best Practices

1. **Encrypt S3 Bucket**
   ```bash
   aws s3api put-bucket-encryption \
     --bucket hariharibol-backups \
     --server-side-encryption-configuration Rules=[{ApplyServerSideEncryptionByDefault={SSEAlgorithm=AES256}}]
   ```

2. **Enable Versioning**
   ```bash
   aws s3api put-bucket-versioning \
     --bucket hariharibol-backups \
     --versioning-configuration Status=Enabled
   ```

3. **Set Lifecycle Policy**
   ```bash
   # Auto-delete backups older than 30 days
   aws s3api put-bucket-lifecycle-configuration \
     --bucket hariharibol-backups \
     --lifecycle-configuration file://lifecycle.json
   ```

4. **Monitor Backup Cost**
   - Typical: $0.023 per GB stored
   - Example: 100 backups × 150 MB = 15 GB = ~$0.35/month

5. **Test Restore Regularly**
   - Monthly: Download and restore a backup
   - Verify data integrity
   - Document recovery time

---

## 📞 Support

For issues or questions:
1. Check logs: `pm2 logs hariharibol-api`
2. Review this guide's troubleshooting section
3. Check AWS S3 bucket directly: `aws s3 ls s3://hariharibol-backups/`
4. Verify .env configuration
5. Test PostgreSQL connection separately

---

**Backups are now automated! Your database is protected.** ✅
