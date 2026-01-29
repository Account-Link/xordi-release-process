# Architecture

System design reference for the toy example TEE application.

## Security Goal

This application demonstrates **verifiable computation with audit trail**:

```
┌─────────────────────────────────────────────────────────────┐
│                      SECURITY GOAL                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  An auditor can prove:                                       │
│                                                              │
│  1. WHAT CODE ran                                           │
│     └─> compose hash in attestation (app-compose.json)       │
│                                                              │
│  2. HOW MANY USERS signed up                                │
│     └─> audit log with TEE-signed entries (persistent)       │
│                                                              │
│  3. SIGNATURES ARE AUTHENTIC                                │
│     └─> key derived in TEE, bound to compose hash            │
│                                                              │
│  4. ALL MACHINES RUN SAME CODE                              │
│     └─> single AppID, same compose hash across devices       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Protected User Interaction

The `/signup` endpoint demonstrates a protected user interaction:

```
User                    Enclave (TEE)                 Audit Log
  │                          │                            │
  │──── POST /signup ────────>│                            │
  │                          │                            │
  │                          │── Derive signing key ──────>│
  │                          │   (bound to compose hash)   │
  │                          │                            │
  │                          │── Sign audit entry ────────>│
  │                          │   action=signup            │
  │                          │   count=N                  │
  │                          │   timestamp=T              │
  │                          │   signature=S              │
  │                          │                            │
  │                          │── Persist to /data ────────>│
  │                          │   (encrypted storage)       │
  │                          │                            │
  │<─── { count: N } ────────│                            │
```

**Security Property**: An auditor can verify:
- The signature S was created by code with compose hash H
- No external party could forge this signature
- The count N is accurate (each entry is independently signed)
- Data survives restarts (encrypted persistent storage)

## Overview

This application demonstrates a secure API access pattern using Trusted Execution
Environments (TEEs). The enclave receives credentials that could access sensitive
data but is architecturally constrained to only access safe endpoints.

## System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          EXTERNAL (Untrusted)                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌──────────────────────┐         ┌──────────────────────────┐     │
│   │    Mock TikTok API   │         │    Verifier / Auditor    │     │
│   │                      │         │                          │     │
│   │  :3000               │         │  1. Fetch attestation    │     │
│   │  /api/watch_history  │◄────────│  2. Verify compose hash  │     │
│   │  /api/direct_messages│         │  3. Audit source code    │     │
│   └──────────┬───────────┘         │  4. Verify signatures    │     │
│              │                      │  5. Check audit log      │     │
│              │ API calls            └──────────────────────────┘     │
│              │ (only watch_history)           │                      │
├──────────────┼────────────────────────────────┼─────────────────────┤
│              │      TRUST BOUNDARY (TCB)      │                      │
├──────────────┼────────────────────────────────┼─────────────────────┤
│              ▼                                ▼                      │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                      dstack Enclave                          │   │
│   │                    (Intel TDX)                               │   │
│   │                                                              │   │
│   │   ┌─────────────────────┐    ┌─────────────────────────┐    │   │
│   │   │    Toy App          │    │   Metadata Service      │    │   │
│   │   │    :8080            │    │   :8090 (dstack)        │    │   │
│   │   │                     │    │                         │    │   │
│   │   │  /health            │    │  /info                  │    │   │
│   │   │  /version           │    │  /attestation           │    │   │
│   │   │  /watch-history     │    │  /compose-hash          │    │   │
│   │   │  /signup            │    │  TDX Quote              │    │   │
│   │   │  /signup-count      │    │                         │    │   │
│   │   │  /audit-log         │    │                         │    │   │
│   │   └─────────────────────┘    └─────────────────────────┘    │   │
│   │              │                            │                  │   │
│   │              │ derive key                 │                  │   │
│   │              ▼                            │                  │   │
│   │   ┌─────────────────────┐                │                  │   │
│   │   │  TEE Key Derivation │◄───────────────┘                  │   │
│   │   │  via dstack.sock    │  (bound to compose hash)          │   │
│   │   │                     │                                   │   │
│   │   │  signing_key =      │                                   │   │
│   │   │  KDF(root, app_id)  │                                   │   │
│   │   └─────────────────────┘                                   │   │
│   │              │                                               │   │
│   │              │ sign entries                                  │   │
│   │              ▼                                               │   │
│   │   ┌─────────────────────┐                                   │   │
│   │   │  Encrypted Storage  │                                   │   │
│   │   │  /data (LUKS)       │                                   │   │
│   │   │                     │                                   │   │
│   │   │  audit-log.json     │                                   │   │
│   │   └─────────────────────┘                                   │   │
│   │                                                              │   │
│   │   Secrets (injected by dstack):                              │   │
│   │   - MOCK_API_TOKEN (has full API access)                     │   │
│   │                                                              │   │
│   │   TEE-Derived (NOT injected):                                │   │
│   │   - SIGNING_KEY (derived from TEE persistent key)            │   │
│   │                                                              │   │
│   │   Code Constraint:                                           │   │
│   │   - tiktok-client.ts only calls /api/watch_history          │   │
│   │   - No code exists to call /api/direct_messages              │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                      Base Contract                           │   │
│   │                                                              │   │
│   │   - Single AppID for all devices (prod5, prod9)             │   │
│   │   - Logs every compose hash update                           │   │
│   │   - Permanent on-chain record                                │   │
│   │   - Enables retrospective audit                              │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Components

### Mock TikTok API

**Location:** `mock-api/`

An external service simulating a third-party API with both safe and sensitive endpoints.

| Endpoint | Type | Description |
|----------|------|-------------|
| `/api/watch_history` | SAFE | Returns viewing history |
| `/api/direct_messages` | SENSITIVE | Returns private messages |

Both endpoints use the same authentication token. The key point: credentials that
access safe data can also access sensitive data.

### TEE Enclave

**Location:** `enclave/`

The application running inside Intel TDX hardware isolation.

#### File Structure

```
enclave/src/
├── index.ts           # HTTP server, routes, startup
├── config.ts          # Environment configuration
├── tiktok-client.ts   # API client (ONLY external calls)
├── signup-counter.ts  # Signup logic with TEE signatures
├── audit-storage.ts   # Persistent encrypted audit log
├── tee-keys.ts        # TEE key derivation via dstack
└── version.ts         # Build metadata
```

#### Key Constraint

`tiktok-client.ts` is the **only** file that makes external API calls. It contains:
- `getWatchHistory()` - Calls `/api/watch_history`
- **Nothing else** - No function to call `/api/direct_messages`

This is the security guarantee. The enclave has credentials that COULD access DMs,
but the code to do so doesn't exist.

#### TEE Key Derivation

`tee-keys.ts` derives the signing key from TEE persistent key:

```typescript
import { DstackClient } from '@phala/dstack-sdk';

const client = new DstackClient();
const keyResponse = await client.getKey('signing', 'hmac-signing');
// Key is deterministic, bound to app identity (compose hash)
```

This key is:
- **Deterministic**: Same app always gets same key
- **Bound to compose hash**: Different code = different key
- **Cannot be extracted**: Only accessible inside TEE
- **Verifiable**: Auditors can verify signatures match compose hash

#### Persistent Audit Log

`audit-storage.ts` provides encrypted persistent storage:

- Stores audit entries to `/data/audit-log.json`
- `/data` is LUKS-encrypted by dstack
- Keys derived from KMS, bound to app identity
- **FAILS HARD** if storage not available (data integrity required)

#### Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/version` | GET | Build metadata + compose hash |
| `/watch-history` | GET | Proxy to safe API |
| `/signup` | POST | Record signup (TEE-signed, persistent) |
| `/signup-count` | GET | Get signed count with TEE info |
| `/audit-log` | GET | Full audit log for verification |

### Metadata Service (dstack)

**Port:** 8090

Provided by dstack, not our code. Exposes:
- `/info` - Full app info including app-compose
- `/attestation` - Full TDX attestation quote
- `/compose-hash` - SHA256 of app-compose.json

**Important**: The compose hash is over the full `app-compose.json`, not just
docker-compose.yml. See [VERIFICATION.md](VERIFICATION.md) for details.

### Base Contract

On-chain transparency log. v2.0 uses **single AppID** for all devices:

| Property | v1.x | v2.0 |
|----------|------|------|
| AppIDs | Separate per machine | Single unified |
| Devices | 1 per AppID | Multiple per AppID |
| Contract | 2 contracts | 1 contract |

Registry: `0x2f83172A49584C017F2B256F0FB2Dca14126Ba9C`

## Data Flow

### Normal Operation

```
User Request
    │
    ▼
┌─────────────────┐
│ Enclave :8080   │
│ /watch-history  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ tiktok-client   │
│ getWatchHistory │
└────────┬────────┘
         │
         │ MOCK_API_TOKEN
         ▼
┌─────────────────┐
│ Mock API :3000  │
│ /watch_history  │
└────────┬────────┘
         │
         ▼
   Response to User
```

### Signup with Audit Trail

```
User Request: POST /signup
    │
    ▼
┌─────────────────┐
│ Enclave :8080   │
│ /signup         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ tee-keys.ts     │
│ getSigningKey() │
└────────┬────────┘
         │
         │ via /var/run/dstack.sock
         ▼
┌─────────────────┐
│ dstack KMS      │
│ derive key      │
│ (compose-bound) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ signup-counter  │
│ sign entry      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ audit-storage   │
│ persist to /data│
│ (encrypted)     │
└────────┬────────┘
         │
         ▼
   { count, signature }
```

### Verification Flow

```
Auditor
    │
    ├──────────────────────────┬──────────────────────────┐
    │                          │                          │
    ▼                          ▼                          ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Enclave :8090   │    │ Enclave :8080   │    │ Git Repository  │
│ /compose-hash   │    │ /audit-log      │    │ app-compose     │
└────────┬────────┘    └────────┬────────┘    └────────┬────────┘
         │                      │                      │
         │                      │                      │
         ▼                      ▼                      ▼
    Hash from TEE         Signed Entries         Hash from Source
         │                      │                      │
         └──────────┬───────────┴──────────────────────┘
                    │
                    ▼
              Verify:
              1. compose hash matches source
              2. signatures valid for compose hash
              3. count progression is continuous
              4. both devices have same hash
                    │
              ┌─────┴─────┐
              │           │
           VERIFIED    ALERT!
```

## Security Model

### Trusted Computing Base (TCB)

Only the enclave is in the TCB:
- Intel TDX hardware
- dstack runtime
- Enclave application code

Everything else is untrusted:
- Mock API server
- Network
- Host operating system
- Cloud provider

### Threat Model

| Threat | Mitigation |
|--------|------------|
| Malicious code change | Compose hash changes, logged on-chain |
| Developer steals DMs | Code audit proves no DM access |
| Operator steals secrets | TEE hardware isolation |
| Operator forges signatures | Signing key derived in TEE, not injected |
| Man-in-the-middle | TLS + attestation verification |
| Replay old signatures | Signatures bound to compose hash |
| Fake audit counts | Each entry independently signed |
| Data loss on restart | Persistent encrypted storage |

### What We Don't Protect Against

- Compromised Intel hardware
- Bugs in dstack runtime
- Side-channel attacks on TDX
- User providing wrong verification hash

## Deployment

### CI/CD Flow

```
Git Push (version tag)
    │
    ▼
┌─────────────────┐
│ GitHub Actions  │
│ toy-build.yml   │
└────────┬────────┘
         │
         ├─────────────────────────────────┐
         │                                 │
         ▼                                 ▼
┌─────────────────┐              ┌─────────────────┐
│ Build Image     │              │ Archive         │
│ Tag with SHA    │              │ app-compose.json│
└────────┬────────┘              └─────────────────┘
         │
         ▼
┌─────────────────┐
│ Push to GHCR    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Deploy prod9    │
│ (creates AppID) │
└────────┬────────┘
         │
         │ APP_ID, CONTRACT
         ▼
┌─────────────────┐
│ addDevice()     │
│ (add prod5)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Deploy prod5    │
│ (same AppID)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Base Contract   │
│ Single AppID    │
│ 2 deviceIDs     │
└─────────────────┘
```

### Environment Configuration

| Variable | Description | Injected By |
|----------|-------------|-------------|
| `MOCK_API_URL` | Mock API endpoint | dstack secrets |
| `MOCK_API_TOKEN` | API authentication | dstack secrets |
| `PORT` | Server port | docker-compose |

**Note**: `SIGNING_KEY` is no longer an environment variable. The signing key
is derived from TEE persistent key via `@phala/dstack-sdk`. See `tee-keys.ts`.

## Future Considerations

### Not Implemented (Out of Scope)

- User authentication
- Rate limiting
- Complex error recovery
- Multiple API providers
- UI/frontend

### Potential Extensions

- Add more API providers to demonstrate multi-source attestation
- Implement consent language served from TEE
- Add database with encrypted storage
- Build verification tooling UI
- Add rollback protection with monotonic counters
