# Version Upgrade Flow & Multi-Machine Behavior

**Status:** IMPLEMENTING
**Author:** LSDan
**Created:** 2026-01-27
**Last Updated:** 2026-01-27
**Requested By:** Andrew Miller (@socrates1024_1)

## Overview

This spec addresses two enhancement requests for the toy example app:

1. **Version Increment & Upgrade Flow**: Demonstrate what it looks like to increment the version and deploy an upgrade to a running enclave
2. **Multi-Machine Behavior**: Explore and document what happens when using multiple Phala machines, including potential edge cases and failure modes

These enhancements will make the toy example app a more complete reference for teams building production TEE applications with dstack.

## Requirements

### Must Have

#### Version Upgrade Flow
- [ ] Add semantic versioning to the enclave application (exposed at runtime)
- [ ] Create a version bump script that updates version across all relevant files
- [ ] Document the complete upgrade workflow from code change to deployed update
- [ ] Demonstrate compose hash change detection during upgrades
- [ ] Show on-chain transparency log entries for version transitions
- [ ] Add `/version` endpoint to enclave returning current version + build metadata

#### Multi-Machine Behavior
- [ ] Deploy to prod7 and prod9 simultaneously with the same app-id
- [ ] Create `compare-instances.sh` script with cryptographic attestation verification
- [ ] Verify TDX quotes from both machines (Intel root of trust)
- [ ] Compare MR_ENCLAVE values to prove identical enclave images
- [ ] Document observed behavior: signup counter is per-instance (not shared)
- [ ] Document on-chain logging: both deployments logged with same app-id

### Should Have

- [ ] Automated changelog generation from conventional commits
- [ ] GitHub Release creation tied to version tags
- [ ] Auto-generated `DEPLOYMENTS.md` updated by CI on each deploy (machine, version, compose hash, tx hash, timestamp)
- [ ] Script to compare attestations between two running instances
- [ ] Documentation of recommended multi-machine patterns (when to use, when not to)

### Must NOT Have

- Distributed state synchronization (out of scope - this is a demo app)
- Production-grade fleet management
- Automated rollback mechanisms
- Load balancing between instances

## Branch Strategy

**IMPORTANT:** This work never merges to `main`. The `feat/toy-example-app` branch is the authoritative branch for the toy example app.

```
main (do not merge to)
  │
  └── feat/toy-example-app (authoritative for toy-example-app)
        │
        ├── feat/toy-example-app/version-upgrade (version bump implementation)
        │
        └── feat/toy-example-app/multi-machine (multi-machine deployment)
```

- All feature branches for this work branch off `feat/toy-example-app`
- PRs target `feat/toy-example-app`, not `main`
- Version tags are created on `feat/toy-example-app`
- CI/CD workflows trigger on pushes to `feat/toy-example-app`

## Non-Requirements

The following are explicitly out of scope:

- **State persistence**: The signup counter is intentionally ephemeral to demonstrate TEE isolation
- **High availability**: This is a demonstration app, not a production service
- **Automated failover**: Manual deployment is intentional for learning purposes
- **Cross-machine consensus**: Each machine operates independently by design

## Design

### Architecture

#### Version Management

```
┌─────────────────────────────────────────────────────────────────┐
│                        Version Sources                          │
├─────────────────────────────────────────────────────────────────┤
│  package.json          →  "version": "1.2.0"                    │
│  enclave/src/version.ts →  export const VERSION = "1.2.0"      │
│  Git tag               →  v1.2.0                                │
│  Docker image tag      →  :1.2.0 (in addition to :${SHA})      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Runtime Exposure                            │
├─────────────────────────────────────────────────────────────────┤
│  GET /version                                                   │
│  {                                                              │
│    "version": "1.2.0",                                          │
│    "gitSha": "8736a98",                                         │
│    "buildTime": "2026-01-27T02:00:00Z",                        │
│    "composeHash": "abc123..."                                   │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
```

#### Upgrade Flow Sequence

```
Developer                    GitHub Actions              Phala Cloud              Base Chain
    │                              │                          │                       │
    │  1. Make code changes        │                          │                       │
    │  2. Run: ./scripts/bump-version.sh minor                │                       │
    │     → Updates package.json, version.ts                  │                       │
    │  3. git commit -m "feat: add feature X"                 │                       │
    │  4. git tag v1.2.0           │                          │                       │
    │  5. git push --tags          │                          │                       │
    │                              │                          │                       │
    │ ─────────────────────────────>                          │                       │
    │                              │                          │                       │
    │                     Build new Docker image              │                       │
    │                     Tag: :1.2.0, :${SHA}                │                       │
    │                              │                          │                       │
    │                     Update docker-compose.yml           │                       │
    │                     Calculate new compose hash          │                       │
    │                              │                          │                       │
    │                              │  Deploy (phala deploy)   │                       │
    │                              │ ─────────────────────────>                       │
    │                              │                          │                       │
    │                              │                          │  Log compose hash     │
    │                              │                          │ ─────────────────────>│
    │                              │                          │                       │
    │                              │                          │  TX: 0xabc...         │
    │                              │                          │ <─────────────────────│
    │                              │                          │                       │
    │                     Output: New version deployed        │                       │
    │                     - Old compose hash: xyz...          │                       │
    │                     - New compose hash: abc...          │                       │
    │                     - On-chain TX: 0xabc...             │                       │
    │ <─────────────────────────────                          │                       │
```

#### Multi-Machine Architecture

**Goal:** Deploy identical code to prod7 and prod9 simultaneously with the same app-id, then cryptographically prove both machines are running the same code.

```
                    ┌──────────────────────────────────────────────┐
                    │              GitHub (Source of Truth)         │
                    │  - Code repository                            │
                    │  - Docker images (GHCR)                       │
                    │  - Deployment workflows                       │
                    │  - Same app-id for both deployments           │
                    └──────────────────────────────────────────────┘
                                          │
                         ┌────────────────┴────────────────┐
                         │                                 │
                         ▼                                 ▼
              ┌──────────────────┐              ┌──────────────────┐
              │  Phala prod9     │              │  Phala prod7     │
              │  (US-WEST)       │              │  (US-EAST)       │
              ├──────────────────┤              ├──────────────────┤
              │ CVM: toy-example │              │ CVM: toy-example │
              │ App-ID: shared   │              │ App-ID: shared   │
              │ Version: 1.2.0   │              │ Version: 1.2.0   │
              │ Counter: 42      │              │ Counter: 7       │
              │ Compose: abc123  │              │ Compose: abc123  │
              │ TDX Quote: sig-A │              │ TDX Quote: sig-B │
              └──────────────────┘              └──────────────────┘
                         │                                 │
                         │    ┌─────────────────────┐      │
                         └───>│ Attestation Verify  │<─────┘
                              │ compare-instances.sh│
                              ├─────────────────────┤
                              │ 1. Fetch /attestation from both        │
                              │ 2. Verify TDX signatures               │
                              │ 3. Extract MR_ENCLAVE from quotes      │
                              │ 4. Compare: MR_ENCLAVE must match      │
                              │ 5. Compare: Compose hashes must match  │
                              │ 6. Output: PROOF of same code          │
                              └─────────────────────┘
                                          │
                                          ▼
                    ┌──────────────────────────────────────────────┐
                    │              Base Blockchain                  │
                    │  - Compose hash logs from BOTH machines      │
                    │  - Same app-id, different CVM instances      │
                    │  - Queryable: "show all deployments of app X"│
                    └──────────────────────────────────────────────┘
```

#### Cryptographic Proof of Same Code

The `compare-instances.sh` script proves identical code by verifying:

1. **TDX Quote Verification**: Each machine's attestation contains a hardware-signed quote
2. **MR_ENCLAVE Comparison**: The measurement of the enclave image must be identical
3. **Compose Hash Match**: The SHA256 of docker-compose.yml must match
4. **On-Chain Correlation**: Both deployments logged to Base with same app-id

### Components

#### New Files

1. **`enclave/src/version.ts`** - Version constants and metadata
   ```typescript
   export const VERSION = "1.2.0";
   export const BUILD_SHA = process.env.BUILD_SHA || "dev";
   export const BUILD_TIME = process.env.BUILD_TIME || new Date().toISOString();
   ```

2. **`scripts/bump-version.sh`** - Version bump automation
   ```bash
   #!/bin/bash
   # Usage: ./scripts/bump-version.sh [major|minor|patch]
   # Updates: package.json, version.ts
   # Creates: git tag
   ```

3. **`scripts/compare-instances.sh`** - Multi-machine comparison
   ```bash
   #!/bin/bash
   # Usage: ./scripts/compare-instances.sh <url1> <url2>
   # Compares: version, compose hash, attestation
   ```

4. **`docs/UPGRADE-GUIDE.md`** - Step-by-step upgrade documentation

5. **`docs/MULTI-MACHINE.md`** - Multi-machine behavior documentation

6. **`DEPLOYMENTS.md`** - Auto-generated deployment history (updated by CI)
   ```markdown
   # Deployment History

   | Timestamp | Version | Machine | Compose Hash | On-Chain TX | Status |
   |-----------|---------|---------|--------------|-------------|--------|
   | 2026-01-28T03:00:00Z | 1.2.0 | prod9 | abc123... | [0xdef...](https://basescan.org/tx/0xdef...) | Active |
   | 2026-01-28T03:00:05Z | 1.2.0 | prod7 | abc123... | [0x123...](https://basescan.org/tx/0x123...) | Active |
   | 2026-01-27T02:00:00Z | 1.1.0 | prod9 | xyz789... | [0x456...](https://basescan.org/tx/0x456...) | Replaced |
   ```

#### Modified Files

1. **`enclave/src/index.ts`** - Add `/version` endpoint
2. **`enclave/Dockerfile`** - Inject build metadata as env vars
3. **`.github/workflows/toy-build.yml`** - Support version tags, inject build metadata
4. **`.github/workflows/toy-deploy.yml`** - Add environment parameter for multi-machine
5. **`README.md`** - Add version history table

### Interfaces

#### New Endpoint: GET /version

```json
{
  "version": "1.2.0",
  "gitSha": "8736a98a6a8d8c4162b8cc981b73a4e138497069",
  "gitShaShort": "8736a98",
  "buildTime": "2026-01-27T02:00:00Z",
  "composeHash": "a1b2c3d4e5f6...",
  "environment": "staging"
}
```

#### Version Bump Script Interface

```bash
# Bump patch version (1.0.0 -> 1.0.1)
./scripts/bump-version.sh patch

# Bump minor version (1.0.0 -> 1.1.0)
./scripts/bump-version.sh minor

# Bump major version (1.0.0 -> 2.0.0)
./scripts/bump-version.sh major

# Output:
# Bumped version: 1.0.0 -> 1.1.0
# Updated: enclave/package.json
# Updated: enclave/src/version.ts
# Created tag: v1.1.0
#
# Next steps:
#   git push origin main --tags
```

#### Instance Comparison Script Interface

```bash
./scripts/compare-instances.sh https://prod9.example.phala.network https://prod7.example.phala.network

# Output:
# ══════════════════════════════════════════════════════════════════
#  MULTI-MACHINE ATTESTATION VERIFICATION
# ══════════════════════════════════════════════════════════════════
#
# Fetching attestations...
#   ✓ prod9: Retrieved TDX quote (2.3 KB)
#   ✓ prod7: Retrieved TDX quote (2.3 KB)
#
# ┌─────────────────────┬──────────────────────┬──────────────────────┐
# │ Property            │ prod9 (US-WEST)      │ prod7 (US-EAST)      │
# ├─────────────────────┼──────────────────────┼──────────────────────┤
# │ Version             │ 1.2.0                │ 1.2.0                │
# │ Git SHA             │ 8736a98              │ 8736a98              │
# │ Compose Hash        │ abc123...            │ abc123...            │
# │ MR_ENCLAVE          │ def456...            │ def456...            │
# │ MR_SIGNER           │ 789abc...            │ 789abc...            │
# │ TDX Quote Valid     │ ✓ Verified           │ ✓ Verified           │
# │ Signup Counter      │ 42                   │ 7                    │
# │ Health              │ OK                   │ OK                   │
# └─────────────────────┴──────────────────────┴──────────────────────┘
#
# CRYPTOGRAPHIC VERIFICATION RESULTS:
# ───────────────────────────────────
# ✓ TDX quotes cryptographically verified (Intel root of trust)
# ✓ MR_ENCLAVE matches: Both machines running identical enclave image
# ✓ MR_SIGNER matches: Same signing authority
# ✓ Compose hashes match: Identical deployment configuration
#
# ⚠ EXPECTED DIFFERENCES:
#   - Signup counters differ (42 vs 7) - counters are per-instance, not shared
#
# ══════════════════════════════════════════════════════════════════
#  ✓ PROOF COMPLETE: Same code verified running on both machines
# ══════════════════════════════════════════════════════════════════
```

### Data Model

#### Version History (README.md table)

```markdown
## Version History

| Version | Date       | Git SHA   | Compose Hash | Changes |
|---------|------------|-----------|--------------|---------|
| 1.2.0   | 2026-01-28 | def456... | abc123...    | Added /version endpoint |
| 1.1.0   | 2026-01-27 | 8736a98   | xyz789...    | Initial release |
```

## Open Questions

- [x] ~~Should version tags trigger automatic production deployments, or remain manual?~~ **DECIDED: Yes, version tags trigger automatic deployments**
- [x] ~~Should we track deployment history per-machine in a separate file or just rely on on-chain logs?~~ **DECIDED: Both. Auto-generate `DEPLOYMENTS.md` via CI (addresses Andrew's concern: "if it's manual, people won't do it") + on-chain via Base KMS**
- [x] ~~For multi-machine: Should we demonstrate a specific use case (geo-redundancy, staging/prod split, or independent operators)?~~ **DECIDED: Deploy to prod7 and prod9 simultaneously with the same app-id**
- [x] ~~Should the compare-instances script verify attestations cryptographically or just compare hashes?~~ **DECIDED: Yes, cryptographic verification to prove same code is running on each machine**

## Alternatives Considered

### Alternative 1: Use Git SHA as sole version identifier

**Pros:** Already implemented, no additional tooling needed
**Cons:** Not human-readable, hard to communicate "we're running version X"
**Decision:** Rejected - Semantic versions are more useful for communication and release management

### Alternative 2: Automated distributed state sync

**Pros:** Signup counters would be consistent across machines
**Cons:** Adds significant complexity, requires consensus mechanism, not the point of this demo
**Decision:** Rejected - Out of scope. Document the limitation instead as a learning point.

### Alternative 3: Single deployment manifest for all machines

**Pros:** Ensures all machines run identical config
**Cons:** Reduces flexibility, harder to demonstrate environment differences
**Decision:** Rejected - Per-machine deployment is more realistic for production scenarios

## Traceability

*Filled in during implementation*

| Requirement | Implementation | Tests |
|-------------|----------------|-------|
| Semantic versioning | | |
| Version bump script | | |
| /version endpoint | | |
| Upgrade documentation | | |
| Multi-machine deployment | | |
| Instance comparison script | | |

## Changelog

| Date | Author | Changes |
|------|--------|---------|
| 2026-01-27 | LSDan | Initial draft based on @socrates1024_1 feedback |
| 2026-01-27 | LSDan | Resolved open questions: auto-deploy on version tags, prod7+prod9 multi-machine, cryptographic verification |
| 2026-01-27 | LSDan | Added branch strategy: feat/toy-example-app is authoritative, never merge to main |
| 2026-01-27 | LSDan | Added auto-generated DEPLOYMENTS.md requirement (per Andrew's preference for automatic evidence generation) |
| 2026-01-27 | LSDan | All open questions resolved, moved to REVIEW status |
