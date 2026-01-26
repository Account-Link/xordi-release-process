# Red Team Guide

How to audit this application for vulnerabilities. This document explains what to look for and how to verify the security claims.

## The Security Claim

> "The enclave cannot steal direct messages, even though it has credentials that could access them."

Your job: Try to prove this claim false.

## Attack Surfaces

### 1. Code-Level Attacks

#### Check: Hidden API Calls

**Goal:** Find any code that calls `/api/direct_messages`

```bash
# Search for direct_messages anywhere in enclave
grep -ri "direct_message" enclave/

# Search for the URL pattern
grep -ri "/api/d" enclave/

# Search for message-related terms
grep -ri "message\|dm\|inbox" enclave/src/
```

**Expected Result:** No matches in source code.

#### Check: Dynamic Endpoint Construction

**Goal:** Find code that could construct the sensitive endpoint dynamically

```bash
# Look for string concatenation with API paths
grep -r "api/" enclave/src/ | grep -v "watch_history"

# Look for template literals
grep -r "\`.*api.*\`" enclave/src/

# Look for environment-controlled endpoints
grep -r "process.env.*ENDPOINT\|process.env.*URL.*api" enclave/src/
```

**Expected Result:** All API calls hardcoded to `/api/watch_history`.

#### Check: Fetch/HTTP Calls Outside tiktok-client.ts

**Goal:** Find external network calls outside the designated API client

```bash
# Find all fetch calls
grep -rn "fetch\(" enclave/src/

# Find all HTTP libraries
grep -rn "axios\|request\|http\.\|https\." enclave/src/

# Check imports
grep -rn "import.*fetch\|require.*http" enclave/src/
```

**Expected Result:** Only `tiktok-client.ts` makes external calls.

### 2. Configuration-Level Attacks

#### Check: Compose File Manipulation

**Goal:** Find ways to inject malicious code via configuration

```bash
# Check docker-compose.yml for:
# - Volume mounts that could inject code
# - Environment variables that control behavior
# - Entrypoint/command overrides
cat enclave/docker-compose.yml
```

**Questions to Answer:**
- Can environment variables change which endpoints are called?
- Are there any bind mounts that could modify code?
- Is the image tag pinned or floating?

#### Check: Dockerfile Security

**Goal:** Find supply chain vulnerabilities

```bash
# Check Dockerfile for:
# - Unpinned base images
# - curl/wget of external scripts
# - npm install from arbitrary sources
cat enclave/Dockerfile
```

**Questions to Answer:**
- Is the base image pinned to a digest?
- Are dependencies locked (package-lock.json)?
- Any post-install scripts that could modify code?

### 3. Runtime Attacks

#### Check: Environment Variable Injection

**Goal:** Could an operator inject a different API URL?

Look at `config.ts`:
```typescript
// Is there validation that MOCK_API_URL is the expected host?
// Could someone set MOCK_API_URL to a malicious server?
```

**Mitigation Assessment:**
- Even if URL is changed, code still only calls `/api/watch_history`
- But a malicious server could log requests with the token
- Consider: Is the token the threat, or the endpoint?

#### Check: Dependency Vulnerabilities

```bash
cd enclave
npm audit

# Check for known vulnerabilities
npm audit --audit-level=high
```

#### Check: Prototype Pollution / Injection

```bash
# Look for JSON.parse of untrusted input
grep -rn "JSON.parse" enclave/src/

# Look for eval or Function constructor
grep -rn "eval\|Function\(" enclave/src/
```

### 4. Attestation Attacks

#### Check: Compose Hash Collision

**Goal:** Create a malicious compose file with the same hash

**Reality Check:** SHA256 collision is computationally infeasible (2^128 operations).

#### Check: Attestation Replay

**Goal:** Present old attestation for modified code

**Mitigation:** Attestation includes timestamp and is signed by TEE hardware.

#### Check: Fake Attestation

**Goal:** Generate attestation without running in TEE

**Mitigation:** TDX quotes are signed by Intel's attestation service. Verification checks the signature chain.

### 5. Social Engineering Attacks

#### Check: Misleading Documentation

**Goal:** Find docs that make false security claims

- Does README overstate security guarantees?
- Are limitations clearly documented?
- Could a user be misled about what's verified?

#### Check: Verification Script Tampering

**Goal:** Modify verification script to always pass

```bash
# Check the verification script for:
# - Hardcoded "pass" results
# - Skipped checks
# - Misleading output
cat scripts/verify-attestation.sh
```

## Verification Checklist

Use this checklist when auditing:

### Code Audit

- [ ] No references to `direct_messages` in source
- [ ] All `fetch` calls isolated to `tiktok-client.ts`
- [ ] `tiktok-client.ts` only calls `/api/watch_history`
- [ ] No dynamic endpoint construction
- [ ] No eval/Function/vm usage

### Configuration Audit

- [ ] docker-compose.yml has no dangerous mounts
- [ ] Dockerfile uses locked dependencies
- [ ] No post-install scripts modify code
- [ ] Image tags are commit SHAs, not `latest`

### Dependency Audit

- [ ] No critical vulnerabilities in `npm audit`
- [ ] package-lock.json is committed
- [ ] Dependencies are from npm registry only

### Attestation Audit

- [ ] Compose hash matches expected
- [ ] TDX quote verifies against Intel root
- [ ] Base contract has hash logged
- [ ] Timestamp is recent (not replay)

## Reporting Vulnerabilities

If you find a vulnerability:

1. **Do not** publicly disclose immediately
2. Document the attack path clearly
3. Assess the impact (what data could be accessed?)
4. Contact the team via [security contact method]
5. Allow time for remediation before disclosure

## Known Limitations

These are **not** vulnerabilities - they're documented limitations:

1. **Token can be exfiltrated:** The enclave has the API token. A malicious version could send it elsewhere. TEE only proves *this* code runs; it doesn't prevent *different* code.

2. **TEE hardware trust:** If Intel TDX is compromised, all bets are off.

3. **In-memory counter resets:** The signup count is not persistent. This is intentional for the demo.

4. **No request authentication:** Anyone can call the enclave endpoints. This is a demo - production would add auth.

## Test Cases

### Test 1: Modify tiktok-client.ts

1. Add a function to call `direct_messages`
2. Rebuild and deploy
3. Verify: Compose hash changes
4. Verify: Base contract logs new hash
5. Verify: Old attestation is invalid

### Test 2: Add Secret Logging

1. Add `console.log(config.mockApiToken)` to index.ts
2. Check if token appears in container logs
3. Verify: Logs are internal to TEE, not externally accessible

### Test 3: Verification Script Bypass

1. Modify `verify-attestation.sh` to always return success
2. Run against a modified enclave
3. Verify: Only local script is affected; remote attestation still valid
