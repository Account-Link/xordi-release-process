// TikTok API Client
//
// CRITICAL SECURITY CONSTRAINT:
// This file is the ONLY place in the enclave that makes external API calls.
// It ONLY calls the watch_history endpoint - NEVER direct_messages.
//
// Auditors: grep this codebase for "direct_message" - it should appear NOWHERE
// except in documentation explaining what we DON'T do.

import { config } from './config';

// Response type for watch history
export interface WatchHistoryVideo {
  id: string;
  title: string;
  watchedAt: string;
  duration: number;
}

export interface WatchHistoryResponse {
  videos: WatchHistoryVideo[];
}

// Error class for API failures
export class TikTokApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public endpoint: string
  ) {
    super(message);
    this.name = 'TikTokApiError';
  }
}

/**
 * Fetches watch history from the TikTok API.
 *
 * This is the ONLY external API call this enclave makes.
 * The enclave has credentials that could access other endpoints,
 * but this code only calls /api/watch_history.
 */
export async function getWatchHistory(): Promise<WatchHistoryResponse> {
  const url = `${config.mockApiUrl}/api/watch_history`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${config.mockApiToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new TikTokApiError(
      `Failed to fetch watch history: ${response.statusText}`,
      response.status,
      '/api/watch_history'
    );
  }

  return response.json() as Promise<WatchHistoryResponse>;
}

// NOTE: There is intentionally NO function for fetching direct messages.
// The enclave has the token that COULD access the sensitive DM endpoint,
// but we never wrote the code to do so. This is the security guarantee
// that attestation proves.
