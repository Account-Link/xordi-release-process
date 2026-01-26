// Configuration for the TEE Enclave application
// Environment variables are injected by dstack at runtime

export interface Config {
  // Server configuration
  port: number;

  // Mock TikTok API configuration
  mockApiUrl: string;
  mockApiToken: string;

  // Signing key for attestation (in production, derived from TEE)
  signingKey: string;
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

    // Signing key - in production this would be derived from TEE attestation
    signingKey: getEnvOrDefault('SIGNING_KEY', 'dev-signing-key-not-for-production'),
  };
}

export const config = loadConfig();
