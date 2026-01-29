// TEE Enclave Application - Main Entry Point
//
// This application runs inside a Trusted Execution Environment (TEE) on dstack.
// It demonstrates the security pattern where an enclave has full API credentials
// but is architecturally constrained to only access safe endpoints.
//
// Key security properties:
// 1. The enclave receives MOCK_API_TOKEN which could access both endpoints
//    - The code ONLY calls /api/watch_history (see tiktok-client.ts)
//    - This constraint is verifiable through code audit + attestation
//
// 2. The signing key is DERIVED from TEE persistent key (not host-injected)
//    - Signatures prove data came from THIS code version
//    - A modified app would have different compose hash = different key
//
// 3. Audit log provides verifiable count progression
//    - Each signup is signed, proving it was recorded by attested code
//    - Auditors can verify "how many users" via the audit trail
//    - Log is persisted to encrypted storage (survives restarts)

import express, { Request, Response } from 'express';
import { config } from './config';
import { getWatchHistory, TikTokApiError } from './tiktok-client';
import { incrementSignup, getSignedCount, getAuditLog } from './signup-counter';
import { VERSION, getVersionInfo } from './version';
import { isTeeAvailable, getSigningKey } from './tee-keys';
import { verifyStorageAvailable } from './audit-storage';

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

// Signup endpoint - increments the counter with TEE-signed audit entry
app.post('/signup', async (_req: Request, res: Response) => {
  try {
    const newCount = await incrementSignup();
    console.log(`[${new Date().toISOString()}] POST /signup - Count: ${newCount}`);
    res.json({
      message: 'Signup recorded',
      count: newCount,
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Signup error:`, error);
    res.status(500).json({
      error: 'Failed to record signup',
    });
  }
});

// Get signed signup count (for attestation/audit purposes)
app.get('/signup-count', async (_req: Request, res: Response) => {
  try {
    const signedCount = await getSignedCount();
    console.log(`[${new Date().toISOString()}] GET /signup-count - Count: ${signedCount.count}`);
    res.json(signedCount);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Signup count error:`, error);
    res.status(500).json({
      error: 'Failed to get signed count',
    });
  }
});

// Audit log endpoint - full verifiable history of signups
// This proves "how many users" by showing each signup event with TEE-bound signature
app.get('/audit-log', async (_req: Request, res: Response) => {
  try {
    const auditLog = await getAuditLog();
    console.log(`[${new Date().toISOString()}] GET /audit-log - Entries: ${auditLog.entries.length}`);
    res.json(auditLog);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Audit log error:`, error);
    res.status(500).json({
      error: 'Failed to get audit log',
    });
  }
});

// Root endpoint with service info
app.get('/', async (_req: Request, res: Response) => {
  const teeAvailable = await isTeeAvailable();

  res.json({
    name: 'Toy Example Enclave',
    version: VERSION,
    description: 'TEE application demonstrating secure API access patterns',
    endpoints: {
      '/health': 'GET - Health check',
      '/version': 'GET - Version and build metadata',
      '/watch-history': 'GET - Fetch watch history from TikTok API (SAFE)',
      '/signup': 'POST - Record a signup (TEE-signed audit entry)',
      '/signup-count': 'GET - Get signed signup count',
      '/audit-log': 'GET - Full audit log with TEE-bound signatures',
    },
    security: {
      note: 'This enclave has full API credentials but only calls watch_history',
      signingKey: teeAvailable
        ? 'Derived from TEE persistent key (bound to compose hash)'
        : 'Development key (NOT TEE-bound)',
      auditLog: 'Persistent encrypted storage at /data',
      attestation: 'Port 8090 provides TEE attestation metadata (dstack native)',
    },
  });
});

// Start server with initialization
async function start() {
  const versionInfo = getVersionInfo();
  console.log('='.repeat(60));
  console.log(`Toy Example Enclave v${versionInfo.version}`);
  console.log('='.repeat(60));

  // Step 1: Verify encrypted storage is available (FAIL HARD if not)
  console.log('[Startup] Step 1: Verifying encrypted storage...');
  try {
    await verifyStorageAvailable();
  } catch (error) {
    console.error('[Startup] FATAL: Storage verification failed');
    console.error(error instanceof Error ? error.message : String(error));
    console.error('[Startup] Cannot start without persistent encrypted storage');
    process.exit(1);
  }

  // Step 2: Initialize TEE signing key
  console.log('[Startup] Step 2: Initializing TEE signing key...');
  const teeAvailable = await isTeeAvailable();
  if (teeAvailable) {
    try {
      await getSigningKey(); // Pre-derive the key
    } catch (error) {
      console.error('[Startup] FATAL: Failed to derive TEE signing key');
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  } else {
    console.warn('[Startup] WARNING: TEE not available, using development keys');
  }

  // Step 3: Start HTTP server
  console.log('[Startup] Step 3: Starting HTTP server...');
  app.listen(config.port, () => {
    console.log('');
    console.log(`Server running on port ${config.port}`);
    console.log(`Version: ${versionInfo.version} (${versionInfo.gitShaShort})`);
    console.log(`Build time: ${versionInfo.buildTime}`);
    console.log(`Environment: ${versionInfo.environment}`);
    console.log(`Mock API URL: ${config.mockApiUrl}`);
    console.log(`TEE Available: ${teeAvailable}`);
    console.log(`Signing Key: ${teeAvailable ? 'TEE-derived' : 'Development (NOT SECURE)'}`);
    console.log(`Storage: Encrypted persistent (/data)`);
    console.log('');
    console.log('Endpoints:');
    console.log(`  GET  /health        - Health check`);
    console.log(`  GET  /version       - Version and build metadata`);
    console.log(`  GET  /watch-history - Fetch watch history (SAFE)`);
    console.log(`  POST /signup        - Record signup (TEE-signed, persistent)`);
    console.log(`  GET  /signup-count  - Get signed count`);
    console.log(`  GET  /audit-log     - Full audit log`);
    console.log('');
    console.log('Security note: This enclave only calls /api/watch_history');
    console.log('Attestation available on port 8090 (dstack metadata service)');
    console.log('='.repeat(60));
  });
}

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
