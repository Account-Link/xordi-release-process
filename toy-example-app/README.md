# Toy Example App

**Branch:** `feat/toy-example-app`

A simplified dstack application demonstrating the complete TEE release process end-to-end. This branch implements a toy example that proves an enclave can receive full API credentials but only access safe endpoints - with hardware attestation and on-chain transparency logging as evidence.

## Purpose

This toy app demonstrates:
- **Selective API access**: Enclave receives credentials for both safe and sensitive endpoints, but code only calls safe endpoints
- **Hardware attestation**: Intel TDX proves exactly what code is running
- **On-chain transparency**: Every deployment logged to Base blockchain via KMS
- **Verifiable builds**: Docker images tagged with commit SHA for reproducibility

---

## Release Checklist

**Purpose:** Prescriptive release process ensuring transparency and attestation for every deployment.

**Key Principle:** A deployment is NOT complete until transparency logging is verified.

---

### Pre-Release Checklist

#### 1. Code Preparation

- [x] All changes committed to `feat/toy-example-app` branch
- [x] Record the commit SHA: `8736a98a6a8d8c4162b8cc981b73a4e138497069`
- [x] Verify CI passes
- [x] No secrets in source code (secrets injected via Phala Cloud)

#### 2. Docker Image Build

- [x] Build image with SHA tag (automated via GitHub Actions)
- [x] Push to GHCR: `ghcr.io/account-link/toy-example-enclave:8736a98`
- [x] Record image digest: `sha256:73f9eaae5374cc9d86de57e160ae1c777224f4e841d8de25cdb3bc2ab09043d7`

#### 3. Pre-Deployment Verification

- [x] Verify `docker-compose.yml` uses correct image tag
- [x] Verify KMS configuration is Base (not Pha)
- [x] Verify no sensitive environment variables are hardcoded

---

### Deployment Checklist

#### 4. Deploy to Phala Cloud

**CRITICAL: Using Base on-chain KMS for transparency logging**

- [x] Deployment command executed successfully
- [x] Record CVM ID: `54c37bd6-297b-4371-8eb8-e6bf6f983336`
- [x] Record App ID: `04bf9758873466bb2bd8f85621858d99e33f58fd`

#### 5. Post-Deployment Health Check

- [x] Service is responding: https://04bf9758873466bb2bd8f85621858d99e33f58fd-8080.dstack-base-prod9.phala.network/health
- [x] Basic functionality verified (watch-history endpoint works)
- [x] No error logs in deployment

---

### Transparency Verification (MANDATORY)

**A deployment is NOT complete until these steps are verified.**

#### 6. Trust Center Verification

- [x] Visit Trust Center: https://trust.phala.com/app/04bf9758873466bb2bd8f85621858d99e33f58fd
- [x] Verification status shows "Completed"
- [x] All 30 data objects verified (App, KMS, Gateway)
- [x] Attestation timestamp (01:40:01 UTC) is after deployment time (01:34:05 UTC)

#### 7. On-Chain Transparency Log (REQUIRED)

- [x] **Using Base KMS**: Compose hash updates logged on Base blockchain
- [x] KMS Contract: `0x2f83172A49584C017F2B256F0FB2Dca14126Ba9C` (Base mainnet)
- [ ] Verify upgrade event on Base blockchain explorer

#### 8. Chain of Trust Record

| Item | Value |
|------|-------|
| Git Commit SHA | `8736a98a6a8d8c4162b8cc981b73a4e138497069` |
| Docker Image Tag | `ghcr.io/account-link/toy-example-enclave:8736a98` |
| Docker Image Digest | `sha256:73f9eaae5374cc9d86de57e160ae1c777224f4e841d8de25cdb3bc2ab09043d7` |
| App ID | `04bf9758873466bb2bd8f85621858d99e33f58fd` |
| CVM ID | `54c37bd6-297b-4371-8eb8-e6bf6f983336` |
| Trust Center URL | https://trust.phala.com/app/04bf9758873466bb2bd8f85621858d99e33f58fd |
| On-Chain TX Hash | _pending verification_ |
| Deployment Timestamp | 2026-01-27T01:34:05Z |
| KMS | Base (kms-base-prod9) |
| TEEPod | prod9 (US-WEST-1) |

---

### Post-Release Checklist

#### 9. Update Documentation

- [x] Verification documentation created (`docs/VERIFICATION.md`)
- [ ] Create GitHub Release with attestation proof attached
- [x] Tutorial and architecture docs created

#### 10. Code Audit Verification

- [x] `grep -r "direct_message" enclave/src/` returns nothing
- [x] All external API calls isolated to `tiktok-client.ts`
- [x] CI verifies no direct_messages API calls on every build

---

## Live Deployment

| Endpoint | URL |
|----------|-----|
| Enclave | https://04bf9758873466bb2bd8f85621858d99e33f58fd-8080.dstack-base-prod9.phala.network |
| Attestation | https://04bf9758873466bb2bd8f85621858d99e33f58fd-8090.dstack-base-prod9.phala.network |
| Mock API | https://toy.dstack.info |
| Dashboard | https://cloud.phala.com/dashboard/cvms/54c37bd6-297b-4371-8eb8-e6bf6f983336 |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        EXTERNAL (Untrusted)                      │
├─────────────────────────────────────────────────────────────────┤
│  Mock TikTok API (toy.dstack.info)                              │
│  ├── GET /api/watch_history  ← SAFE (enclave calls this)        │
│  └── GET /api/direct_messages ← SENSITIVE (enclave NEVER calls) │
├─────────────────────────────────────────────────────────────────┤
│                      TEE BOUNDARY (Trusted)                      │
├─────────────────────────────────────────────────────────────────┤
│  Enclave Application (Intel TDX on dstack prod9)                │
│  ├── Receives: Full API credentials                             │
│  ├── Calls: ONLY /api/watch_history                             │
│  ├── Exposes: /health, /watch-history, /signup, /signup-count   │
│  └── Attestation: Port 8090 (dstack metadata service)           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quick Verification

```bash
# Verify the running enclave matches source
./scripts/verify-attestation.sh https://04bf9758873466bb2bd8f85621858d99e33f58fd-8080.dstack-base-prod9.phala.network

# Verify no direct_messages code in enclave
grep -r "direct_message" enclave/src/
# Should return NOTHING

# Test the enclave endpoints
curl https://04bf9758873466bb2bd8f85621858d99e33f58fd-8080.dstack-base-prod9.phala.network/health
curl https://04bf9758873466bb2bd8f85621858d99e33f58fd-8080.dstack-base-prod9.phala.network/watch-history
```

---

## Documentation

- [docs/VERIFICATION.md](docs/VERIFICATION.md) - How to verify attestation
- [docs/TUTORIAL.md](docs/TUTORIAL.md) - Newcomer guide to TEE/dstack
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - System design
- [docs/RED-TEAM.md](docs/RED-TEAM.md) - Security audit guide

---

## Remaining Work

- [x] Verify Trust Center shows completed attestation
- [ ] Verify on-chain TX hash for Base KMS transparency log
- [ ] Set up friendly domain (e.g., `enclave.toy.dstack.info`)
- [ ] Create PR and merge to `main`
