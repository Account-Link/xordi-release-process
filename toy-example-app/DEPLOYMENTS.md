# Deployment History

Auto-generated deployment log. Each entry represents a verified deployment to Phala Cloud with on-chain transparency logging via Base KMS.

## Active Deployments

| Timestamp | Version | Machine | Compose Hash | On-Chain TX | Status |
|-----------|---------|---------|--------------|-------------|--------|
| 2026-01-27T22:13:17Z | 1.2.10 | prod9 | `933c4112f698dced8d1f1e9d895139f8beb28f280e112eb98e2b8cb1f4eb3b0a` | pending | Active |
| 2026-01-27T22:13:17Z | 1.2.10 | prod5 | `933c4112f698dced8d1f1e9d895139f8beb28f280e112eb98e2b8cb1f4eb3b0a` | pending | Active |
| 2026-01-27T19:57:10Z | 1.2.9 | prod9 | `714f18f783b42c59ef5d21a3c54ca4fddcfcb262235cff81e90a10d2811b7764` | pending | Active |
| 2026-01-27T19:57:10Z | 1.2.9 | prod5 | `714f18f783b42c59ef5d21a3c54ca4fddcfcb262235cff81e90a10d2811b7764` | pending | Active |
| 2026-01-27T19:41:39Z | 1.2.8 | prod9 | `1c680f5aa342132d88d68286ef73fcc22fc2a19c36f7ca97ca084238f31c2004` | pending | Active |
| 2026-01-27T19:41:39Z | 1.2.8 | prod5 | `1c680f5aa342132d88d68286ef73fcc22fc2a19c36f7ca97ca084238f31c2004` | pending | Active |
| 2026-01-27T19:34:06Z | 1.2.7 | prod9 | `7fcd5dc932172911357a2cd99bd8d7ac965cc04c0278422f75cd343be720a3e0` | pending | Active |
| 2026-01-27T19:34:06Z | 1.2.7 | prod5 | `7fcd5dc932172911357a2cd99bd8d7ac965cc04c0278422f75cd343be720a3e0` | pending | Active |
| 2026-01-27T19:31:37Z | 1.2.6 | prod9 | `13d16e8df8f68f71ff109ad5bfe7b43bee2335a1569d72d6de2a51a7d58e9344` | pending | Active |
| 2026-01-27T19:31:37Z | 1.2.6 | prod5 | `13d16e8df8f68f71ff109ad5bfe7b43bee2335a1569d72d6de2a51a7d58e9344` | pending | Active |
| 2026-01-27T19:28:29Z | 1.2.5 | prod9 | `60a2d52f2bfb198c7948044b783f0f249b180a32d833ac62b373eab71781fa1a` | pending | Active |
| 2026-01-27T19:28:29Z | 1.2.5 | prod5 | `60a2d52f2bfb198c7948044b783f0f249b180a32d833ac62b373eab71781fa1a` | pending | Active |
| 2026-01-27T19:24:27Z | 1.2.4 | prod9 | `8e10856c16d9beb11668f810df1ff55cc0a49d0a7fff58b20f3328db8b0bc421` | pending | Active |
| 2026-01-27T19:24:27Z | 1.2.4 | prod5 | `8e10856c16d9beb11668f810df1ff55cc0a49d0a7fff58b20f3328db8b0bc421` | pending | Active |
| 2026-01-27T18:50:59Z | 1.2.3 | prod9 | `5d71f9f005a38088873df1cbf103bd159306d7806498e15990ac4dfad8746522` | pending | Active |
| 2026-01-27T18:50:59Z | 1.2.3 | prod7 | `c186951cf1cf512088784a2b5f2450e2889b05de91d02b6a3a54c6b8bbeb6e20` | pending | Active |
| 2026-01-27T17:31:20Z | 1.2.0 | prod7 | `4480ff7213388d73b2236108b512bc3f0a2cd55f28555693f87aea5ad512a270` | [View](https://basescan.org/tx/0x02f9011082210502830f4240836f0fe88303e53e942f83172a49584c017f2b25) | Active |
| 2026-01-27T17:31:20Z | 1.2.0 | prod9 | `5b36e4872c39728ae875d1f086f8431161a5a9ee03591a262cd0cca1b2c3e024` | pending | Active |

## How to Read This Log

- **Timestamp**: UTC time when deployment completed
- **Version**: Semantic version from `enclave/src/version.ts`
- **Machine**: Phala Cloud cluster (prod7, prod9)
- **Compose Hash**: SHA256 of `docker-compose.yml` - verifiable via attestation
- **On-Chain TX**: Base transaction logging the compose hash
- **Status**: `Active` (running), `Replaced` (superseded by newer version)

## Verification

To verify a deployment:

1. **Check compose hash matches attestation**:
   ```bash
   curl https://toy-example-<machine>.phala.network:8090/compose-hash
   ```

2. **Verify on-chain record**:
   - Click the TX link to view on BaseScan
   - The logged hash should match the compose hash

3. **Compare source code**:
   ```bash
   git checkout <commit-sha>
   sha256sum toy-example-app/enclave/docker-compose.yml
   ```

## On-Chain Contract

All deployments are logged to:
- **Network**: Base Mainnet
- **Contract**: `0x2f83172A49584C017F2B256F0FB2Dca14126Ba9C`
- **Purpose**: Permanent, tamper-proof deployment audit trail

## Related Documentation

- [Upgrade Guide](docs/UPGRADE-GUIDE.md) - How to release new versions
- [Multi-Machine](docs/MULTI-MACHINE.md) - Multi-cluster deployment
- [Verification](docs/VERIFICATION.md) - Manual attestation verification
