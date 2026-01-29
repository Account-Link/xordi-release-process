// Configuration for the TEE Enclave application
// Environment variables are injected by dstack at runtime
//
// NOTE: Signing key is now derived from TEE persistent key, not passed via env.
// See tee-keys.ts for key derivation logic.

export interface Config {
  // Server configuration
  port: number;

  // Mock TikTok API configuration
  mockApiUrl: string;
  mockApiToken: string;
}

function getEnvOrDefault(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

function getEnvOrThrow(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
}

export function loadConfig(): Config {
  // In development, use defaults; in production, require env vars
  const isDev = process.env.NODE_ENV !== 'production';

  return {
    port: parseInt(getEnvOrDefault('PORT', '8080'), 10),

    // Mock API configuration
    mockApiUrl: isDev
      ? getEnvOrDefault('MOCK_API_URL', 'http://localhost:3000')
      : getEnvOrThrow('MOCK_API_URL'),

    mockApiToken: isDev
      ? getEnvOrDefault('MOCK_API_TOKEN', 'demo-token-12345')
      : getEnvOrThrow('MOCK_API_TOKEN'),
  };
}

export const config = loadConfig();
