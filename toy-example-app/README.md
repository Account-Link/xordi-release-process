# Xordi Release Checklist

**Purpose:** Prescriptive release process ensuring transparency and attestation for every Xordi deployment.

**Key Principle:** A deployment is NOT complete until transparency logging is verified.

---

## Pre-Release Checklist

### 1. Code Preparation

- [ ] All changes committed to `tokscope-xordi-perf` branch
- [ ] Record the commit SHA: `____________________________________________`
- [ ] Verify CI passes (if configured)
- [ ] No secrets in source code (use appropriate KMS for secrets)

### 2. Docker Image Build

- [ ] Build image with SHA tag:
  ```bash
  export SHA=$(git rev-parse --short HEAD)
  docker build -t yourorg/xordi:$SHA .
  docker tag yourorg/xordi:$SHA yourorg/xordi:latest
  ```

- [ ] Push to DockerHub:
  ```bash
  docker push yourorg/xordi:$SHA
  docker push yourorg/xordi:latest
  ```

- [ ] Record image digest: `____________________________________________`

### 3. Pre-Deployment Verification

- [ ] Verify `docker-compose.yml` uses correct image tag
- [ ] Verify KMS configuration is correct
- [ ] Verify no sensitive environment variables are hardcoded

---

## Deployment Checklist

### 4. Deploy to Phala Cloud

**CRITICAL: Use Base on-chain KMS for transparency logging**

```bash
# Option A: New deployment
phala cvms create \
  --name xordi-prod \
  --compose docker-compose.yml \
  --vcpu 4 \
  --memory 8192 \
  --env-file .env.encrypted

# Option B: Upgrade existing deployment
phala cvms upgrade \
  --app-id 8b7f9f28fde9764b483ac987c68f3321cb7276b0 \
  --compose docker-compose.yml
```

- [ ] Deployment command executed successfully
- [ ] Record CVM ID: `____________________________________________`
- [ ] Record App ID: `____________________________________________`

### 5. Post-Deployment Health Check

- [ ] Service is responding: `curl https://api-a.jordi.io/health`
- [ ] Basic functionality verified (test QR code generation)
- [ ] No error logs in initial 5 minutes

---

## Transparency Verification (MANDATORY)

**A deployment is NOT complete until these steps are verified.**

### 6. Trust Center Verification

- [ ] Visit Trust Center: https://trust.phala.com/app/{APP_ID}
- [ ] Verification status shows "Completed"
- [ ] All 30 data objects verified (App, KMS, Gateway)
- [ ] Attestation timestamp is after deployment time

### 7. On-Chain Transparency Log (REQUIRED)

**This is the critical step that ensures transparency.**

- [ ] **If using Base KMS:** Verify upgrade event on Base blockchain
  ```bash
  # Query the KMS contract for recent events
  cast logs --address 0x... --from-block latest
  ```

- [ ] **If using Pha KMS:** ⚠️ STOP - Switch to Base KMS before proceeding
  - Pha KMS does NOT publish events publicly
  - Deployment without transparency logging is NOT acceptable

### 8. Document the Chain of Trust

Record the following in the release notes:

| Item | Value |
|------|-------|
| Git Commit SHA | |
| Docker Image Tag | |
| Docker Image Digest | |
| App ID | |
| CVM ID | |
| Trust Center URL | |
| On-Chain TX Hash | |
| Deployment Timestamp | |

---

## Post-Release Checklist

### 9. Update Documentation

- [ ] Update VERIFICATION-REPORT.md with new attestation data
- [ ] Create GitHub Release with attestation proof attached
- [ ] Update any public documentation

### 10. Notify Stakeholders

- [ ] Post in #flashbots-x-core with:
  - Commit SHA
  - Trust Center link
  - On-chain verification link (if applicable)

---

## Emergency Rollback Procedure

If issues are discovered after deployment:

1. **Do NOT panic-deploy** - this creates unverified code
2. Revert to previous known-good commit
3. Follow full release checklist (including transparency steps)
4. Document the incident

---

## Quick Reference Commands

### Check Current Deployment
```bash
phala cvms info --app-id 8b7f9f28fde9764b483ac987c68f3321cb7276b0
```

### Get Attestation
```bash
phala cvms attestation --app-id 8b7f9f28fde9764b483ac987c68f3321cb7276b0
```

### Verify Quote
```bash
curl -X POST https://cloud-api.phala.network/api/v1/attestations/verify \
  -H "Content-Type: application/json" \
  -d '{"hex": "QUOTE_HEX"}'
```

---

## Why This Process Matters

From Andrew Miller (Dec 30, 2025):

> "my fear has happened, which is that, because we didn't have a release process prescriptively, Ian just never released it in a way where we're generating evidence"

> "It is about making a transparency log, which we're just not making right now"

**Without this checklist:**
- Deployments happen without transparency logging
- No evidence of what code is running
- Cannot prove non-custodial access to users

**With this checklist:**
- Every deployment creates an on-chain record
- Users can verify upgrade history
- Evidence exists that code matches published source

---

## Checklist Version History

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-05 | 1.0 | Initial release checklist |
