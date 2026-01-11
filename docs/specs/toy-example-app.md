# Toy Example App

**Status:** APPROVED
**Author:** LSDan
**Created:** 2026-01-10
**Last Updated:** 2026-01-10

## Overview

A simplified dstack application that demonstrates the complete TEE release process end-to-end. This toy example proves the attestation pattern works before applying it to production systems like Xordi.

The app simulates a TikTok-like scenario: an enclave receives full API credentials but is architecturally constrained to only access "safe" endpoints (watch history), proving it **cannot** access sensitive endpoints (direct messages) even though it has the credentials to do so.

This becomes the reference implementation and template for generalizing TEE release processes.

### Why This Matters

From Andrew (Jan 10 call):
> "A simplified dstack app that has the release process... that would be a really good way to make progress without being stuck on exactly the Xordi-specific issues."

The core constraint this must prove:
> "The goal is to say we have some process for validating but even if someone follows that process to validate we would still be able to steal DMs from users TikTok accounts" — this app must make that statement **false** and provable.

### Retrospective Audit Framing

The key insight from Andrew: **"We want to be able to show in March what we did during January and February."**

Even if the app shuts down, the audit trail should prove:
- Exact code running matched published source (attestation)
- Code ran in hardware isolation (Intel TDX)
- Every compose hash update logged on Base contract
- Code audit proves only safe endpoints were called

The release process is what we do in January so we have our paperwork covered when an auditor pays attention in March.

## Requirements

### Must Have

- [ ] **Mock TikTok API** (external service, publicly hosted) with two endpoints:
  - `GET /api/watch_history` — Returns fake watch history data (SAFE)
  - `GET /api/direct_messages` — Returns fake DM data (SENSITIVE)
  - Both endpoints require the same auth token

- [ ] **TEE Enclave Application** (Node.js/TypeScript) that:
  - Receives full API credentials (can technically call either endpoint)
  - Only calls `watch_history` endpoint in code
  - Runs on dstack (prod9) with Intel TDX attestation
  - Exposes metadata on port 8090 (attestation data)

- [ ] **Reproducible Docker Build**:
  - Tagged commits produce identical image digests across machines
  - Multi-stage build with pinned dependencies
  - Published to public container registry (GHCR or DockerHub)

- [ ] **Complete CI/CD Pipeline** (GitHub Actions):
  - Build and push Docker images on tag
  - Generate attestation artifacts
  - Deploy to Phala Cloud dstack (prod9, Base deployment)
  - Update Base KMS transparency log (every compose hash update logged on-chain)

- [ ] **Verification Documentation**:
  - How to verify the running code matches source
  - How to audit that code only calls safe endpoints
  - Trust boundary diagram (TCB only - no Archive/Borg Cube equivalents)

- [ ] **Tutorial Documentation**:
  - Step-by-step guide for newcomers to TEE/dstack
  - Explains each component and why it matters

### Should Have

- [ ] **User signup count attestation**:
  - Enclave signs a count of how many "users" went through the system
  - Proves number of users without exposing identities
  - Demonstrates retrospective audit capability

- [ ] Automated verification script that:
  - Fetches attestation from running enclave (via 8090 metadata service)
  - Compares against expected compose hash
  - Reports pass/fail

- [ ] Example "red team" documentation:
  - "Here's how you'd verify we can't steal DMs"

- [ ] Health check endpoint in enclave

### Must NOT Have

- Real TikTok API integration
- User authentication or sessions (beyond mock token)
- Complex database (simple in-memory counter for signup count is fine)
- Complex business logic
- `.well-known/attestation` endpoint (users never directly contact server; 8090 metadata already provides this)

## Non-Requirements

**Explicitly out of scope:**

- Production-grade error handling
- Rate limiting or security hardening beyond TEE
- Support for multiple API providers
- User-facing UI (API only)
- Consent language served from TEE (future enhancement, similar to Boo Magic Show)
- Integration with existing Xordi codebase

## Design

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        EXTERNAL (Untrusted)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────────┐         ┌──────────────────────────┐     │
│   │  Mock TikTok API │         │    Verifier / Auditor    │     │
│   │  release-process │         │                          │     │
│   │                  │         │  - Fetch attestation     │     │
│   │  :3000           │         │  - Compare compose hash  │     │
│   │  /watch_history  │◄────────│  - Audit source code     │     │
│   │  /direct_messages│         │  - Check Base contract   │     │
│   └────────┬─────────┘         └──────────────────────────┘     │
│            │                              │                      │
│            │ API calls                    │ Verify               │
│            │ (only watch_history)         │                      │
├────────────┼──────────────────────────────┼─────────────────────┤
│            │      TRUST BOUNDARY (TCB)    │                      │
├────────────┼──────────────────────────────┼─────────────────────┤
│            ▼                              ▼                      │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                    dstack Enclave                        │   │
│   │                    (Intel TDX, prod9)                    │   │
│   │                                                          │   │
│   │   ┌─────────────────┐    ┌─────────────────────────┐    │   │
│   │   │  Toy App        │    │  Metadata Service       │    │   │
│   │   │  :8080          │    │  :8090 (dstack native)  │    │   │
│   │   │                 │    │                         │    │   │
│   │   │  - Calls API    │    │  - /attestation         │    │   │
│   │   │  - Only safe    │    │  - /compose-hash        │    │   │
│   │   │    endpoints    │    │  - TDX quote            │    │   │
│   │   │  - Signup count │    │                         │    │   │
│   │   └─────────────────┘    └─────────────────────────┘    │   │
│   │                                                          │   │
│   │   Credentials: MOCK_API_TOKEN (has full access)          │   │
│   │   Constraint:  Code only calls /watch_history            │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                    Base Contract                         │   │
│   │   - Logs every compose hash update                       │   │
│   │   - Permanent on-chain record for retrospective audit    │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Note:** Trust boundary focuses ONLY on TCB (Trusted Compute Base). External components like "Archive" or "Borg Cube" equivalents are explicitly excluded - attestations only cover what runs in the enclave.

### Components

#### 1. Mock TikTok API (`mock-api/`)

External service simulating TikTok's API. Publicly hosted at `release-process-mock.dstack.info`.

```
mock-api/
├── src/
│   └── server.ts        # Express server with two endpoints
├── Dockerfile
├── package.json
└── README.md
```

**Endpoints:**
- `GET /api/watch_history` — Returns `{ videos: [...] }` with fake watch data
- `GET /api/direct_messages` — Returns `{ messages: [...] }` with fake DMs
- Both require `Authorization: Bearer <token>` header

#### 2. TEE Enclave App (`enclave/`)

The core application running inside the TEE.

```
enclave/
├── src/
│   ├── index.ts         # Main entry, HTTP server
│   ├── tiktok-client.ts # API client - ONLY calls watch_history
│   ├── signup-counter.ts # Tracks signup count for attestation
│   └── config.ts        # Environment config
├── Dockerfile           # Multi-stage, reproducible
├── package.json
├── package-lock.json    # Locked for reproducibility
└── README.md
```

**Key constraint:** `tiktok-client.ts` contains the ONLY code that makes API calls. It must be trivially auditable:

```typescript
// tiktok-client.ts
export async function getWatchHistory(token: string): Promise<WatchHistory> {
  const response = await fetch(`${API_BASE}/api/watch_history`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.json();
}

// NOTE: No function exists for direct_messages
```

#### 3. CI/CD Pipeline (`.github/workflows/`)

```
.github/workflows/
├── build.yml            # Build and push Docker images
├── deploy.yml           # Deploy to Phala dstack (prod9, Base)
└── verify.yml           # Automated verification checks
```

#### 4. Documentation (`docs/`)

```
docs/
├── VERIFICATION.md      # How to verify attestation
├── TUTORIAL.md          # Step-by-step newcomer guide
├── ARCHITECTURE.md      # System design reference
└── RED-TEAM.md          # How to audit for vulnerabilities
```

### Interfaces

#### Mock API Responses

```typescript
// GET /api/watch_history
interface WatchHistoryResponse {
  videos: Array<{
    id: string;
    title: string;
    watchedAt: string;
    duration: number;
  }>;
}

// GET /api/direct_messages (SENSITIVE - enclave must NOT call)
interface DirectMessagesResponse {
  messages: Array<{
    id: string;
    from: string;
    content: string;
    timestamp: string;
  }>;
}
```

#### Enclave Metadata (port 8090 - dstack native)

Provided by dstack framework, not custom code:

```typescript
// GET /attestation
interface AttestationResponse {
  composeHash: string;      // SHA256 of docker-compose.yml
  tdxQuote: string;         // Base64 TDX attestation quote
  timestamp: string;
  appVersion: string;
}
```

#### Signup Count Attestation (custom endpoint)

```typescript
// GET /signup-count
interface SignupCountResponse {
  count: number;            // Number of "signups" processed
  signature: string;        // Enclave signature over count
  timestamp: string;
}
```

### Data Model

Minimal persistent data:
- In-memory counter for signup count (resets on restart, which is fine for demo)
- No database required
- Stateless API calls

## Open Questions

*All resolved:*
- ~~Base KMS format~~ → Will use standard Base contract, format isn't critical for spec
- ~~Phala Cloud config~~ → prod9, Base deployment (standard dstack)
- ~~Mock API hosting~~ → `release-process-mock.dstack.info`
- ~~Verification script distribution~~ → Inline in repo is fine

## Alternatives Considered

### Alternative: Mock API in Same Container

**Rejected because:** Having the mock API external better demonstrates the trust boundary. The enclave calling an "external" service mirrors the real-world scenario where Xordi calls TikTok.

### Alternative: Python/Flask Stack

**Rejected because:** Node.js/TypeScript matches Xordi's existing stack, making it easier to compare patterns and eventually port improvements back.

### Alternative: Manual CI/CD First

**Rejected because:** The full pipeline is a core deliverable of the toy example. Proving the release process works end-to-end requires automation from day one.

### Alternative: `.well-known/attestation` Endpoint

**Rejected because:** Per Andrew (Jan 10 call): "Users never directly contact the server... it would actually be a little bit weird to serve a well-known attestation off our server." The 8090 metadata service already provides attestation data.

## Traceability

*To be filled during implementation*

| Requirement | Implementation | Tests |
|-------------|----------------|-------|
| Mock API - watch_history | | |
| Mock API - direct_messages | | |
| Enclave - only safe calls | | |
| Reproducible build | | |
| CI/CD - build | | |
| CI/CD - deploy | | |
| Attestation metadata | | |
| Signup count attestation | | |
| Verification docs | | |
| Tutorial docs | | |

## Changelog

| Date | Author | Changes |
|------|--------|---------|
| 2026-01-10 | LSDan | Initial draft |
| 2026-01-10 | LSDan | Updated with Jan 10 call transcript context: retrospective audit framing, prod9/Base deployment, public mock API, signup count attestation |
| 2026-01-10 | LSDan | Resolved mock API domain: release-process-mock.dstack.info |
| 2026-01-10 | LSDan | Status changed to REVIEW |
| 2026-01-10 | LSDan | Status changed to APPROVED |
