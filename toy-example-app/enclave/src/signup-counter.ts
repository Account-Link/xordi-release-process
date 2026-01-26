// Signup Counter with Attestation Signing
//
// Tracks how many "signups" have occurred and provides signed counts
// for retrospective audit purposes.
//
// In production, the signing key would be derived from TEE attestation,
// making the signature verifiable as coming from this specific enclave.

import { createHmac } from 'crypto';
import { config } from './config';

// In-memory counter (resets on restart - acceptable for demo)
let signupCount = 0;

export interface SignupCountResponse {
  count: number;
  signature: string;
  timestamp: string;
}

/**
 * Increment the signup counter.
 * Returns the new count.
 */
export function incrementSignup(): number {
  signupCount += 1;
  console.log(`[Signup] Count incremented to ${signupCount}`);
  return signupCount;
}

/**
 * Get the current signup count with a cryptographic signature.
 *
 * The signature proves this count came from this enclave. In production,
 * the signing key is derived from TEE attestation, so the signature
 * can be verified against the attestation quote.
 */
export function getSignedCount(): SignupCountResponse {
  const timestamp = new Date().toISOString();
  const message = `count:${signupCount}|timestamp:${timestamp}`;

  // HMAC signature using the enclave's signing key
  const signature = createHmac('sha256', config.signingKey)
    .update(message)
    .digest('hex');

  return {
    count: signupCount,
    signature,
    timestamp,
  };
}

/**
 * Get the raw count without signature (for internal use).
 */
export function getCount(): number {
  return signupCount;
}

/**
 * Reset the counter (for testing only).
 */
export function resetCount(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Cannot reset counter in production');
  }
  signupCount = 0;
}
