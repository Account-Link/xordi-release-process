# TEE Enclave Application Dockerfile
#
# Multi-stage build for reproducibility
# The same source code should produce identical images across builds
#
# Build:
#   docker build -t toy-example-enclave \
#     --build-arg BUILD_SHA=$(git rev-parse HEAD) \
#     --build-arg BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ) \
#     .
#
# Run:
#   docker run -p 8080:8080 -e MOCK_API_URL=... -e MOCK_API_TOKEN=... toy-example-enclave

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for layer caching
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

# Build arguments for version tracking
ARG BUILD_SHA=dev
ARG BUILD_TIME=unknown
ARG ENVIRONMENT=production

# Add labels for traceability
LABEL org.opencontainers.image.title="Toy Example Enclave"
LABEL org.opencontainers.image.description="TEE application demonstrating secure API access patterns"
LABEL org.opencontainers.image.vendor="Xordi Team"
LABEL org.opencontainers.image.revision="${BUILD_SHA}"
LABEL org.opencontainers.image.created="${BUILD_TIME}"

WORKDIR /app

# Copy package files and install production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built application
COPY --from=builder /app/dist ./dist

# Create non-root user for security
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup
USER appuser

# Expose main application port
# Note: Port 8090 is handled by dstack's metadata service, not this container
EXPOSE 8080

# Environment defaults
ENV NODE_ENV=production
ENV PORT=8080

# Version tracking (from build args)
ENV BUILD_SHA=${BUILD_SHA}
ENV BUILD_TIME=${BUILD_TIME}
ENV ENVIRONMENT=${ENVIRONMENT}

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

CMD ["node", "dist/index.js"]
