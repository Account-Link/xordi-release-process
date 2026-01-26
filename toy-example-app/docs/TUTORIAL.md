# Newcomer Tutorial

A step-by-step guide to understanding TEE release processes using this toy example.

## Introduction

### What is a TEE?

A **Trusted Execution Environment (TEE)** is a secure area of a processor that:
- Runs code in isolation from the main OS
- Protects data from being read, even by the system administrator
- Can prove (attest) exactly what code is running

Think of it as a locked box where code runs. You can see what code went in, and the box can prove nothing was changed, but you can't peek inside while it's running.

### What is dstack?

**dstack** (by Phala Network) is a platform for deploying TEE applications. It:
- Runs your Docker containers inside Intel TDX (a type of TEE)
- Provides attestation via a metadata service on port 8090
- Manages secrets that are only accessible inside the TEE

### Why Does This Matter?

This pattern solves a trust problem:

> "How can users trust that an app with their credentials won't misuse them?"

With TEE + attestation:
1. Users can verify exactly what code is running
2. Even the app developer can't change it without the change being visible
3. The code runs in hardware isolation - nothing can snoop on it

## The Toy Example

### Scenario

Imagine a TikTok-like service where users share their credentials to analyze their watch history. The problem: those same credentials could also access their private messages.

**Without TEE:** Users have to trust the developer's promise not to access DMs.

**With TEE:** Users can verify the code and see it's impossible to access DMs.

### Components

```
┌─────────────────┐     ┌─────────────────┐
│  Mock TikTok    │     │    Enclave      │
│  API            │◄────│    (TEE)        │
│                 │     │                 │
│ /watch_history  │     │ Only calls      │
│ /direct_messages│     │ watch_history   │
└─────────────────┘     └─────────────────┘
        ▲                       │
        │                       │ Attestation
        │                       ▼
   Same token            ┌─────────────────┐
   accesses both         │ Verifier can    │
                         │ prove code only │
                         │ calls safe API  │
                         └─────────────────┘
```

## Hands-On Tutorial

### Prerequisites

- Node.js 20+
- Docker
- Git

### Step 1: Clone and Explore

```bash
git clone https://github.com/xordi/toy-example-app.git
cd toy-example-app
```

Look at the structure:
```
toy-example-app/
├── mock-api/     # The "TikTok" API with safe and sensitive endpoints
├── enclave/      # The TEE app that only uses safe endpoints
├── scripts/      # Verification tools
└── docs/         # You are here
```

### Step 2: Run the Mock API

```bash
cd mock-api
npm install
npm run dev
```

Test both endpoints:
```bash
# Safe endpoint - watch history
curl -H "Authorization: Bearer demo-token-12345" \
  http://localhost:3000/api/watch_history

# Sensitive endpoint - direct messages
curl -H "Authorization: Bearer demo-token-12345" \
  http://localhost:3000/api/direct_messages
```

Notice: the same token works for both. This simulates real API credentials.

### Step 3: Run the Enclave (locally)

In a new terminal:
```bash
cd enclave
npm install
npm run dev
```

Test the enclave:
```bash
# This works - proxies to watch_history
curl http://localhost:8080/watch-history

# There's no endpoint for direct messages!
# The enclave simply doesn't have the code to call it.
```

### Step 4: Verify the Code

This is the key step. Even if you don't trust the developer, you can verify:

```bash
# Search for any mention of direct_messages
grep -r "direct_message" enclave/src/
# Returns NOTHING - the code doesn't reference it

# Find all external API calls
grep -r "fetch" enclave/src/
# Only tiktok-client.ts appears

# Read the API client
cat enclave/src/tiktok-client.ts
# You'll see only getWatchHistory() exists
```

### Step 5: Understand Attestation

When deployed to dstack, the enclave provides attestation on port 8090:

```bash
# In production, you'd run:
curl https://toy-example.dstack.info:8090/attestation
```

This returns:
- **Compose Hash**: SHA256 of docker-compose.yml (links to source)
- **TDX Quote**: Hardware proof the code is in a TEE

### Step 6: Complete the Verification

The full chain:

1. **Get attestation** from running enclave
2. **Compare compose hash** to known good value
3. **Trace compose hash** to git commit
4. **Audit source code** at that commit
5. **Verify** no direct_messages code exists

If all checks pass, you've proven the enclave cannot access DMs.

## Key Concepts Recap

| Concept | What It Means |
|---------|---------------|
| **TEE** | Hardware-isolated execution environment |
| **Attestation** | Cryptographic proof of what code is running |
| **Compose Hash** | Fingerprint linking running config to source |
| **TDX Quote** | Intel hardware signature proving TEE execution |
| **Code Audit** | Manual/automated review of source code |

## Next Steps

1. **Deploy to dstack**: Follow the CI/CD workflows
2. **Try the verification script**: `./scripts/verify-attestation.sh`
3. **Read the architecture doc**: `docs/ARCHITECTURE.md`
4. **Try to break it**: `docs/RED-TEAM.md`

## FAQ

**Q: Can the developer change the code after deployment?**
A: Yes, but it changes the compose hash, which is logged on-chain. Verifiers would see the change.

**Q: What if the TEE hardware is compromised?**
A: Intel TDX relies on hardware trust. If Intel's SGX/TDX is broken, all TEE apps are affected. This is the "root of trust."

**Q: Why not just promise not to access DMs?**
A: Promises can be broken. Code verification + TEE attestation is cryptographic proof, not a promise.

**Q: Is this production-ready?**
A: This is a toy example. Production systems need error handling, monitoring, key management, etc.
