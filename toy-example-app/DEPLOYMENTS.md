# Deployment History

Auto-generated deployment log. Each entry represents a verified deployment to Phala Cloud with on-chain transparency logging via Base KMS.

## Active Deployments

| Timestamp | Version | Machine | Compose Hash | On-Chain TX | Status |
|-----------|---------|---------|--------------|-------------|--------|
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
