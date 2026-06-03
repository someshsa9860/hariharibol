# Hariharibol Website Deployment Guide

This guide explains how to deploy the Hariharibol website to AWS using GitHub Actions.

## Architecture

- **Platform**: AWS EC2 (ap-south-1 region)
- **Instance**: hariharibol_aws (ec2-13-206-188-46.ap-south-1.compute.amazonaws.com)
- **OS**: Ubuntu 22.04 LTS
- **Container**: Docker
- **Port**: 3000
- **CI/CD**: GitHub Actions

## Prerequisites

1. **GitHub Repository Access**
   - Push access to the repository
   - GitHub Actions enabled

2. **AWS Access**
   - EC2 instance running with public IP
   - SSH access configured
   - Docker installed on EC2

3. **Secrets Configuration** (in GitHub Settings → Secrets and variables → Actions)

## GitHub Actions Workflows

### Option 1: SSH-based Deployment (Recommended for quick setup)

**File**: `.github/workflows/deploy-website-ssh.yml`

**Triggers**: 
- Pushes to `main` branch with changes in `website/` directory
- Manual trigger via `workflow_dispatch`

**Setup Steps**:

1. **Create GitHub Secret for AWS Private Key**:
   ```bash
   # Copy your AWS private key
   cat ~/.ssh/hariharibol.pem
   ```

2. **Add to GitHub**:
   - Go to Settings → Secrets and variables → Actions
   - New repository secret
   - Name: `AWS_PRIVATE_KEY`
   - Value: (paste the contents of hariharibol.pem)

3. **Update the workflow** (if needed):
   - Replace `YOUR_USERNAME` in the REPO_URL
   - Verify AWS instance IP is correct

### Option 2: ECR-based Deployment (Advanced)

**File**: `.github/workflows/deploy-website.yml`

Requires:
- AWS ECR repository
- IAM role with proper permissions
- OIDC provider configured

## Deployment Process

### Automatic Deployment (SSH Method)

1. **Push to main**:
   ```bash
   git add .
   git commit -m "Deploy: update website"
   git push origin main
   ```

2. **GitHub Actions will**:
   - Clone the repository on AWS
   - Install dependencies
   - Build the Next.js application
   - Build Docker image
   - Run container with automatic restart
   - Perform health checks

3. **Access the website**:
   ```
   http://ec2-13-206-188-46.ap-south-1.compute.amazonaws.com:3000
   ```

### Manual Deployment (if needed)

SSH into the instance:
```bash
ssh -i ~/.ssh/hariharibol.pem ubuntu@ec2-13-206-188-46.ap-south-1.compute.amazonaws.com
```

Then run deployment script:
```bash
cd /opt/hariharibol/website

# Install dependencies
npm ci

# Build application
npm run build

# Build Docker image
sudo docker build -t hariharibol-website:latest .

# Stop old container
sudo docker stop hariharibol-web || true

# Run new container
sudo docker run -d \
  --name hariharibol-web \
  --restart always \
  -p 3000:3000 \
  -e NODE_ENV=production \
  hariharibol-website:latest
```

## Docker Commands

### View logs
```bash
ssh -i ~/.ssh/hariharibol.pem ubuntu@ec2-13-206-188-46.ap-south-1.compute.amazonaws.com \
  'docker logs -f hariharibol-web'
```

### Check container status
```bash
ssh -i ~/.ssh/hariharibol.pem ubuntu@ec2-13-206-188-46.ap-south-1.compute.amazonaws.com \
  'docker ps | grep hariharibol-web'
```

### Restart container
```bash
ssh -i ~/.ssh/hariharibol.pem ubuntu@ec2-13-206-188-46.ap-south-1.compute.amazonaws.com \
  'docker restart hariharibol-web'
```

### Stop container
```bash
ssh -i ~/.ssh/hariharibol.pem ubuntu@ec2-13-206-188-46.ap-south-1.compute.amazonaws.com \
  'docker stop hariharibol-web'
```

### View recent commits deployed
```bash
ssh -i ~/.ssh/hariharibol.pem ubuntu@ec2-13-206-188-46.ap-south-1.compute.amazonaws.com \
  'cd /opt/hariharibol && git log -1 --oneline'
```

## Environment Variables

The Docker container uses these environment variables:
- `NODE_ENV=production` - Production mode
- `NEXT_TELEMETRY_DISABLED=1` - Disable Next.js telemetry

## Monitoring

### Check deployment status
- Visit Actions tab in GitHub
- Look for "Deploy Website to AWS (SSH)" workflow
- Check the logs for any errors

### Website health
- Homepage: http://ec2-13-206-188-46.ap-south-1.compute.amazonaws.com:3000/home
- Books: http://ec2-13-206-188-46.ap-south-1.compute.amazonaws.com:3000/books
- API: Health check endpoint (built into Docker healthcheck)

## Troubleshooting

### Container won't start
```bash
ssh -i ~/.ssh/hariharibol.pem ubuntu@ec2-13-206-188-46.ap-south-1.compute.amazonaws.com \
  'docker logs hariharibol-web'
```

### Port already in use
```bash
ssh -i ~/.ssh/hariharibol.pem ubuntu@ec2-13-206-188-46.ap-south-1.compute.amazonaws.com \
  'sudo lsof -i :3000'
```

### Out of disk space
```bash
ssh -i ~/.ssh/hariharibol.pem ubuntu@ec2-13-206-188-46.ap-south-1.compute.amazonaws.com \
  'df -h'
```

### Clean up old images
```bash
ssh -i ~/.ssh/hariharibol.pem ubuntu@ec2-13-206-188-46.ap-south-1.compute.amazonaws.com \
  'sudo docker image prune -a'
```

## Dockerfile

Located at: `website/Dockerfile`

- **Base image**: node:20-alpine
- **Multi-stage build**: Reduces final image size
- **Health check**: Included for Docker orchestration
- **Non-root user**: nodejs user for security

## Deployment Timeline

Typical deployment takes:
- Repository clone: ~30 seconds
- Dependencies install: ~1-2 minutes
- Build: ~2-3 minutes
- Docker build: ~1-2 minutes
- Container startup: ~10 seconds
- **Total**: ~5-10 minutes

## Security Best Practices

1. **Rotate SSH keys regularly**
   - Update `AWS_PRIVATE_KEY` secret when rotating keys

2. **Limit repository access**
   - Only allow deployment from protected main branch

3. **Monitor deployments**
   - Check GitHub Actions logs
   - Review AWS instance security groups

4. **Keep dependencies updated**
   - Run `npm audit` before deploying
   - Update base Docker image regularly

## Next Steps

1. Add the GitHub secret `AWS_PRIVATE_KEY`
2. Push a change to main branch
3. Monitor the GitHub Actions workflow
4. Verify website is running at the URL above
5. Set up domain name (optional)
6. Configure SSL/HTTPS (optional)

## Contact & Support

For deployment issues:
1. Check GitHub Actions logs
2. SSH into the instance and check Docker logs
3. Review this deployment guide
4. Contact DevOps team if needed

---

**Last Updated**: 2026-05-26
**Website Version**: Production
**Repository**: Hariharibol
