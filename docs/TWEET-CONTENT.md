# Tweet-Ready Content for Xordi TEE Verification

**Purpose:** Ready-to-post content for Andrew to use in tweets, addressing his original request:
> "I want to point in tweets to the tokscope enclave repo... provide a clear explanation of how we give evidence we aren't misusing the user data"

---

## Option 1: Short Thread (3 tweets)

### Tweet 1/3
```
How does Xordi prove we're not stealing your TikTok DMs?

Hardware attestation.

The code runs inside Intel TDX - a hardware-isolated enclave that not even our servers can peek into.

Here's the cryptographic proof:
```

### Tweet 2/3
```
You can verify this yourself:

1. Check the TEE attestation:
   trust.phala.com/app/8b7f9f28fde9764b483ac987c68f3321cb7276b0

2. Review the source code:
   github.com/Account-Link/teleport-tokscope

The attestation proves THIS code is running.
```

### Tweet 3/3
```
What the attestation DOES prove:
- Exact code running matches published source
- Code runs in hardware isolation
- We cannot access memory/secrets

What requires code audit:
- The code only requests watch history
- DMs/messages are never accessed

Full verification report: [link to VERIFICATION-REPORT.md]
```

---

## Option 2: Single Tweet (280 chars)

```
Xordi runs in a hardware TEE - we literally cannot see your data.

Verify yourself:
- Attestation: trust.phala.com/app/8b7f9f28...
- Source: github.com/Account-Link/teleport-tokscope

The hardware proves we run the published code.
```

---

## Option 3: Technical Thread (for crypto/security audience)

### Tweet 1/4
```
Thread: How Xordi uses TEE attestation to prove non-custodial access

We run on @PhalaNetwork's dstack (Intel TDX). Here's the verification chain:
```

### Tweet 2/4
```
The chain of trust:

GitHub commit SHA
    ↓ (build)
DockerHub image digest
    ↓ (deploy)
TEE measurements (MRTD, RTMRs)
    ↓ (attest)
Intel-signed TDQuote

Each step is cryptographically linked.
```

### Tweet 3/4
```
What you can verify:

1. Trust Center shows all 30 attestation objects pass:
   trust.phala.com/app/8b7f9f28...

2. Source code shows we only call watch history APIs:
   github.com/Account-Link/teleport-tokscope

grep -r "direct_message" src/  # returns nothing
```

### Tweet 4/4
```
Current limitation we're fixing:

We use Pha KMS which doesn't publish upgrade events publicly.

Switching to Base on-chain KMS will create a transparency log of every deployment.

Full report: [link]
```

---

## Option 4: Announcement Tweet (for product launch)

```
Xordi now runs with full TEE attestation.

What this means for you:
- Your TikTok session runs in hardware isolation
- Only watch history is accessed (verifiable in source)
- We literally cannot see your DMs

Verify: trust.phala.com/app/8b7f9f28...
Source: github.com/Account-Link/teleport-tokscope
```

---

## Key Links to Include

| Purpose | URL | Shorthand |
|---------|-----|-----------|
| Trust Center | https://trust.phala.com/app/8b7f9f28fde9764b483ac987c68f3321cb7276b0 | trust.phala.com/app/8b7f9f28... |
| Source Repo | https://github.com/Account-Link/teleport-tokscope | github.com/Account-Link/teleport-tokscope |
| Verification Report | [To be hosted] | [link to VERIFICATION-REPORT.md] |
| Live Demo | https://demo.xordi.io | demo.xordi.io |

---

## FAQ Responses (for replies)

### "How do I know the attestation is real?"
```
The attestation is signed by Intel hardware, not by us.

You can verify it yourself:
1. Fetch the quote from the Trust Center
2. Verify against Intel's attestation service
3. Check the measurements match the published source

No trust in us required - it's hardware-enforced.
```

### "What stops you from deploying malicious code?"
```
Two things:

1. Source is open - anyone can audit
2. Attestation proves which code runs

We're also implementing transparency logging so every deployment is recorded on-chain.

Current gap: using Pha KMS (no public log). Switching to Base KMS soon.
```

### "Why should I trust Phala?"
```
You don't have to trust Phala either.

The attestation is signed by Intel TDX hardware. Phala hosts but cannot access the enclave.

Verify yourself:
- Intel TDX attestation: cryptographically verified
- Code in enclave: open source, auditable
```

---

## Images/Diagrams to Attach

Consider creating:
1. Trust boundary diagram (from VERIFICATION-REPORT.md)
2. Chain of trust flow diagram
3. Screenshot of Trust Center showing green verification status

---

## Hashtags

```
#TEE #IntelTDX #VerifiableCompute #PhalaNetwork #TikTok #Privacy
```
