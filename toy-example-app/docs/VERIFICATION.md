# Verification Guide

How to verify the toy example enclave is running the expected code.

## Quick Verification

```bash
# Run the automated verification script
./scripts/verify-attestation.sh https://toy-example.dstack.info
```

## Manual Verification Steps

### Step 1: Fetch Attestation

The enclave exposes attestation data on port 8090 (provided by dstack):

```bash
# Get the attestation data
curl https://toy-example.dstack.info:8090/attestation

# Get just the compose hash
curl https://toy-example.dstack.info:8090/compose-hash
```

### Step 2: Compute Expected Compose Hash

Calculate what the compose hash should be from source:

```bash
# Clone the repository at the expected commit
git clone https://github.com/xordi/toy-example-app.git
cd toy-example-app
git checkout <expected-commit-sha>

# Calculate compose hash
sha256sum enclave/docker-compose.yml
```

### Step 3: Compare Hashes

The attestation compose hash should match the computed hash. If they match:
- The enclave is running the configuration from that exact commit
- The docker-compose.yml hasn't been tampered with
- The image tag in the compose file links to a specific build

### Step 4: Verify Image Matches Source

Check that the Docker image was built from the expected source:

```bash
# Get image digest from compose file
cat enclave/docker-compose.yml | grep image:

# Verify the image was built from this commit (check CI logs)
# The image tag should be the short SHA of the commit
```

### Step 5: Audit Source Code

Verify the source code only calls safe endpoints:

```bash
# Check for any direct_messages references
grep -r "direct_message" enclave/src/
# Should return NOTHING

# Verify API calls are isolated
grep -r "fetch\|axios\|http\." enclave/src/
# Should only show tiktok-client.ts

# Inspect the API client
cat enclave/src/tiktok-client.ts
# Should only contain getWatchHistory function
```

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
│        │ image:tag in compose                                │
│        ▼                                                     │
│   DOCKER-COMPOSE.YML                                         │
│        │                                                     │
│        │ sha256sum                                           │
│        ▼                                                     │
│   COMPOSE HASH ◄──────────── ATTESTATION (port 8090)        │
│        │                            │                        │
│        │                            │ TDX Quote              │
│        ▼                            ▼                        │
│   BASE CONTRACT ◄──────────── INTEL SGX/TDX                 │
│   (transparency log)          (hardware root)                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## What Each Verification Proves

| Check | What It Proves |
|-------|----------------|
| Compose hash match | Config matches source |
| Image tag = commit SHA | Image built from that commit |
| TDX attestation | Running in hardware TEE |
| Base contract log | Permanent audit record |
| Code audit | Only safe endpoints called |

## Common Issues

### Hash Mismatch

If the compose hash doesn't match:
1. Check you're comparing against the correct git commit
2. Ensure no local modifications to docker-compose.yml
3. Verify line endings (CRLF vs LF)

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

1. **Find the deployment time** from CI logs or Base contract
2. **Get the compose hash** from Base contract at that time
3. **Find the matching commit** by searching git history
4. **Audit that commit's source code**

This proves what code was running at any point in history, even if the
service has been upgraded or shut down.
