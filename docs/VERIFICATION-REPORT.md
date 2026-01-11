# Xordi TEE Verification Report

**Report Date:** 2026-01-10 (Updated)
**Verifier:** LSDan (prompted by Andrew Miller)
**App ID:** `8b7f9f28fde9764b483ac987c68f3321cb7276b0`
**Instance ID:** `e6391e13598008c12907a2732937486bb67b3eda`
**Domain:** dstack-pha-prod9.phala.network
**dstack Version:** DStack 0.5.3 (Kernel 6.9.0-dstack)

---

## Executive Summary

Xordi is a TikTok data collection service (watch history, authentication) running in a Trusted Execution Environment (TEE) on Phala Cloud's dstack infrastructure. This report documents the current verification status and identifies gaps that need to be addressed.

**Key Finding:** The enclave is deployed and attestation-verified by Phala's Trust Center, but **transparency logging is not enabled** because the deployment uses Pha KMS instead of Base on-chain KMS.

---

## Verification Summary

| Check | Status | Details |
|-------|--------|---------|
| TEE Attestation | PASS | 30 data objects verified by Trust Center |
| Hardware Integrity | PASS | Intel TDX quote verified (Dec 11, 2025) |
| KMS Signature | PASS | Signed by Phala KMS |
| Gateway Verification | PASS | dstack gateway attestation valid |
| **Transparency Log** | **FAIL** | Pha KMS does not publish upgrade events publicly |
| **Reproducible Build** | **PENDING** | RTMR3 may churn across deployments |
| **Source Provenance** | **PARTIAL** | Source repo exists but no commit-to-image chain documented |

**Overall Status:** PARTIAL VERIFICATION - Core attestation passes, but transparency logging is not enabled.

---

## Trust Center Attestation

**URL:** https://trust.phala.com/app/8b7f9f28fde9764b483ac987c68f3321cb7276b0

### Attestation Timeline

| Event | Timestamp |
|-------|-----------|
| Created | December 11, 2025, 05:21:05 UTC |
| Verification Started | December 11, 2025, 05:21:05 UTC |
| Verification Completed | December 11, 2025, 05:21:21 UTC |
| Last Synced | December 22, 2025, 23:06:01 UTC |

### Verified Components (30 objects)

| Component | Objects Verified |
|-----------|-----------------|
| **App** | cpu, quote, event-logs (IMR 0-3), os, os-code, main, code |
| **KMS** | cpu, quote, event-logs (IMR 0-3), os, os-code, main, code |
| **Gateway** | cpu, quote, event-logs (IMR 0-3), os, os-code, main, code |

---

## What This Proves

### Cryptographically Verified

1. **Hardware Isolation** - The code runs inside an Intel TDX enclave. The hardware generates a signed attestation quote proving isolation.

2. **Specific Code Running** - The attestation includes measurements (MRTD, RTMRs) that uniquely identify the running software stack.

3. **KMS Key Binding** - The application's cryptographic keys are bound to the TEE attestation via Phala's KMS.

### NOT Proven (Trust Required)

1. **Code Behavior** - Attestation proves *which* code is running, not *what* that code does. Claims like "only accesses watch history" require source code audit.

2. **Source-to-Image Chain** - We have not documented the cryptographic chain from GitHub commit to running TEE image.

3. **Upgrade History** - Because Pha KMS is used, there is no public transparency log of upgrades.

---

## Trust Boundaries Diagram

```
              TRUSTED COMPUTE BASE (TCB) - Attestation Covers This
    ┌─────────────────────────────────────────────────────────┐
    │                                                         │
    │   ┌─────────────────────────────────────────────────┐   │
    │   │              Intel TDX Hardware                  │   │
    │   │   ┌─────────────────────────────────────────┐   │   │
    │   │   │           Xordi Enclave                  │   │   │
    │   │   │  - Neko Browser                          │   │   │
    │   │   │  - API Server                            │   │   │
    │   │   │  - TikTok Client (Playwright)            │   │   │
    │   │   └─────────────────────────────────────────┘   │   │
    │   │                      │                          │   │
    │   │              ┌───────┴───────┐                  │   │
    │   │              │  dstack SDK   │                  │   │
    │   │              │  TDQuote      │                  │   │
    │   │              │  :8090 meta   │                  │   │
    │   │              └───────────────┘                  │   │
    │   └─────────────────────────────────────────────────┘   │
    │                          │                              │
    │                  ┌───────┴───────┐                      │
    │                  │  Phala KMS    │ ← Pha KMS (no public │
    │                  │  (prod7/9)    │   transparency log)  │
    │                  └───────────────┘                      │
    └─────────────────────────────────────────────────────────┘

    Note: Components outside the TCB (Archive, Borg Cube, etc.) are
    excluded from this diagram. Attestation only covers what runs
    inside the enclave. External components require separate trust.
```

---

## Current Gaps

### Gap 1: No Transparency Log (CRITICAL)

**Problem:** Xordi uses Pha KMS which does not publish upgrade events publicly. From Shelven Zhou (Dec 23):

> "To be publicly visible you need to use onchain kms... The pha kms is reserved for other customers who don't want to publish the update events"

**Impact:** Users cannot independently verify upgrade history. An operator could deploy malicious code, exfiltrate data, then redeploy legitimate code with no evidence trail.

**Fix:** Switch from Pha KMS to Base on-chain KMS. Andrew (Dec 30): "I suspect that the only thing that needs to change is just choosing to release it on base"

### Gap 2: No Source-to-Image Chain

**Problem:** We have not documented the cryptographic link between:
- GitHub commit SHA
- DockerHub image digest
- TEE attestation measurements

**Impact:** Users cannot verify the running code matches published source.

**Fix:** Implement CI/CD workflow following Hermes pattern with SHA-tagged images.

---

## Source Repository

**Repository:** https://github.com/Account-Link/teleport-tokscope
**Branch:** tokscope-xordi-perf
**Compose File:** docker-compose-audit.yml

### Code Behavior Claims (Require Audit)

Based on source code review, the enclave:

- **DOES** access TikTok watch history via API
- **DOES** handle TikTok authentication cookies
- **DOES NOT** access DMs (API endpoints not called)
- **DOES NOT** access messages or private data

**Note:** These claims are based on code review, not cryptographic proof. A malicious update could change behavior without notice (hence the need for transparency logging).

---

## Verification Steps for Third Parties

### Step 1: Verify Trust Center Attestation

Visit: https://trust.phala.com/app/8b7f9f28fde9764b483ac987c68f3321cb7276b0

Confirm:
- [ ] Verification status shows "Completed"
- [ ] App, KMS, and Gateway components all verified
- [ ] Attestation date is recent

### Step 2: Verify Intel TDX Quote (Advanced)

```bash
# Fetch attestation via Phala API
curl -X POST https://cloud-api.phala.network/api/v1/attestations/verify \
  -H "Content-Type: application/json" \
  -d '{"hex": "YOUR_QUOTE_HEX"}'
```

### Step 3: Review Source Code

```bash
git clone https://github.com/Account-Link/teleport-tokscope.git
cd teleport-tokscope
git checkout tokscope-xordi-perf

# Review API endpoints to confirm no DM access
grep -r "direct_message\|inbox\|dm" src/
```

---

## Recommendations

### Immediate (Required for Trust)

1. **Switch to Base on-chain KMS** - This single change enables transparency logging
2. **Document commit SHA for current deployment** - Record the exact source version running

### Short-Term (Enhanced Verification)

3. **Implement CI/CD with SHA-tagged images** - Follow Hermes GitHub Actions pattern
4. **Create release checklist** - Prescriptive process requiring transparency verification

### Medium-Term (Full Reproducibility)

5. **Achieve reproducible builds** - Pin dependencies, normalize timestamps
6. **Document upgrade history** - On-chain log of all deployments

---

## References

- [Phala Trust Center - Xordi](https://trust.phala.com/app/8b7f9f28fde9764b483ac987c68f3321cb7276b0)
- [Xordi Source Repository](https://github.com/Account-Link/teleport-tokscope/tree/tokscope-xordi-perf)
- [Hermes Verification Report](https://github.com/amiller/hermes/blob/auditing/VERIFICATION-REPORT-2025-12-21.md)
- [dstack Tutorial](https://github.com/amiller/dstack-tutorial)
- [TEE Attestation Explorer](https://proof.t16z.com/)

---

## Changelog

| Date | Author | Changes |
|------|--------|---------|
| 2026-01-05 | LSDan | Initial report based on Trust Center attestation and spec analysis |
| 2026-01-10 | Claude | Removed `.well-known/attestation` gap (not applicable - users never directly contact server; 8090 metadata already provides attestation). Simplified trust boundary diagram to focus on TCB only. |
