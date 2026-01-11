# Xordi Release Process

Release process documentation for the Xordi TikTok data collection enclave running on Phala Cloud dstack.

## Documents

| File | Purpose |
|------|---------|
| [VERIFICATION-REPORT.md](docs/VERIFICATION-REPORT.md) | Current attestation status, gaps, trust boundaries |
| [RELEASE-CHECKLIST.md](docs/RELEASE-CHECKLIST.md) | Prescriptive release process with transparency requirements |
| [TWEET-CONTENT.md](docs/TWEET-CONTENT.md) | Ready-to-post announcement content |
| [deploy-xordi.yml](docs/workflows/deploy-xordi.yml) | GitHub Actions CI/CD template |

## Current Deployment

- **App ID:** `8b7f9f28fde9764b483ac987c68f3321cb7276b0`
- **Trust Center:** https://trust.phala.com/app/8b7f9f28fde9764b483ac987c68f3321cb7276b0
- **Metadata:** https://8b7f9f28fde9764b483ac987c68f3321cb7276b0-8090.dstack-pha-prod9.phala.network/

---

## Action Items by Person

### LSDan

- [ ] **Create simplified toy example app** - Andrew was explicit: "generalized comes later" - build a simplified dstack app FIRST that:
  - Runs a mock TikTok API with two endpoints: `watch_history` (safe) and `direct_messages` (bad)
  - Has an enclave that gets full credentials but can ONLY access the safe endpoint
  - Demonstrates the complete release process end-to-end
  - This becomes the template for generalizing later

- [x] **Remove `.well-known/attestation` gap from VERIFICATION-REPORT.md** - Not applicable to Xordi since users never directly contact the server (only Archive calls it). The 8090 metadata service already provides attestation data.

- [x] **Simplify trust boundaries diagram in VERIFICATION-REPORT.md** - Remove "Archive" and everything below the trust boundary line. Focus only on the cryptographically verified TCB.

- [ ] **Continue scanning Telegram** for Andrew's notes/gaps - he'll drop thoughts as they occur

### Ian

- [ ] **Fork/clone this repo** into Xordi repos - own the Xordi-specific version going forward

- [ ] **Make Docker images public** - Current images on `ghcr.io/ognodefather/...` are private. Can stay on GHCR, just make public.

- [ ] **Build CI/CD pipeline** - Convert manual release process to automated GitHub Actions. "Pipeline wouldn't be hard."

- [ ] **Implement user count attestation** - Count encrypted cookie entries in database, sign with enclave. Proves number of users without exposing usernames.

- [ ] **Vegas trip** - Install PSU on rack for power redundancy (data center power anomaly issues)

### Andrew

- [ ] **Continue "hater mode"** - Probing for gaps in other projects (Near, Signal) to identify patterns

- [ ] **Drop Telegram notes** when gaps/requirements come to mind

- [ ] **Red team analysis** - Validate constraints by checking: "Could I satisfy these constraints while still stealing DMs?"

### Claude

- [x] Create separate repo with release docs
- [x] Apply doc updates (`.well-known/attestation`, trust diagram) when instructed
- [ ] Do NOT update deployment data without instruction

---

## Path Dependencies (Critical Ordering)

```
1. Simplified toy example app    →  BEFORE  →  Generalized docs
2. Base KMS + reproducible builds  →  FIRST   →  Everything else
3. Images public                 →  BEFORE  →  External verification possible
4. User count attestation        →  BEFORE  →  Full consent flow
```

**Andrew explicitly said:** "Generalized is even harder to get to... a simplified DStack app that has the release process... that would be a really good way to make progress without being stuck on exactly the Xordi-specific issues."

---

## Key Decisions from Jan 10 Call

| Decision | Rationale |
|----------|-----------|
| `.well-known/attestation` NOT needed | Users never directly contact server; 8090 metadata already provides this |
| Focus TCB only in diagram | Exclude Borg Cube, Archive - they're outside attestation boundary |
| Simplified toy example FIRST | Before generalizing - proves the pattern works |
| User count attestation FIRST | Simpler than full consent language flow |
| Consent served from TEE | Future enhancement - similar to Boo Magic Show signup |

---

## The Core Constraint

From Andrew:

> "The goal is to say we have some process for validating but even if someone follows that process to validate we would still be able to steal DMs from users TikTok accounts"

The release process must prove that for the claimed number of users, during the claimed time period, the running code was **incapable** of accessing DMs.

**Retrospective audit framing:** "We want to be able to show in March what we did during January and February" - even if the app is shut down, the audit trail should prove we never could have stolen DMs.

**What we CAN prove:**
- Exact code running matches published source (attestation)
- Code runs in hardware isolation (Intel TDX)
- Number of users whose credentials were processed
- Every compose hash update on the Base contract

**What requires code audit:**
- That the code only calls watch history APIs, not DM APIs
- `grep -r "direct_message" src/` returns nothing

---

## Immediate Priority (The "Zero Step")

1. **Move to Base KMS** - Switch from Pha KMS to Base on-chain KMS for transparency logging. "The one thing that needs to change" (Andrew, Dec 30).

2. **Reproducible builds** - Ensure tagged commits match Docker image digests. Verify builds work across machines.

3. **Make images public** - So external parties can verify docker-compose points to inspectable images.

---

## Related Repos

- **Xordi Source:** https://github.com/Account-Link/teleport-tokscope (branch: `tokscope-xordi-perf`)
- **dstack Tutorial:** https://github.com/amiller/dstack-tutorial
- **Hermes (reference):** https://github.com/amiller/hermes
