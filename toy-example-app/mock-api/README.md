# Mock TikTok API

A simple mock API service that simulates TikTok's API with two endpoint types:
- **Safe endpoint:** `/api/watch_history` - Returns non-sensitive viewing data
- **Sensitive endpoint:** `/api/direct_messages` - Returns private message data

## Purpose

This mock API demonstrates the security constraint proven by the TEE enclave:

> The enclave receives credentials that **could** access both endpoints, but the
> code only calls the safe endpoint (`watch_history`). The sensitive endpoint
> (`direct_messages`) exists and is accessible with the same token, but the
> enclave never calls it.

## Running Locally

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Production build
npm run build
npm start
```

## Docker

```bash
# Build
docker build -t mock-tiktok-api .

# Run
docker run -p 3000:3000 mock-tiktok-api
```

## Endpoints

### `GET /api/watch_history`
Returns fake watch history data. **This is the SAFE endpoint.**

**Authentication:** `Authorization: Bearer demo-token-12345`

**Response:**
```json
{
  "videos": [
    {
      "id": "vid_001",
      "title": "How to Make Perfect Pasta",
      "watchedAt": "2026-01-20T14:30:00Z",
      "duration": 45
    }
  ]
}
```

### `GET /api/direct_messages`
Returns fake direct messages. **This is the SENSITIVE endpoint.**

**Authentication:** `Authorization: Bearer demo-token-12345`

**Response:**
```json
{
  "messages": [
    {
      "id": "msg_001",
      "from": "alice_secret",
      "content": "Hey, here is my social security number: 123-45-6789",
      "timestamp": "2026-01-20T10:00:00Z"
    }
  ]
}
```

### `GET /health`
Health check endpoint (no auth required).

### `GET /`
API information (no auth required).

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `API_TOKEN` | `demo-token-12345` | Valid bearer token |

## Security Note

This is a mock service for demonstration purposes. The "sensitive" data is
fake but illustrates what real sensitive data (DMs, personal info) would look like.

The key point: **both endpoints use the same authentication token**. The enclave
has credentials to call both, but its code only calls the safe endpoint.
