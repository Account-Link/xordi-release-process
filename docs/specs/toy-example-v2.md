# Toy Example App v2.0 Specification

**Status:** DRAFT
**Author:** LSDan
**Created:** 2026-01-28
**Last Updated:** 2026-01-28

## Overview

v2.0 is a comprehensive update addressing Andrew's feedback on both the toy-example-app implementation and the multi-machine deployment architecture. This spec combines:

1. **Documentation fixes** - Correct compose hash verification docs
2. **Security improvements** - TEE-derived signing key, persistent audit log
3. **Unified AppID** - Both prod5 and prod9 under single AppID

## Feedback Summary

### Andrew's Feedback (2026-01-28)

**Implementation Issues:**
1. VERIFICATION.md says `sha256sum docker-compose.yml` but real hash is over full `app-compose.json`
2. SIGNING_KEY is passed by host - should be derived from TEE persistent key
3. Security goal unclear - no protected user interaction or audit log to "prove how many users"

**Architecture Issue:**
4. Two separate AppIDs for prod5/prod9 - should be single AppID with multiple deviceIDs

## Requirements

### Must Have

| ID | Requirement | Source |
|----|-------------|--------|
| R1 | Fix compose hash documentation (app-compose.json, not docker-compose.yml) | Andrew feedback |
| R2 | Preserve app-compose via CI artifact AND document reconstruction | Andrew feedback |
| R3 | Derive SIGNING_KEY from TEE persistent key, not host injection | Andrew feedback |
| R4 | Persist audit log to dstack encrypted storage | Andrew feedback |
| R5 | Document clear security goal ("prove how many users") | Andrew feedback |
| R6 | Single AppID for both prod5 and prod9 machines | Andrew feedback |
| R7 | Multiple deviceIDs registered under single AppID | Andrew feedback |
| R8 | Base chain transparency (keep Base KMS) | Existing requirement |

### Should Have

| ID | Requirement |
|----|-------------|
| R9 | `/audit-log` endpoint showing signed history |
| R10 | TEE info (appId, composeHash) in signed responses |
| R11 | Device enumeration under single AppID |

### Nice to Have

| ID | Requirement |
|----|-------------|
| R12 | Health aggregation across devices |
| R13 | Rollback support for all devices |

## Current State Analysis

### Issue 1: Compose Hash Documentation

**Current (WRONG):**
```bash
sha256sum enclave/docker-compose.yml
```

**Reality:**
The compose hash is over the full `app-compose.json`:
```json
{
  "manifest_version": 1,
  "name": "toy-example-enclave",
  "runner": "docker-compose",
  "docker_compose_file": "<docker-compose.yml content as string>",
  "public_logs": true,
  "kms_enabled": true,
  "pre_launch_script": "<optional>"
}
```

Hash calculation: `SHA256(deterministicJSON(appCompose))` where deterministicJSON sorts keys and produces compact output.

### Issue 2: SIGNING_KEY Host Injection

**Current:**
```typescript
// config.ts
signingKey: getEnvOrDefault('SIGNING_KEY', 'dev-signing-key-not-for-production'),
```

**Problem:** Malicious host can inject any key. Signatures don't prove TEE origin.

**Solution:** Use `@phala/dstack-sdk`:
```typescript
const client = new DstackClient();
const keyResponse = await client.getKey('signing', 'hmac-signing');
// Key bound to compose hash - different code = different key
```

### Issue 3: Unclear Security Goal

**Current:** Code constraint demo exists but no clear audit property.

**Proposed Security Goal:**
> An auditor can verify:
> 1. Which code processed user requests (compose hash)
> 2. How many users signed up (audit log with TEE-bound signatures)
> 3. That counts cannot be forged (key derived in TEE, bound to compose hash)

### Issue 4: Separate AppIDs

**Current (v1.x):**
| Cluster | Contract | AppID |
|---------|----------|-------|
| prod9 | `0xF9d35F495FF3592771E73a528f4fc5737E30224B` | Unique |
| prod5 | `0xdF07B43068fFE4EB91817367fC7869839D7CBf11` | Unique |

**Problem:** Two separate AppIDs, no proof both run identical code.

**Investigation Findings:**
- `--custom-app-id` flag exists in Phala CLI but is NOT implemented (code commented out)
- App contract has `setAllowAnyDevice(bool)` and `addDevice(bytes32)` functions
- Owner can call these to add devices to existing AppID
- Option B (Base KMS + manual device registration) is feasible

## Design

### Component 1: Compose Hash Documentation

Update VERIFICATION.md:
- Explain app-compose.json structure
- Show how to fetch from `:8090/info`
- Provide TypeScript verification using `@phala/dstack-sdk/get-compose-hash`
- Update trust chain diagram

### Component 2: App-Compose Preservation

**Both approaches:**

1. **CI Artifact** - Archive app-compose.json on each deployment
   ```yaml
   - name: Archive app-compose
     uses: actions/upload-artifact@v4
     with:
       name: app-compose-${{ matrix.cluster }}
       path: app-compose.json
   ```

2. **Reconstruction Docs** - Document how to rebuild from source
   ```bash
   # Reconstruct app-compose.json from source
   cat > app-compose.json << EOF
   {
     "manifest_version": 1,
     "name": "toy-example-enclave",
     "runner": "docker-compose",
     "docker_compose_file": $(cat docker-compose.yml | jq -Rs .),
     ...
   }
   EOF
   ```

### Component 3: TEE Key Derivation

New module `tee-keys.ts`:
```typescript
import { DstackClient } from '@phala/dstack-sdk';

export async function getSigningKey(): Promise<Buffer> {
  const client = new DstackClient();
  if (await client.isReachable()) {
    const response = await client.getKey('signing', 'hmac-signing');
    return Buffer.from(response.key);
  }
  // Dev fallback (logged as warning)
  return Buffer.from('dev-signing-key-not-for-production');
}
```

**Key properties:**
- Deterministic for same app
- Bound to compose hash
- Cannot be extracted from TEE
- Different code = different key

### Component 4: Persistent Audit Log

Use dstack encrypted storage for persistence. Based on [dstack architecture](https://arxiv.org/html/2509.11555v1):
- LUKS encrypted volumes at block level
- Keys derived from dstack-KMS, bound to app identity
- Portable across TEE instances

```typescript
import * as fs from 'fs/promises';

interface AuditEntry {
  action: 'signup';
  count: number;
  timestamp: string;
  signature: string;
}

// Storage path for encrypted persistence
const AUDIT_LOG_PATH = '/data/audit-log.json';

async function verifyStorageAvailable(): Promise<void> {
  // FAIL HARD if encrypted storage not available
  try {
    await fs.access('/data', fs.constants.W_OK);
  } catch {
    throw new Error('FATAL: /data not writable. Encrypted storage required.');
  }
}

async function loadAuditLog(): Promise<AuditEntry[]> {
  try {
    const data = await fs.readFile(AUDIT_LOG_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return []; // Fresh start
  }
}

async function saveAuditLog(entries: AuditEntry[]): Promise<void> {
  await fs.writeFile(AUDIT_LOG_PATH, JSON.stringify(entries, null, 2), 'utf-8');
}
```

**docker-compose.yml update (best-guess, verify in staging):**
```yaml
volumes:
  - /var/run/dstack.sock:/var/run/dstack.sock
  - /data:/data  # dstack encrypted volume
```

**Startup behavior:**
- App calls `verifyStorageAvailable()` on startup
- If `/data` not writable → **FAIL HARD** (refuse to start)
- No fallback to in-memory (data integrity required)

### Component 5: Unified AppID

**Approach:** Base KMS + Explicit Device Registration via `addDevice()`

Using `addDevice(deviceId)` instead of `setAllowAnyDevice(true)` for explicit whitelist control.

**Workflow:**
```
┌─────────────────────────────────────────────────────────────┐
│                    v2.0 Deployment Flow                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Version Tag (v2.x)                                        │
│        │                                                    │
│        ▼                                                    │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  Step 1: Deploy to prod9 (primary)                  │   │
│   │    - phala deploy -n toy-example-prod9 --kms base   │   │
│   │    - Creates NEW AppID (fresh v2 contract)          │   │
│   │    - Registers prod9 deviceID                       │   │
│   │    - Extract APP_ID and DEVICE_ID_PROD5 for step 2  │   │
│   └─────────────────────────────────────────────────────┘   │
│        │                                                    │
│        │ APP_ID, CONTRACT_ADDRESS                           │
│        ▼                                                    │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  Step 2: Add prod5 device to contract               │   │
│   │    - Get prod5 deviceID from Phala Cloud            │   │
│   │    - Call addDevice(prod5_deviceId) on contract     │   │
│   │    - Deployer key is contract owner                 │   │
│   └─────────────────────────────────────────────────────┘   │
│        │                                                    │
│        ▼                                                    │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  Step 3: Deploy to prod5 (secondary)                │   │
│   │    - phala deploy -n toy-example-prod5 --kms base   │   │
│   │    - Uses SAME compose, gets SAME compose hash      │   │
│   │    - Contract recognizes whitelisted deviceID       │   │
│   └─────────────────────────────────────────────────────┘   │
│        │                                                    │
│        ▼                                                    │
│   Result: 1 AppID, 1 contract, 2 explicit deviceIDs        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Contract Interaction:**
```bash
# After first deployment, add prod5 device explicitly
APP_CONTRACT="0x..."  # From first deploy output
PROD5_DEVICE_ID="0x..." # Get from Phala Cloud for prod5 node

cast send $APP_CONTRACT "addDevice(bytes32)" $PROD5_DEVICE_ID \
  --private-key $TOY_DEPLOYER_PRIVATE_KEY \
  --rpc-url https://mainnet.base.org
```

**Why addDevice over setAllowAnyDevice:**
- Explicit whitelist = more restrictive
- Only authorized devices can join
- Better audit trail of which devices are approved

### Component 6: Security Goal Documentation

Update ARCHITECTURE.md:

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
│  2. HOW MANY USERS                                          │
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

## Implementation Plan

### Phase 1: Documentation Updates

| Task | Files |
|------|-------|
| Fix compose hash docs | `docs/VERIFICATION.md` |
| Document app-compose preservation | `docs/VERIFICATION.md` |
| Add security goal section | `docs/ARCHITECTURE.md` |
| Update env vars table | `enclave/README.md`, `docs/ARCHITECTURE.md` |

### Phase 2: Code Changes

| Task | Files |
|------|-------|
| Add @phala/dstack-sdk | `enclave/package.json` |
| Create TEE key module | `enclave/src/tee-keys.ts` (new) |
| Create audit storage module | `enclave/src/audit-storage.ts` (new) |
| Remove SIGNING_KEY config | `enclave/src/config.ts` |
| Update signup counter | `enclave/src/signup-counter.ts` |
| Add /audit-log endpoint | `enclave/src/index.ts` |
| Add encrypted storage volume | `enclave/docker-compose.yml` |

### Phase 3: Workflow Updates

| Task | Files |
|------|-------|
| Remove SIGNING_KEY secret | `toy-build.yml`, `toy-deploy.yml` |
| Add app-compose archiving | `toy-build.yml` |
| Add unified AppID logic | `toy-build.yml` |
| Add setAllowAnyDevice call | `toy-build.yml` |

### Phase 4: Deployment

| Task | Description |
|------|-------------|
| Delete existing CVMs | Already done |
| Deploy v2.0 to prod9 | Primary deployment, creates AppID |
| Enable allowAnyDevice | Contract call |
| Deploy v2.0 to prod5 | Secondary deployment, same AppID |
| Update DEPLOYMENTS.md | Record new unified contract |

### Phase 5: Testing

| Task | Description |
|------|-------------|
| Build verification | TypeScript compiles |
| Local dev testing | Without TEE (dev fallback key) |
| Staging deployment | With TEE, verify key derivation |
| Audit log persistence | Restart CVM, verify log survives |
| Unified AppID | Verify both devices under same AppID |

## Files Changed

| File | Change |
|------|--------|
| `docs/VERIFICATION.md` | Fix compose hash docs, add preservation |
| `docs/ARCHITECTURE.md` | Add security goal, update diagrams |
| `enclave/README.md` | Update env vars, add endpoints |
| `enclave/package.json` | Add @phala/dstack-sdk |
| `enclave/src/tee-keys.ts` | NEW - TEE key derivation |
| `enclave/src/audit-storage.ts` | NEW - Persistent audit log |
| `enclave/src/config.ts` | Remove signingKey |
| `enclave/src/signup-counter.ts` | Use TEE key, persistent audit |
| `enclave/src/index.ts` | Add /audit-log, async startup |
| `enclave/src/version.ts` | Bump to 2.0.0 |
| `enclave/docker-compose.yml` | Remove SIGNING_KEY, add storage volume |
| `DEPLOYMENTS.md` | Clear history, note v2.0 migration |
| `.github/workflows/toy-build.yml` | Remove SIGNING_KEY, add unified AppID |
| `.github/workflows/toy-deploy.yml` | Remove SIGNING_KEY |

## Verification

After implementation, auditors can:

1. **Verify compose hash** (correctly, over app-compose.json):
   ```typescript
   import { getComposeHash } from '@phala/dstack-sdk/get-compose-hash';
   const info = await fetch(':8090/info').then(r => r.json());
   const hash = getComposeHash(info.app_compose);
   ```

2. **Verify audit log**:
   ```bash
   curl :8080/audit-log
   # Returns signed entries, each verifiable against compose hash
   ```

3. **Verify unified AppID**:
   ```bash
   # Both machines return same compose hash
   curl https://toy-example-prod9.phala.network:8090/compose-hash
   curl https://toy-example-prod5.phala.network:8090/compose-hash
   # Same hash = same code = same AppID
   ```

4. **Verify TEE-derived signatures**:
   ```bash
   curl :8080/signup-count
   # Response includes teeInfo with appId and composeHash
   # Signature created with key bound to that composeHash
   ```

## Traceability

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| R1: Fix compose hash docs | VERIFICATION.md | Pending |
| R2: App-compose preservation | CI artifact + docs | Pending |
| R3: TEE-derived key | tee-keys.ts | Pending |
| R4: Persistent audit log | audit-storage.ts + /data volume (fail hard) | Pending |
| R5: Security goal docs | ARCHITECTURE.md | Pending |
| R6: Single AppID | Fresh v2 contract via first deploy | Pending |
| R7: Multiple deviceIDs | addDevice(prod5_deviceId) explicit whitelist | Pending |
| R8: Base chain transparency | Keep Base KMS | Existing |
| R9: /audit-log endpoint | index.ts | Pending |
| R10: TEE info in responses | signup-counter.ts | Pending |

## Risks

| Risk | Mitigation |
|------|------------|
| dstack-sdk API changes | Pin version, test in staging |
| Encrypted storage unavailable | FAIL HARD - app refuses to start without /data |
| Volume config incorrect | Test in staging before prod, document working config |
| Contract owner key management | Use TOY_DEPLOYER_PRIVATE_KEY (existing secret) |
| addDevice requires deviceId upfront | Get from Phala Cloud API or first deploy output |

## Changelog

| Date | Author | Changes |
|------|--------|---------|
| 2026-01-28 | LSDan | Initial draft (merged from unified-appid.md and v2 improvements) |
