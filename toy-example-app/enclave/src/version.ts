// Version metadata for the enclave application
//
// These values are injected at build time via Docker build args.
// At runtime, they provide traceability back to the source code.

export const VERSION = '1.2.11';

// Git SHA of the commit this build was created from
// Injected via: docker build --build-arg BUILD_SHA=$(git rev-parse HEAD)
export const BUILD_SHA = process.env.BUILD_SHA || 'dev';

// Short version of Git SHA for display
export const BUILD_SHA_SHORT = BUILD_SHA.substring(0, 7);

// Timestamp when this image was built
// Injected via: docker build --build-arg BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)
export const BUILD_TIME = process.env.BUILD_TIME || new Date().toISOString();

// Environment name (staging, prod, etc.)
export const ENVIRONMENT = process.env.ENVIRONMENT || 'development';

export interface VersionInfo {
  version: string;
  gitSha: string;
  gitShaShort: string;
  buildTime: string;
  environment: string;
}

export function getVersionInfo(): VersionInfo {
  return {
    version: VERSION,
    gitSha: BUILD_SHA,
    gitShaShort: BUILD_SHA_SHORT,
    buildTime: BUILD_TIME,
    environment: ENVIRONMENT,
  };
}
