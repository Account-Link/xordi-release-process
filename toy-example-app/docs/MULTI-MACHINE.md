# Multi-Machine Deployment

This document explains how the toy example app deploys to multiple Phala Cloud machines and how to verify that identical code is running on each.

## Overview

The toy example app can be deployed to multiple Phala Cloud clusters simultaneously:

- **prod9** (US-WEST)
- **prod7** (US-EAST)

Both deployments use the same:
- Docker image
- App ID
- Configuration
- On-chain KMS (Base)

## Why Multi-Machine?

Multi-machine deployment demonstrates several key concepts:

1. **Geographic Distribution**: Reduce latency for users in different regions
2. **Redundancy**: Continue operating if one cluster has issues
3. **Verification**: Prove the same code runs across independent machines
4. **Auditability**: Each machine logs to the same on-chain contract

## Architecture

```
                    ┌──────────────────────────────────────┐
                    │         GitHub (Source of Truth)     │
                    │  - Same Docker image                 │
                    │  - Same docker-compose.yml           │
                    │  - Same app-id                       │
                    └──────────────────────────────────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    │                                   │
                    ▼                                   ▼
         ┌──────────────────┐              ┌──────────────────┐
         │     prod9        │              │     prod7        │
         │   (US-WEST)      │              │   (US-EAST)      │
         ├──────────────────┤              ├──────────────────┤
         │ CVM: toy-example │              │ CVM: toy-example │
         │ Version: 1.2.0   │              │ Version: 1.2.0   │
         │ Compose: abc123  │              │ Compose: abc123  │
         │ Counter: 42      │              │ Counter: 7       │
         └──────────────────┘              └──────────────────┘
                    │                                   │
                    └─────────────────┬─────────────────┘
                                      │
                                      ▼
                    ┌──────────────────────────────────────┐
                    │          Base Blockchain             │
                    │  - Both deployments log here         │
                    │  - Same app-id, different CVMs       │
                    │  - Queryable deployment history      │
                    └──────────────────────────────────────┘
```

## Verifying Same Code

### Using the Comparison Script

The `compare-instances.sh` script cryptographically verifies both machines run identical code:

```bash
./scripts/compare-instances.sh \
  https://toy-example-prod9.phala.network \
  https://toy-example-prod7.phala.network
```

Output:
```
══════════════════════════════════════════════════════════════════
 MULTI-MACHINE ATTESTATION VERIFICATION
══════════════════════════════════════════════════════════════════

Fetching attestations...
  ✓ prod9: Retrieved TDX quote
  ✓ prod7: Retrieved TDX quote

┌─────────────────────┬──────────────────────┬──────────────────────┐
│ Property            │ prod9                │ prod7                │
├─────────────────────┼──────────────────────┼──────────────────────┤
│ Version             │ 1.2.0                │ 1.2.0                │
│ Compose Hash        │ abc123...            │ abc123...            │
│ MR_ENCLAVE          │ def456...            │ def456...            │
│ Signup Counter      │ 42                   │ 7                    │
└─────────────────────┴──────────────────────┴──────────────────────┘

CRYPTOGRAPHIC VERIFICATION RESULTS:
───────────────────────────────────
✓ TDX quotes present on both machines
✓ MR_ENCLAVE matches: Identical enclave image
✓ Compose hashes match: Identical configuration

══════════════════════════════════════════════════════════════════
 ✓ PROOF COMPLETE: Same code verified running on both machines
══════════════════════════════════════════════════════════════════
```

### What Each Field Proves

| Field | What It Proves |
|-------|----------------|
| **Version** | Application version matches |
| **Git SHA** | Same source code commit |
| **Compose Hash** | Identical deployment configuration |
| **MR_ENCLAVE** | Identical enclave binary measurement |
| **MR_SIGNER** | Same signing authority |
| **TDX Quote** | Hardware-attested by Intel TDX |

### Expected Differences

Some values will differ between machines:

| Field | Why It Differs |
|-------|----------------|
| **Signup Counter** | Each machine has its own in-memory counter |
| **CVM ID** | Different virtual machine instances |
| **IP Address** | Different network endpoints |

## Manual Verification

### Check Version Endpoint

```bash
# prod9
curl https://toy-example-prod9.phala.network:8080/version | jq

# prod7
curl https://toy-example-prod7.phala.network:8080/version | jq
```

### Check Attestation

```bash
# prod9
curl https://toy-example-prod9.phala.network:8090/attestation | jq

# prod7
curl https://toy-example-prod7.phala.network:8090/attestation | jq
```

### Verify Compose Hash

```bash
# Fetch from running instance
curl https://toy-example-prod9.phala.network:8090/compose-hash

# Calculate from source
sha256sum toy-example-app/enclave/docker-compose.yml | cut -d' ' -f1
```

## On-Chain Verification

Both deployments log to the Base blockchain via KMS. You can query the contract to see all deployments:

Contract: `0x2f83172A49584C017F2B256F0FB2Dca14126Ba9C` (Base mainnet)

Check [DEPLOYMENTS.md](../DEPLOYMENTS.md) for transaction hashes linking each deployment to on-chain evidence.

## State Isolation

Each machine maintains independent state:

```
prod9:                          prod7:
┌─────────────────────┐        ┌─────────────────────┐
│ signup_count = 42   │        │ signup_count = 7    │
│ (in-memory)         │        │ (in-memory)         │
└─────────────────────┘        └─────────────────────┘
         │                              │
         │   NO STATE SHARING           │
         └──────────────────────────────┘
```

This is intentional for the demo:
- Shows that TEE instances are isolated
- Demonstrates that counters reset on redeployment
- Highlights the need for external state if persistence is required

## When to Use Multi-Machine

### Good Use Cases

- **Latency-sensitive applications**: Deploy closer to users
- **High availability**: Survive cluster outages
- **Verification demos**: Prove identical code runs everywhere
- **Load distribution**: Route traffic to nearest cluster

### Not Needed For

- **Single-user applications**: One machine is sufficient
- **Stateful services**: Requires distributed state management
- **Cost-sensitive deployments**: Multiple machines = higher cost

## Deployment History

See [DEPLOYMENTS.md](../DEPLOYMENTS.md) for a complete history of all deployments across both clusters.

## Troubleshooting

### Compose Hash Mismatch

If compose hashes differ between machines:
1. Check if both deployed from the same commit
2. Verify the `cluster:` field in docker-compose.yml
3. Re-deploy from the same tag

### MR_ENCLAVE Mismatch

If MR_ENCLAVE differs (rare):
1. Clusters may be running different dstack versions
2. Base image may have been updated
3. Contact Phala support

### One Machine Unreachable

1. Check cluster status at Phala Cloud dashboard
2. Verify firewall/network configuration
3. Check health endpoint: `curl :8080/health`
