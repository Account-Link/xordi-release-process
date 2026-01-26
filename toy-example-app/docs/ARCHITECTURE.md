# Architecture

System design reference for the toy example TEE application.

## Overview

This application demonstrates a secure API access pattern using Trusted Execution Environments (TEEs). The enclave receives credentials that could access sensitive data but is architecturally constrained to only access safe endpoints.

## System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          EXTERNAL (Untrusted)                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌──────────────────────┐         ┌──────────────────────────┐     │
│   │    Mock TikTok API   │         │    Verifier / Auditor    │     │
│   │                      │         │                          │     │
│   │  release-process-    │         │  - Fetch attestation     │     │
│   │  mock.dstack.info    │         │  - Compare compose hash  │     │
│   │                      │         │  - Audit source code     │     │
│   │  :3000               │         │  - Check Base contract   │     │
│   │  /api/watch_history  │◄────────│                          │     │
│   │  /api/direct_messages│         └──────────────────────────┘     │
│   └──────────┬───────────┘                    │                      │
│              │                                │                      │
│              │ API calls                      │ Verify               │
│              │ (only watch_history)           │                      │
├──────────────┼────────────────────────────────┼─────────────────────┤
│              │      TRUST BOUNDARY (TCB)      │                      │
├──────────────┼────────────────────────────────┼─────────────────────┤
│              ▼                                ▼                      │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                      dstack Enclave                          │   │
│   │                    (Intel TDX, prod9)                        │   │
│   │                                                              │   │
│   │   ┌─────────────────────┐    ┌─────────────────────────┐    │   │
│   │   │    Toy App          │    │   Metadata Service      │    │   │
│   │   │    :8080            │    │   :8090 (dstack)        │    │   │
│   │   │                     │    │                         │    │   │
│   │   │  /health            │    │  /attestation           │    │   │
│   │   │  /watch-history     │    │  /compose-hash          │    │   │
│   │   │  /signup            │    │  TDX Quote              │    │   │
│   │   │  /signup-count      │    │                         │    │   │
│   │   └─────────────────────┘    └─────────────────────────┘    │   │
│   │                                                              │   │
│   │   Secrets (injected by dstack):                              │   │
│   │   - MOCK_API_TOKEN (has full API access)                     │   │
│   │   - SIGNING_KEY (for attestation signatures)                 │   │
│   │                                                              │   │
│   │   Code Constraint:                                           │   │
│   │   - tiktok-client.ts only calls /api/watch_history          │   │
│   │   - No code exists to call /api/direct_messages              │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                      Base Contract                           │   │
│   │                                                              │   │
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

Both endpoints use the same authentication token. The key point: credentials that access safe data can also access sensitive data.

### TEE Enclave

**Location:** `enclave/`

The application running inside Intel TDX hardware isolation.

#### File Structure

```
enclave/src/
├── index.ts           # HTTP server, routes
├── config.ts          # Environment configuration
├── tiktok-client.ts   # API client (ONLY external calls)
└── signup-counter.ts  # Signed counter for attestation
```

#### Key Constraint

`tiktok-client.ts` is the **only** file that makes external API calls. It contains:
- `getWatchHistory()` - Calls `/api/watch_history`
- **Nothing else** - No function to call `/api/direct_messages`

This is the security guarantee. The enclave has credentials that COULD access DMs, but the code to do so doesn't exist.

#### Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/watch-history` | GET | Proxy to safe API |
| `/signup` | POST | Increment counter |
| `/signup-count` | GET | Get signed count |

### Metadata Service (dstack)

**Port:** 8090

Provided by dstack, not our code. Exposes:
- `/attestation` - Full TDX attestation quote
- `/compose-hash` - SHA256 of docker-compose.yml

This enables verifiers to confirm what code is running.

### Base Contract

On-chain transparency log for compose hash updates. Every deployment logs:
- Compose hash
- Timestamp
- App identifier

Enables retrospective audit: "What code was running on date X?"

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

### Verification Flow

```
Verifier
    │
    ├──────────────────────────┐
    │                          │
    ▼                          ▼
┌─────────────────┐    ┌─────────────────┐
│ Enclave :8090   │    │ Git Repository  │
│ /compose-hash   │    │ docker-compose  │
└────────┬────────┘    └────────┬────────┘
         │                      │
         │                      │
         ▼                      ▼
    Hash from TEE        Hash from Source
         │                      │
         └──────────┬───────────┘
                    │
                    ▼
              Compare Hashes
                    │
              ┌─────┴─────┐
              │           │
           Match      Mismatch
              │           │
              ▼           ▼
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
| Man-in-the-middle | TLS + attestation verification |

### What We Don't Protect Against

- Compromised Intel hardware
- Bugs in dstack runtime
- Side-channel attacks on TDX
- User providing wrong verification hash

## Deployment

### CI/CD Flow

```
Git Push
    │
    ▼
┌─────────────────┐
│ GitHub Actions  │
│ toy-build.yml   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Build Image     │
│ Tag with SHA    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Push to GHCR    │
└────────┬────────┘
         │
         │ (Manual trigger)
         ▼
┌─────────────────┐
│ toy-deploy.yml  │
│ Update compose  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Phala CLI       │
│ cvms upgrade    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Base Contract   │
│ Log new hash    │
└─────────────────┘
```

### Environment Configuration

| Variable | Description | Injected By |
|----------|-------------|-------------|
| `MOCK_API_URL` | Mock API endpoint | dstack secrets |
| `MOCK_API_TOKEN` | API authentication | dstack secrets |
| `SIGNING_KEY` | Counter signing key | dstack secrets |
| `PORT` | Server port | docker-compose |

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
