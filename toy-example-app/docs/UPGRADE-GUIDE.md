# Upgrade Guide

This guide explains how to release a new version of the toy example enclave and deploy it to Phala Cloud.

## Prerequisites

- Git access to the repository
- Push access to `feat/toy-example-app` branch
- GitHub Actions secrets configured (for CI deployment)

## Version Upgrade Process

### Step 1: Make Your Changes

1. Create a feature branch from `feat/toy-example-app`:
   ```bash
   git checkout feat/toy-example-app
   git pull origin feat/toy-example-app
   git checkout -b feat/toy-example-app/my-feature
   ```

2. Make your code changes in `toy-example-app/enclave/src/`

3. Test locally if possible:
   ```bash
   cd toy-example-app/enclave
   npm install
   npm run build
   npm start
   ```

### Step 2: Bump the Version

Use the version bump script to update all version references:

```bash
# For bug fixes (1.0.0 -> 1.0.1)
./toy-example-app/scripts/bump-version.sh patch

# For new features (1.0.0 -> 1.1.0)
./toy-example-app/scripts/bump-version.sh minor

# For breaking changes (1.0.0 -> 2.0.0)
./toy-example-app/scripts/bump-version.sh major
```

The script will:
- Update `enclave/package.json`
- Update `enclave/src/version.ts`
- Create a git commit
- Create a git tag (e.g., `v1.1.0`)

### Step 3: Push to Trigger Deployment

Push your changes and the tag to trigger automatic deployment:

```bash
git push origin feat/toy-example-app --tags
```

This will:
1. Build new Docker images with the version tag
2. Run security verification
3. Deploy to both **prod7** and **prod9** simultaneously
4. Log compose hashes on-chain via Base KMS
5. Update `DEPLOYMENTS.md` automatically

### Step 4: Verify Deployment

After deployment completes (~5-10 minutes), verify both instances:

```bash
# Compare instances to prove same code is running
./toy-example-app/scripts/compare-instances.sh \
  https://toy-example-prod9.phala.network \
  https://toy-example-prod7.phala.network
```

Check the `/version` endpoint on each instance:
```bash
curl https://toy-example-prod9.phala.network:8080/version
curl https://toy-example-prod7.phala.network:8080/version
```

Expected output:
```json
{
  "version": "1.1.0",
  "gitSha": "abc123...",
  "gitShaShort": "abc123",
  "buildTime": "2026-01-28T03:00:00Z",
  "environment": "production",
  "composeHash": "def456..."
}
```

## What Changes During an Upgrade

### Files That Change

| File | What Changes |
|------|--------------|
| `enclave/package.json` | `version` field |
| `enclave/src/version.ts` | `VERSION` constant |
| `enclave/docker-compose.yml` | `image:` tag (by CI) |
| `DEPLOYMENTS.md` | New entry added (by CI) |

### Hashes That Change

| Hash | When It Changes |
|------|-----------------|
| Git SHA | Every commit |
| Docker Image Digest | Every build (content-addressable) |
| Compose Hash | When docker-compose.yml changes (includes image tag) |
| On-Chain TX | New transaction for each deployment |

### What Stays the Same

- **MR_ENCLAVE**: Changes only if the base image or build process changes
- **MR_SIGNER**: Never changes (same signing authority)
- **App ID**: Remains constant for the application

## Manual Deployment

If you need to deploy manually (e.g., to a single cluster or for testing):

```bash
# Trigger manual deployment via GitHub Actions
gh workflow run toy-deploy.yml \
  -f image_tag=abc1234 \
  -f environment=staging \
  -f cluster=prod9
```

Or use the Phala CLI directly:
```bash
cd toy-example-app/enclave
phala deploy -c docker-compose.yml -n toy-example-staging --kms base
```

## Rollback

To rollback to a previous version:

1. Find the previous version tag:
   ```bash
   git tag -l 'v*' --sort=-v:refname | head -5
   ```

2. Check out and push that tag:
   ```bash
   git checkout v1.0.0
   git push origin v1.0.0 --force-with-lease
   ```

   Or trigger a manual deployment with the old image tag.

## Troubleshooting

### Build Failed

Check the GitHub Actions logs:
```bash
gh run list --workflow=toy-build.yml
gh run view <run-id> --log
```

### Deployment Failed

1. Check if secrets are configured in GitHub
2. Verify Phala Cloud API key is valid
3. Check cluster availability

### Version Mismatch

If `/version` shows wrong version:
1. Verify the Docker image tag matches the commit
2. Check if the deployment actually completed
3. Verify the correct cluster was deployed to

## Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design
- [MULTI-MACHINE.md](./MULTI-MACHINE.md) - Multi-machine deployment
- [VERIFICATION.md](./VERIFICATION.md) - Attestation verification
- [../DEPLOYMENTS.md](../DEPLOYMENTS.md) - Deployment history
