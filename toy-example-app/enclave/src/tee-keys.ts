// TEE Key Derivation Module
//
// Derives cryptographic keys from the TEE's persistent root key via dstack.
// Keys are deterministic and bound to:
// 1. The app's compose hash (code identity)
// 2. The TEE's hardware attestation
// 3. The derivation path
//
// This ensures a modified app or different code version gets DIFFERENT keys,
// making signatures non-replayable across code versions.

import { DstackClient } from '@phala/dstack-sdk';

// Cached client and keys
let dstackClient: DstackClient | null = null;
let signingKey: Buffer | null = null;
let teeAvailable: boolean | null = null;

/**
 * Initialize the dstack client.
 * In production, connects via Unix socket to TEE agent.
 * In development, can use simulator endpoint.
 */
function getClient(): DstackClient {
  if (!dstackClient) {
    // DstackClient auto-detects:
    // 1. DSTACK_SIMULATOR_ENDPOINT env var (for dev)
    // 2. Unix socket paths: /var/run/dstack.sock, etc. (for production)
    dstackClient = new DstackClient();
  }
  return dstackClient;
}

/**
 * Check if running inside a TEE (dstack agent available).
 * Caches the result for performance.
 */
export async function isTeeAvailable(): Promise<boolean> {
  if (teeAvailable !== null) {
    return teeAvailable;
  }

  try {
    const client = getClient();
    teeAvailable = await client.isReachable();
  } catch {
    teeAvailable = false;
  }

  return teeAvailable;
}

/**
 * Derive the signing key from TEE.
 *
 * The key is derived using:
 * - path: 'signing' (identifies this key's purpose)
 * - purpose: 'hmac-signing' (how the key will be used)
 *
 * Returns a Buffer suitable for HMAC-SHA256 operations.
 *
 * In development mode (no TEE), returns a deterministic dev key with warning.
 */
export async function getSigningKey(): Promise<Buffer> {
  if (signingKey) {
    return signingKey;
  }

  const available = await isTeeAvailable();

  if (available) {
    console.log('[TEE] Deriving signing key from TEE persistent key...');
    try {
      const client = getClient();
      // getKey returns a key derived from TEE root, bound to app identity
      // The key is returned as Uint8Array
      const keyResponse = await client.getKey('signing', 'hmac-signing');

      // Convert Uint8Array to Buffer
      signingKey = Buffer.from(keyResponse.key);
      console.log('[TEE] Signing key derived successfully (TEE-bound)');
    } catch (error) {
      console.error('[TEE] Failed to derive key from TEE:', error);
      throw error;
    }
  } else {
    // Development fallback - NOT FOR PRODUCTION
    console.warn('[TEE] ================================================');
    console.warn('[TEE] WARNING: TEE not available, using development key');
    console.warn('[TEE] This key is NOT bound to TEE attestation!');
    console.warn('[TEE] DO NOT USE IN PRODUCTION');
    console.warn('[TEE] ================================================');
    // Use a deterministic dev key
    signingKey = Buffer.from('dev-signing-key-not-for-production', 'utf-8');
  }

  return signingKey;
}

/**
 * Get TEE info including app identity.
 * Returns null if not running in TEE.
 */
export async function getTeeInfo(): Promise<{
  appId: string;
  instanceId: string;
  composeHash: string;
} | null> {
  const available = await isTeeAvailable();
  if (!available) {
    return null;
  }

  try {
    const client = getClient();
    const info = await client.info();
    return {
      appId: info.app_id || 'unknown',
      instanceId: info.instance_id || 'unknown',
      composeHash: info.compose_hash || 'unknown',
    };
  } catch (error) {
    console.error('[TEE] Failed to get TEE info:', error);
    return null;
  }
}

/**
 * Sign data using TEE-derived key.
 * Uses HMAC-SHA256 with the derived signing key.
 */
export async function signWithTeeKey(data: string): Promise<string> {
  const { createHmac } = await import('crypto');
  const key = await getSigningKey();
  return createHmac('sha256', key).update(data).digest('hex');
}
