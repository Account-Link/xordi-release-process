// TEE Enclave Application - Main Entry Point
//
// This application runs inside a Trusted Execution Environment (TEE) on dstack.
// It demonstrates the security pattern where an enclave has full API credentials
// but is architecturally constrained to only access safe endpoints.
//
// Key security property:
// - The enclave receives MOCK_API_TOKEN which could access both endpoints
// - The code ONLY calls /api/watch_history (see tiktok-client.ts)
// - This constraint is verifiable through code audit + attestation

import express, { Request, Response } from 'express';
import { config } from './config';
import { getWatchHistory, TikTokApiError } from './tiktok-client';
import { incrementSignup, getSignedCount } from './signup-counter';
import { VERSION, getVersionInfo } from './version';

const app = express();
app.use(express.json());

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'toy-example-enclave',
    timestamp: new Date().toISOString(),
  });
});

// Version endpoint - returns build metadata for traceability
app.get('/version', async (_req: Request, res: Response) => {
  const versionInfo = getVersionInfo();

  // Try to fetch compose hash from dstack metadata service
  let composeHash = 'unavailable';
  try {
    const response = await fetch('http://localhost:8090/compose-hash');
    if (response.ok) {
      const data = await response.text();
      composeHash = data.trim();
    }
  } catch {
    // Metadata service not available (e.g., running locally)
  }

  res.json({
    ...versionInfo,
    composeHash,
  });
});

// Proxy to watch history endpoint (SAFE)
// This is the ONLY endpoint that calls the external API
app.get('/watch-history', async (_req: Request, res: Response) => {
  try {
    console.log(`[${new Date().toISOString()}] GET /watch-history - Fetching from API`);
    const watchHistory = await getWatchHistory();
    res.json({
      source: 'tiktok-api',
      data: watchHistory,
    });
  } catch (error) {
    if (error instanceof TikTokApiError) {
      console.error(`[${new Date().toISOString()}] API Error: ${error.message}`);
      res.status(error.statusCode).json({
        error: 'Failed to fetch watch history',
        details: error.message,
      });
    } else {
      console.error(`[${new Date().toISOString()}] Unexpected error:`, error);
      res.status(500).json({
        error: 'Internal server error',
      });
    }
  }
});

// Signup endpoint - increments the counter
app.post('/signup', (_req: Request, res: Response) => {
  const newCount = incrementSignup();
  console.log(`[${new Date().toISOString()}] POST /signup - Count: ${newCount}`);
  res.json({
    message: 'Signup recorded',
    count: newCount,
  });
});

// Get signed signup count (for attestation/audit purposes)
app.get('/signup-count', (_req: Request, res: Response) => {
  const signedCount = getSignedCount();
  console.log(`[${new Date().toISOString()}] GET /signup-count - Count: ${signedCount.count}`);
  res.json(signedCount);
});

// Root endpoint with service info
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'Toy Example Enclave',
    version: VERSION,
    description: 'TEE application demonstrating secure API access patterns',
    endpoints: {
      '/health': 'GET - Health check',
      '/version': 'GET - Version and build metadata',
      '/watch-history': 'GET - Fetch watch history from TikTok API (SAFE)',
      '/signup': 'POST - Record a signup',
      '/signup-count': 'GET - Get signed signup count',
    },
    security: {
      note: 'This enclave has full API credentials but only calls watch_history',
      attestation: 'Port 8090 provides TEE attestation metadata (dstack native)',
    },
  });
});

// Start server
app.listen(config.port, () => {
  const versionInfo = getVersionInfo();
  console.log('='.repeat(60));
  console.log(`Toy Example Enclave v${versionInfo.version}`);
  console.log('='.repeat(60));
  console.log(`Server running on port ${config.port}`);
  console.log(`Version: ${versionInfo.version} (${versionInfo.gitShaShort})`);
  console.log(`Build time: ${versionInfo.buildTime}`);
  console.log(`Environment: ${versionInfo.environment}`);
  console.log(`Mock API URL: ${config.mockApiUrl}`);
  console.log('');
  console.log('Endpoints:');
  console.log(`  GET  /health        - Health check`);
  console.log(`  GET  /version       - Version and build metadata`);
  console.log(`  GET  /watch-history - Fetch watch history (SAFE)`);
  console.log(`  POST /signup        - Record signup`);
  console.log(`  GET  /signup-count  - Get signed count`);
  console.log('');
  console.log('Security note: This enclave only calls /api/watch_history');
  console.log('Attestation available on port 8090 (dstack metadata service)');
  console.log('='.repeat(60));
});
