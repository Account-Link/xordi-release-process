# TEE Enclave Application

A Trusted Execution Environment (TEE) application that demonstrates secure API access patterns for the release process.

## Security Model

This enclave proves a key security property:

> The enclave receives full API credentials that **could** access sensitive data,
> but the code **only** calls safe endpoints. This constraint is verifiable
> through code audit combined with TEE attestation.

### What This Proves

1. **Code Constraint**: `tiktok-client.ts` is the only file making external API calls
2. **Endpoint Constraint**: Only `/api/watch_history` is ever called
3. **Attestation**: TEE proves this exact code is running
4. **Audit Trail**: Base contract logs every compose hash update

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
Returns the signup count with a cryptographic signature.

**Response:**
```json
{
  "count": 42,
  "signature": "abc123...",
  "timestamp": "2026-01-26T12:00:00Z"
}
```

The signature proves this count came from this enclave. Combined with
attestation, this provides a verifiable audit trail.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `8080` | Server port |
| `MOCK_API_URL` | Yes (prod) | `http://localhost:3000` | Mock TikTok API URL |
| `MOCK_API_TOKEN` | Yes (prod) | `demo-token-12345` | API bearer token |
| `SIGNING_KEY` | No | dev key | Key for signing counts |
| `NODE_ENV` | No | `development` | Environment mode |

## Attestation

When running on dstack, attestation is available on port 8090 (provided by
dstack's metadata service, not this application):

- `GET :8090/attestation` - Full TDX attestation quote
- `GET :8090/compose-hash` - SHA256 of docker-compose.yml

The compose hash links the attestation to this specific configuration,
which in turn links to the source code via the image tag.
