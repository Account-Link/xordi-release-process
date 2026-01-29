// Persistent Audit Storage Module
//
// Stores audit log entries to encrypted persistent storage at /data.
// dstack provides LUKS-encrypted volumes with keys derived from KMS.
//
// IMPORTANT: This module FAILS HARD if storage is not available.
// Data integrity is required - we cannot fall back to in-memory.

import * as fs from 'fs/promises';
import * as path from 'path';

// Storage configuration
const DATA_DIR = '/data';
const AUDIT_LOG_FILE = path.join(DATA_DIR, 'audit-log.json');

// Audit entry structure
export interface AuditEntry {
  action: 'signup';
  count: number;
  timestamp: string;
  signature: string;
}

// In-memory cache of audit log (loaded from disk on startup)
let auditLogCache: AuditEntry[] | null = null;
let storageVerified = false;

/**
 * Verify that encrypted storage is available.
 * FAILS HARD if /data is not writable.
 *
 * This is called on startup - if storage is not available,
 * the application refuses to start.
 */
export async function verifyStorageAvailable(): Promise<void> {
  if (storageVerified) {
    return;
  }

  console.log('[Storage] Verifying encrypted storage at /data...');

  try {
    // Check if /data directory exists
    await fs.access(DATA_DIR, fs.constants.F_OK);
  } catch {
    throw new Error(
      `FATAL: /data directory does not exist. ` +
      `Encrypted storage is required for audit log persistence. ` +
      `Ensure the docker-compose.yml mounts /data volume.`
    );
  }

  try {
    // Check if we can write to /data
    const testFile = path.join(DATA_DIR, '.write-test');
    await fs.writeFile(testFile, 'test', 'utf-8');
    await fs.unlink(testFile);
  } catch (error) {
    throw new Error(
      `FATAL: /data is not writable. ` +
      `Encrypted storage is required for audit log persistence. ` +
      `Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  storageVerified = true;
  console.log('[Storage] Encrypted storage verified successfully');
}

/**
 * Load the audit log from disk.
 * Returns empty array if file doesn't exist (fresh start).
 */
export async function loadAuditLog(): Promise<AuditEntry[]> {
  if (auditLogCache !== null) {
    return auditLogCache;
  }

  await verifyStorageAvailable();

  try {
    const data = await fs.readFile(AUDIT_LOG_FILE, 'utf-8');
    auditLogCache = JSON.parse(data) as AuditEntry[];
    console.log(`[Storage] Loaded ${auditLogCache.length} audit entries from disk`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // File doesn't exist - fresh start
      auditLogCache = [];
      console.log('[Storage] No existing audit log, starting fresh');
    } else {
      throw new Error(
        `FATAL: Failed to read audit log: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return auditLogCache;
}

/**
 * Save the audit log to disk.
 * Called after each new entry to ensure persistence.
 */
async function saveAuditLog(): Promise<void> {
  if (auditLogCache === null) {
    return;
  }

  await verifyStorageAvailable();

  try {
    await fs.writeFile(
      AUDIT_LOG_FILE,
      JSON.stringify(auditLogCache, null, 2),
      'utf-8'
    );
  } catch (error) {
    throw new Error(
      `FATAL: Failed to save audit log: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Append a new audit entry and persist to disk.
 */
export async function appendAuditEntry(entry: AuditEntry): Promise<void> {
  const log = await loadAuditLog();
  log.push(entry);
  await saveAuditLog();
  console.log(`[Storage] Persisted audit entry #${entry.count}`);
}

/**
 * Get the current count from the audit log.
 * Returns 0 if log is empty.
 */
export async function getCurrentCount(): Promise<number> {
  const log = await loadAuditLog();
  if (log.length === 0) {
    return 0;
  }
  return log[log.length - 1].count;
}

/**
 * Get all audit entries.
 */
export async function getAuditEntries(): Promise<AuditEntry[]> {
  return loadAuditLog();
}
