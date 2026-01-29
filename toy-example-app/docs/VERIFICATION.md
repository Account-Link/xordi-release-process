# Verification Guide

How to verify the toy example enclave is running the expected code.

## Quick Verification

```bash
# Run the automated verification script
./scripts/verify-attestation.sh https://toy-example-prod9.phala.network
```

## Manual Verification Steps

### Step 1: Fetch Attestation

The enclave exposes attestation data on port 8090 (provided by dstack):

```bash
# Get full app info including app-compose
curl https://toy-example-prod9.phala.network:8090/info

# Get just the compose hash
curl https://toy-example-prod9.phala.network:8090/compose-hash

# Get TDX attestation quote
curl https://toy-example-prod9.phala.network:8090/attestation
```

### Step 2: Understanding Compose Hash

**IMPORTANT**: The compose hash is NOT just `sha256sum docker-compose.yml`.

The hash is calculated over the full **app-compose.json** structure:

```json
{
  "manifest_version": 1,
  "name": "toy-example-enclave",
  "runner": "docker-compose",
  "docker_compose_file": "<entire docker-compose.yml content as string>",
  "public_logs": true,
  "public_sysinfo": true,
  "kms_enabled": true,
  "pre_launch_script": "<optional prelaunch commands>"
}
```

The hash is computed as:
1. Serialize the AppCompose object with **deterministic JSON** (sorted keys, compact format)
2. SHA-256 hash of the UTF-8 encoded JSON string

### Step 3: Verify Compose Hash

#### Option A: Using dstack-sdk (Recommended)

```typescript
import { getComposeHash } from '@phala/dstack-sdk/get-compose-hash';

// Fetch app-compose from the enclave's metadata service
const response = await fetch('https://toy-example-prod9.phala.network:8090/info');
const info = await response.json();

// Calculate expected hash
const expectedHash = getComposeHash(info.app_compose);

// Compare with reported hash
const reportedHash = await fetch('https://toy-example-prod9.phala.network:8090/compose-hash')
  .then(r => r.text());

console.log('Match:', expectedHash === reportedHash.trim());
```

#### Option B: Manual Calculation

```bash
# 1. Get the app-compose from metadata server
curl -s https://toy-example-prod9.phala.network:8090/info | jq '.app_compose' > app-compose.json

# 2. The hash requires deterministic JSON (sorted keys, no whitespace)
# Use a tool that produces deterministic JSON, then SHA-256

# 3. Compare with compose-hash endpoint
curl -s https://toy-example-prod9.phala.network:8090/compose-hash
```

### Step 4: Verify Source Code Matches

To verify the docker image corresponds to specific source code:

```bash
# Clone the repository at the expected commit
git clone https://github.com/flashbots/xordi-release-process.git
cd xordi-release-process
git checkout <expected-commit-sha>

# Check the image tag in the app-compose's docker_compose_file
# The image tag should be the short SHA of the commit
```

### Step 5: Audit Source Code

Verify the source code only calls safe endpoints:

```bash
# Check for any direct_messages references
grep -r "direct_message" toy-example-app/enclave/src/
# Should return NOTHING

# Verify API calls are isolated to tiktok-client.ts
grep -r "fetch\|axios\|http\." toy-example-app/enclave/src/
# Should only show tiktok-client.ts (external) and index.ts (internal :8090)

# Inspect the API client
cat toy-example-app/enclave/src/tiktok-client.ts
# Should only contain getWatchHistory function
```

### Step 6: Verify TEE-Derived Signatures

The enclave derives its signing key from the TEE, not from host injection:

```bash
# Get a signed count from the enclave
curl -s https://toy-example-prod9.phala.network:8080/signup-count | jq

# Response includes:
# - count: the signup count
# - signature: HMAC-SHA256 with TEE-derived key
# - timestamp: when count was read
# - teeInfo: { appId, composeHash }
```

The signature is created with a key derived via `DstackClient.getKey('signing', 'hmac-signing')`.
This key is deterministic based on:
1. The app's compose hash (code identity)
2. The TEE's hardware attestation
3. The derivation path ('signing')

A different app or modified code would derive a **different key**, making signatures
non-replayable across code versions.

### Step 7: Verify Audit Log

```bash
# Get the full audit log
curl -s https://toy-example-prod9.phala.network:8080/audit-log | jq

# Each entry has:
# - action: "signup"
# - count: incremental count
# - timestamp: when recorded
# - signature: TEE-bound signature for this entry
```

This proves "how many users" signed up - each entry is independently signed.

## Trust Chain Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      VERIFICATION FLOW                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   SOURCE CODE (GitHub)                                       │
│        │                                                     │
│        │ git commit SHA                                      │
│        ▼                                                     │
│   DOCKER IMAGE (GHCR)                                        │
│        │                                                     │
│        │ image:tag in docker_compose_file                    │
│        ▼                                                     │
│   APP-COMPOSE.JSON                                           │
│   (docker_compose_file + metadata + prelaunch)               │
│        │                                                     │
│        │ deterministic JSON → SHA-256                        │
│        ▼                                                     │
│   COMPOSE HASH ◄──────────── ATTESTATION (port 8090)        │
│        │                            │                        │
│        │                            │ TDX Quote              │
│        ▼                            ▼                        │
│   BASE CONTRACT ◄──────────── INTEL TDX                     │
│   (transparency log)          (hardware root)                │
│        │                            │                        │
│        │                            ▼                        │
│        │                      TEE KEY DERIVATION            │
│        │                      (signing key bound to         │
│        │                       compose hash)                 │
│        ▼                                                     │
│   VERIFIABLE SIGNATURES                                      │
│   (audit log proves counts from THIS code)                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## What Each Verification Proves

| Check | What It Proves |
|-------|----------------|
| Compose hash match | Full app config (not just docker-compose.yml) matches source |
| Image tag = commit SHA | Image built from that commit |
| TDX attestation | Running in hardware TEE |
| Base contract log | Permanent audit record |
| Code audit | Only safe endpoints called |
| TEE-derived signature | Count came from THIS code version |
| Audit log | Verifiable record of "how many users" |

## Preserving App-Compose

The app-compose should be preserved for audit purposes:

### 1. CI/CD Archives (Primary)

Each deployment archives `app-compose.json` as a GitHub Actions artifact.
Find these in the workflow run artifacts.

### 2. Fetch from Running Instance

While the CVM is running:
```bash
curl -s https://toy-example-prod9.phala.network:8090/info | jq '.app_compose' > app-compose.json
```

### 3. Reconstruct from Source

If you have the exact commit and know the deployment config:

```bash
cd toy-example-app/enclave

# Get docker-compose content with correct image tag
IMAGE_TAG="abc1234"  # Short SHA from deployment
sed "s|image:.*|image: ghcr.io/owner/toy-example-enclave:${IMAGE_TAG}|" docker-compose.yml > compose-temp.yml

# Create app-compose structure
cat > app-compose.json << EOF
{
  "manifest_version": 1,
  "name": "toy-example-enclave",
  "runner": "docker-compose",
  "docker_compose_file": $(cat compose-temp.yml | jq -Rs .),
  "public_logs": true,
  "public_sysinfo": true,
  "kms_enabled": true
}
EOF

# Calculate hash
# Note: requires deterministic JSON serialization
```

## Common Issues

### Hash Mismatch

If the compose hash doesn't match:
1. Verify you're using **app-compose.json**, not just docker-compose.yml
2. Ensure deterministic JSON serialization (sorted keys, compact)
3. Check for any `pre_launch_script` differences
4. Verify `manifest_version` and other metadata fields match

### Attestation Unavailable

If port 8090 returns an error:
1. The service might still be starting (wait 60s after deploy)
2. Check if the enclave is running: `curl :8080/health`
3. dstack metadata service might be misconfigured

### Base Contract Not Updated

If the compose hash isn't on-chain:
1. Deployment might have failed
2. KMS update might be pending
3. Check the deployment workflow logs

## Retrospective Audit

For auditing past deployments:

1. **Find the deployment** from DEPLOYMENTS.md or Base contract
2. **Get the compose hash** from the deployment record
3. **Find the matching commit** by checking CI artifacts or git history
4. **Verify the audit log** signatures match the compose hash
5. **Audit that commit's source code**

This proves what code was running at any point in history and how many
users interacted with it, even if the service has been upgraded or shut down.

## Security Properties

The toy example demonstrates:

1. **Code Integrity**: Compose hash proves which code is running
2. **Execution Isolation**: TDX attestation proves code runs in TEE
3. **Audit Trail**: Signed entries prove data came from attested code
4. **Non-Repudiation**: TEE-derived keys cannot be extracted or replayed
5. **Verifiable Metrics**: Audit log proves "how many users"

See [ARCHITECTURE.md](ARCHITECTURE.md) for full security model.
