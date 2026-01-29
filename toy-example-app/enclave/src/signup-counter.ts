// Signup Counter with TEE-Bound Attestation
//
// Tracks how many "signups" have occurred and provides signed counts
// for retrospective audit purposes.
//
// The signing key is derived from the TEE persistent key via dstack,
// making signatures verifiable as coming from this specific enclave
// running this specific code (bound to compose hash).
//
// Security property: A modified app or different code version would
// derive a DIFFERENT signing key, making old signatures invalid for
// that version and preventing signature replay attacks.

import { signWithTeeKey, getTeeInfo, isTeeAvailable } from './tee-keys';
import {
  appendAuditEntry,
  getCurrentCount,
  getAuditEntries,
  AuditEntry,
} from './audit-storage';

export interface SignupCountResponse {
  count: number;
  signature: string;
  timestamp: string;
  teeInfo?: {
    appId: string;
    composeHash: string;
  };
}

export interface AuditLogResponse {
  entries: AuditEntry[];
  totalCount: number;
  teeAvailable: boolean;
  teeInfo?: {
    appId: string;
    composeHash: string;
  };
}

/**
 * Increment the signup counter.
 * Records a signed audit entry to persistent storage.
 * Returns the new count.
 */
export async function incrementSignup(): Promise<number> {
  const currentCount = await getCurrentCount();
  const newCount = currentCount + 1;
  const timestamp = new Date().toISOString();

  // Create signed audit entry
  const message = `action:signup|count:${newCount}|timestamp:${timestamp}`;
  const signature = await signWithTeeKey(message);

  // Persist to encrypted storage
  await appendAuditEntry({
    action: 'signup',
    count: newCount,
    timestamp,
    signature,
  });

  console.log(`[Signup] Count incremented to ${newCount} (TEE-signed, persisted)`);
  return newCount;
}

/**
 * Get the current signup count with a cryptographic signature.
 *
 * The signature proves this count came from this enclave. The signing
 * key is derived from TEE attestation, so the signature can be verified
 * against the attestation quote's compose hash.
 *
 * Security: A different app version would have a different compose hash,
 * resulting in a different derived key, making signatures distinguishable.
 */
export async function getSignedCount(): Promise<SignupCountResponse> {
  const count = await getCurrentCount();
  const timestamp = new Date().toISOString();
  const message = `count:${count}|timestamp:${timestamp}`;

  // Sign using TEE-derived key
  const signature = await signWithTeeKey(message);

  // Include TEE info if available (helps verification)
  const teeInfo = await getTeeInfo();

  return {
    count,
    signature,
    timestamp,
    ...(teeInfo && {
      teeInfo: {
        appId: teeInfo.appId,
        composeHash: teeInfo.composeHash,
      },
    }),
  };
}

/**
 * Get the full audit log.
 *
 * Each entry is signed with the TEE-derived key, creating a verifiable
 * chain of all signup events. This proves:
 * 1. How many signups occurred (count progression)
 * 2. When they occurred (timestamps)
 * 3. That they were recorded by THIS code (TEE-bound signatures)
 *
 * An auditor can verify each signature matches the TEE's compose hash,
 * proving the counts came from attested code.
 */
export async function getAuditLog(): Promise<AuditLogResponse> {
  const teeAvailable = await isTeeAvailable();
  const teeInfo = await getTeeInfo();
  const entries = await getAuditEntries();
  const totalCount = await getCurrentCount();

  return {
    entries,
    totalCount,
    teeAvailable,
    ...(teeInfo && {
      teeInfo: {
        appId: teeInfo.appId,
        composeHash: teeInfo.composeHash,
      },
    }),
  };
}

/**
 * Get the raw count without signature (for internal use).
 */
export async function getCount(): Promise<number> {
  return getCurrentCount();
}
