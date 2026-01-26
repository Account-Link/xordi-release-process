import express, { Request, Response, NextFunction } from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

// Expected token for authentication
const VALID_TOKEN = process.env.API_TOKEN || 'demo-token-12345';

// Middleware to check authorization
function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({ error: 'Missing Authorization header' });
    return;
  }

  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || token !== VALID_TOKEN) {
    res.status(403).json({ error: 'Invalid or expired token' });
    return;
  }

  next();
}

// SAFE endpoint - Watch History
// This endpoint returns non-sensitive viewing data
app.get('/api/watch_history', requireAuth, (_req: Request, res: Response) => {
  const watchHistory = {
    videos: [
      {
        id: 'vid_001',
        title: 'How to Make Perfect Pasta',
        watchedAt: '2026-01-20T14:30:00Z',
        duration: 45,
      },
      {
        id: 'vid_002',
        title: 'Cat Compilation #47',
        watchedAt: '2026-01-20T15:00:00Z',
        duration: 120,
      },
      {
        id: 'vid_003',
        title: 'JavaScript Tips and Tricks',
        watchedAt: '2026-01-21T09:15:00Z',
        duration: 180,
      },
      {
        id: 'vid_004',
        title: 'Morning Workout Routine',
        watchedAt: '2026-01-22T06:00:00Z',
        duration: 600,
      },
      {
        id: 'vid_005',
        title: 'Travel Vlog: Tokyo',
        watchedAt: '2026-01-22T20:45:00Z',
        duration: 900,
      },
    ],
  };

  console.log(`[${new Date().toISOString()}] GET /api/watch_history - OK`);
  res.json(watchHistory);
});

// SENSITIVE endpoint - Direct Messages
// This endpoint returns private messages - the enclave must NOT call this
app.get('/api/direct_messages', requireAuth, (_req: Request, res: Response) => {
  const directMessages = {
    messages: [
      {
        id: 'msg_001',
        from: 'alice_secret',
        content: 'Hey, here is my social security number: 123-45-6789',
        timestamp: '2026-01-20T10:00:00Z',
      },
      {
        id: 'msg_002',
        from: 'bob_private',
        content: 'My bank account PIN is 4521',
        timestamp: '2026-01-21T11:30:00Z',
      },
      {
        id: 'msg_003',
        from: 'carol_confidential',
        content: 'The launch codes are: ALPHA-BRAVO-7734',
        timestamp: '2026-01-22T08:15:00Z',
      },
    ],
  };

  // Log with warning since this endpoint should not be accessed
  console.warn(`[${new Date().toISOString()}] GET /api/direct_messages - SENSITIVE ENDPOINT ACCESSED`);
  res.json(directMessages);
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'mock-tiktok-api' });
});

// Root endpoint with API info
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'Mock TikTok API',
    version: '1.0.0',
    endpoints: {
      '/api/watch_history': 'GET - Returns watch history (SAFE)',
      '/api/direct_messages': 'GET - Returns direct messages (SENSITIVE)',
      '/health': 'GET - Health check',
    },
    auth: 'Bearer token required for /api/* endpoints',
  });
});

app.listen(PORT, () => {
  console.log(`Mock TikTok API running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`\nEndpoints requiring Bearer token:`);
  console.log(`  GET /api/watch_history   - SAFE (watch data)`);
  console.log(`  GET /api/direct_messages - SENSITIVE (private messages)`);
});
