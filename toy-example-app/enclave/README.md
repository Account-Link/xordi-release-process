# TEE Enclave Application

A Trusted Execution Environment (TEE) application that demonstrates secure API access patterns for the release process.

## Security Model

This enclave proves two key security properties:

> **Endpoint Constraint**: The enclave receives full API credentials that **could** access sensitive data,
> but the code **only** calls safe endpoints. This constraint is verifiable through code audit + TEE attestation.

> **Audit Trail**: Every signup is recorded with a TEE-signed audit entry to encrypted persistent storage.
> An auditor can verify "how many users" by checking the signed count and audit log.

### What This Proves

1. **Code Constraint**: `tiktok-client.ts` is the only file making external API calls
2. **Endpoint Constraint**: Only `/api/watch_history` is ever called
3. **Attestation**: TEE proves this exact code is running
4. **Audit Trail**: Base contract logs every compose hash update
5. **User Count**: TEE-signed audit log proves "how many users" signed up

### How to Verify

```bash
# Verify no code calls direct_messages
grep -r "direct_message" src/
# Should return NO results

# The only external API call is in tiktok-client.ts
grep -r "fetch\|axios\|request" src/
# Should only show tiktok-client.ts calling /api/watch_history
```

## Running Locally

### Prerequisites

- Node.js 20+
- Mock TikTok API running on port 3000

### Development

```bash
# Install dependencies
npm install

# Start mock API first (in another terminal)
cd ../mock-api && npm run dev

# Start enclave in development mode
npm run dev
```

### Production Build

```bash
npm run build
NODE_ENV=production MOCK_API_URL=http://mock:3000 MOCK_API_TOKEN=xxx npm start
```

## Docker

```bash
# Build
docker build -t toy-example-enclave .

# Run (with mock API URL)
docker run -p 8080:8080 \
  -e MOCK_API_URL=http://host.docker.internal:3000 \
  -e MOCK_API_TOKEN=demo-token-12345 \
  toy-example-enclave
```

## Endpoints

### `GET /health`
Health check endpoint.

### `GET /watch-history`
Fetches watch history from the mock TikTok API. This is the **only** external
API call the enclave makes.

**Response:**
```json
{
  "source": "tiktok-api",
  "data": {
    "videos": [
      {
        "id": "vid_001",
        "title": "How to Make Perfect Pasta",
        "watchedAt": "2026-01-20T14:30:00Z",
        "duration": 45
      }
    ]
  }
}
```

### `POST /signup`
Records a signup event. Returns the new count.

**Response:**
```json
{
  "message": "Signup recorded",
  "count": 1
}
```

### `GET /signup-count`
Returns the signup count with a TEE-derived cryptographic signature.

**Response:**
```json
{
  "count": 42,
  "signature": "abc123...",
  "timestamp": "2026-01-26T12:00:00Z",
  "teeInfo": {
    "appId": "0x...",
    "composeHash": "abc123..."
  }
}
```

The signature proves this count came from this enclave. The signing key is derived
from the TEE persistent key, bound to the compose hash. A different code version
would produce different signatures.

### `GET /audit-log`
Returns the full audit log with TEE-signed entries for each signup.

**Response:**
```json
{
  "entries": [
    {
      "action": "signup",
      "count": 1,
      "timestamp": "2026-01-26T12:00:00Z",
      "signature": "abc123..."
    }
  ],
  "totalCount": 42,
  "teeAvailable": true,
  "teeInfo": {
    "appId": "0x...",
    "composeHash": "abc123..."
  }
}
```

Each entry is signed with the TEE-derived key, creating a verifiable chain of all
signup events. An auditor can verify each signature matches the TEE's compose hash,
proving the counts came from attested code.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `8080` | Server port |
| `MOCK_API_URL` | Yes (prod) | `http://localhost:3000` | Mock TikTok API URL |
| `MOCK_API_TOKEN` | Yes (prod) | `demo-token-12345` | API bearer token |
| `NODE_ENV` | No | `development` | Environment mode |

Note: The signing key is now derived from the TEE persistent key via dstack SDK.
In development (no TEE available), a deterministic dev key is used with warnings.

## Attestation

When running on dstack, attestation is available on port 8090 (provided by
dstack's metadata service, not this application):

- `GET :8090/attestation` - Full TDX attestation quote
- `GET :8090/compose-hash` - SHA256 of the app-compose structure

**Important**: The compose hash is computed over the full `app-compose.json` structure,
not just `docker-compose.yml`. This structure includes:
- `docker_compose_file`: The embedded docker-compose.yml content
- `manifest_version`: dstack manifest version
- `kms_enabled`: Whether KMS is enabled
- Other deployment metadata

The compose hash links the attestation to this specific configuration,
which in turn links to the source code via the image tag. See `docs/VERIFICATION.md`
for details on reconstructing and verifying the compose hash.

## Encrypted Storage

The audit log is persisted to LUKS-encrypted storage at `/data`. dstack provides
this volume with keys derived from KMS, bound to the app identity. The application
will fail to start if `/data` is not available and writable.
