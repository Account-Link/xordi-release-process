# Toy Example App

A simplified dstack application demonstrating the complete TEE release process end-to-end.

## Live Deployment

- **Enclave**: https://7d522b2e14fda28d2a7f4e2ff74702b679d385f6-8080.dstack-pha-prod9.phala.network
- **Attestation**: https://7d522b2e14fda28d2a7f4e2ff74702b679d385f6-8090.dstack-pha-prod9.phala.network
- **Mock API**: https://toy.dstack.info
- **Dashboard**: https://cloud.phala.com/dashboard/cvms/ad0e3fbf-8fb7-4fd6-b7fb-190aba361315

## What This Proves

The enclave receives full API credentials that **could** access sensitive data (DMs), but the code **only** calls safe endpoints (watch history). This constraint is provable through:

1. **Code Audit**: `grep -r "direct_message" enclave/src/` returns nothing
2. **TEE Attestation**: Hardware proves this exact code is running
3. **Transparency Log**: Every deployment logged on Base contract

## Quick Start

```bash
# Verify the running enclave
./scripts/verify-attestation.sh https://7d522b2e14fda28d2a7f4e2ff74702b679d385f6-8080.dstack-pha-prod9.phala.network

# Test locally
cd mock-api && npm install && npm run dev  # Terminal 1
cd enclave && npm install && npm run dev   # Terminal 2
curl http://localhost:8080/health
curl http://localhost:8080/watch-history
```

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

## Documentation

- [docs/VERIFICATION.md](docs/VERIFICATION.md) - How to verify attestation
- [docs/TUTORIAL.md](docs/TUTORIAL.md) - Newcomer guide to TEE/dstack
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - System design
- [docs/RED-TEAM.md](docs/RED-TEAM.md) - Security audit guide

---

## Release Process Checklist

### Must Have Requirements

- [x] **Mock TikTok API** (external service, publicly hosted)
  - [x] `GET /api/watch_history` - Returns fake watch history (SAFE)
  - [x] `GET /api/direct_messages` - Returns fake DMs (SENSITIVE)
  - [x] Both endpoints require same auth token
  - Deployed at: https://toy.dstack.info

- [x] **TEE Enclave Application** (Node.js/TypeScript)
  - [x] Receives full API credentials
  - [x] Only calls `watch_history` endpoint in code
  - [x] Runs on dstack (prod9) with Intel TDX attestation
  - [x] Exposes metadata on port 8090
  - App ID: `7d522b2e14fda28d2a7f4e2ff74702b679d385f6`

- [x] **Reproducible Docker Build**
  - [x] Tagged commits produce consistent images
  - [x] Multi-stage build with pinned dependencies
  - [x] Published to GHCR: `ghcr.io/account-link/toy-example-enclave`

- [x] **Complete CI/CD Pipeline** (GitHub Actions)
  - [x] Build and push Docker images on push
  - [x] Verify no direct_messages calls in code
  - [x] Auto-deploy to Phala Cloud dstack (prod9)
  - [ ] Update Base KMS transparency log (pending: requires Base contract setup)

- [x] **Verification Documentation**
  - [x] How to verify running code matches source
  - [x] How to audit that code only calls safe endpoints
  - [x] Trust boundary diagram

- [x] **Tutorial Documentation**
  - [x] Step-by-step guide for newcomers
  - [x] Explains each component and why it matters

### Should Have Requirements

- [x] **User signup count attestation**
  - [x] Enclave signs count of "users"
  - [x] Proves count without exposing identities
  - [x] Demonstrates retrospective audit capability

- [x] **Automated verification script**
  - [x] Fetches attestation from enclave (port 8090)
  - [x] Compares against expected compose hash
  - [x] Reports pass/fail
  - Script: `scripts/verify-attestation.sh`

- [x] **Red team documentation**
  - [x] "Here's how you'd verify we can't steal DMs"
  - Doc: `docs/RED-TEAM.md`

- [x] **Health check endpoint**
  - [x] `GET /health` returns service status

### Deployment Info

| Item | Value |
|------|-------|
| CVM ID | `ad0e3fbf-8fb7-4fd6-b7fb-190aba361315` |
| App ID | `7d522b2e14fda28d2a7f4e2ff74702b679d385f6` |
| TEEPod | prod9 (US-WEST-1) |
| Base Image | dstack-dev-0.5.5 |
| Instance Type | tdx.small |

### Remaining Work

- [ ] **Base KMS Transparency Log**: Configure on-chain logging for compose hash updates
- [ ] **Production domain**: Set up friendly URL for enclave (e.g., `enclave.toy.dstack.info`)
- [ ] **Merge to main**: Create PR and merge `feat/toy-example-app` branch

---

## Files

```
toy-example-app/
├── mock-api/                 # External mock TikTok API
│   ├── src/server.ts         # Express server with both endpoints
│   ├── Dockerfile
│   └── package.json
├── enclave/                  # TEE application
│   ├── src/
│   │   ├── index.ts          # Main HTTP server
│   │   ├── tiktok-client.ts  # API client (ONLY calls watch_history)
│   │   ├── signup-counter.ts # Signed counter for attestation
│   │   └── config.ts         # Environment config
│   ├── Dockerfile            # Multi-stage reproducible build
│   ├── docker-compose.yml    # dstack deployment config
│   └── package.json
├── scripts/
│   └── verify-attestation.sh # Automated verification
├── docs/
│   ├── VERIFICATION.md       # Verification guide
│   ├── TUTORIAL.md           # Newcomer tutorial
│   ├── ARCHITECTURE.md       # System design
│   └── RED-TEAM.md           # Security audit guide
└── README.md                 # This file
```

## CI/CD Workflows

- `.github/workflows/toy-build.yml` - Build, verify, and deploy on push
- `.github/workflows/toy-deploy.yml` - Manual deployment workflow

## Security Verification

```bash
# Verify no direct_messages code in enclave
grep -r "direct_message" enclave/src/
# Should return NOTHING (except comments explaining what NOT to do)

# Verify all API calls are in tiktok-client.ts
grep -r "fetch\(" enclave/src/
# Should only show tiktok-client.ts
```
