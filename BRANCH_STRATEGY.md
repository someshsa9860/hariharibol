# Branch Strategy & Workflows

## Branch Structure

```
main      → Production-ready code, no workflows run
  ↓
website   → Website code changes, triggers website Docker build
  ↓
api       → API code changes, triggers API Docker build
```

## Workflow Triggers

### Website Branch Workflow
- **File**: `.github/workflows/build-and-push-ecr.yml`
- **Triggers**: Push to `website` branch with changes in `website/` folder
- **Action**: Builds Docker image and pushes to ECR (`hariharibol-website`)
- **Tags**: `<commit-sha>` and `latest`

### API Branch Workflow
- **File**: `.github/workflows/build-and-push-api-ecr.yml`
- **Triggers**: Push to `api` branch with changes in `api/` or `src/` folder
- **Action**: Builds Docker image and pushes to ECR (`hariharibol-api`)
- **Tags**: `<commit-sha>` and `latest`

## Development Workflow

### For Website Changes

1. **Make changes locally** on `main` branch:
   ```bash
   git checkout main
   # ... make changes to website/
   git add .
   git commit -m "feat: update website"
   ```

2. **Push to main** (no workflow runs):
   ```bash
   git push origin main
   ```

3. **Merge to website branch** to trigger build:
   ```bash
   git checkout website
   git merge main
   git push origin website
   ```

4. **Workflow automatically**:
   - Builds Docker image
   - Pushes to ECR as `hariharibol-website:latest` and `hariharibol-website:<commit-sha>`

### For API Changes

1. **Make changes locally** on `main` branch:
   ```bash
   git checkout main
   # ... make changes to api/ or src/
   git add .
   git commit -m "feat: update API"
   ```

2. **Push to main** (no workflow runs):
   ```bash
   git push origin main
   ```

3. **Merge to api branch** to trigger build:
   ```bash
   git checkout api
   git merge main
   git push origin api
   ```

4. **Workflow automatically**:
   - Builds Docker image
   - Pushes to ECR as `hariharibol-api:latest` and `hariharibol-api:<commit-sha>`

## Benefits

✅ **No unnecessary builds** - Only builds when code actually changes
✅ **Clear separation** - Website and API builds don't interfere
✅ **Easy rollback** - Each commit gets unique tag
✅ **Safe main** - Main branch is stable, no workflows cluttering history
✅ **Parallel workflows** - Website and API can build simultaneously

## ECR Repository Setup

Before pushing to branches, ensure these ECR repositories exist:
- `hariharibol-website`
- `hariharibol-api`

Create them with:
```bash
# Website repo
aws ecr create-repository --repository-name hariharibol-website --region ap-south-1

# API repo
aws ecr create-repository --repository-name hariharibol-api --region ap-south-1
```

## GitHub Requirements

Add this secret to GitHub (Settings → Secrets and variables → Actions):
- `AWS_ROLE_ARN` - Your AWS IAM role ARN with ECR push permissions

## Quick Reference

| Task | Command |
|------|---------|
| Work on website | `git checkout main` → make changes → `git checkout website && git merge main` |
| Work on API | `git checkout main` → make changes → `git checkout api && git merge main` |
| View website workflow | GitHub → Actions → "Build and Push Docker Image to ECR" |
| View API workflow | GitHub → Actions → "Build and Push API Docker Image to ECR" |
| Monitor builds | `gh run list --workflow=build-and-push-ecr.yml` |
| Check ECR images | `aws ecr describe-images --repository-name hariharibol-website --region ap-south-1` |

## Notes

- Commits to `main` never trigger workflows
- Only commits to `website` or `api` branches trigger builds
- Images are tagged with commit SHA and `latest`
- Always merge from `main` to deployment branches to keep them in sync
