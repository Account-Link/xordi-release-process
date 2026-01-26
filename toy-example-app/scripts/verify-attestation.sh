#!/bin/bash
#
# Attestation Verification Script
#
# Verifies that a running enclave matches expected source code by:
# 1. Fetching attestation from the enclave's metadata service
# 2. Comparing the compose hash against expected value
# 3. Reporting pass/fail
#
# Usage:
#   ./verify-attestation.sh <enclave-url> [expected-compose-hash]
#
# Examples:
#   ./verify-attestation.sh https://toy-example.dstack.info
#   ./verify-attestation.sh https://toy-example.dstack.info abc123...
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Print functions
info() { echo -e "${NC}[INFO] $1${NC}"; }
success() { echo -e "${GREEN}[PASS] $1${NC}"; }
warn() { echo -e "${YELLOW}[WARN] $1${NC}"; }
fail() { echo -e "${RED}[FAIL] $1${NC}"; }

# Check dependencies
check_deps() {
    for cmd in curl jq sha256sum; do
        if ! command -v $cmd &> /dev/null; then
            fail "Required command '$cmd' not found"
            exit 1
        fi
    done
}

# Fetch compose hash from enclave
fetch_compose_hash() {
    local url="$1"
    local metadata_url="${url%/}:8090/compose-hash"

    info "Fetching compose hash from $metadata_url"

    local response
    response=$(curl -s -f "$metadata_url" 2>&1) || {
        fail "Failed to fetch compose hash from enclave"
        echo "  URL: $metadata_url"
        echo "  Error: $response"
        return 1
    }

    # Extract hash from response (handle different formats)
    if echo "$response" | jq -e '.composeHash' &>/dev/null; then
        echo "$response" | jq -r '.composeHash'
    elif echo "$response" | jq -e '.hash' &>/dev/null; then
        echo "$response" | jq -r '.hash'
    else
        # Assume raw hash
        echo "$response" | tr -d '[:space:]'
    fi
}

# Calculate compose hash from local file
calculate_local_hash() {
    local compose_file="$1"

    if [ ! -f "$compose_file" ]; then
        fail "Compose file not found: $compose_file"
        return 1
    fi

    sha256sum "$compose_file" | cut -d' ' -f1
}

# Fetch full attestation (optional, for detailed verification)
fetch_attestation() {
    local url="$1"
    local attestation_url="${url%/}:8090/attestation"

    info "Fetching full attestation from $attestation_url"

    curl -s -f "$attestation_url" 2>/dev/null || {
        warn "Could not fetch full attestation (non-fatal)"
        return 1
    }
}

# Main verification
main() {
    local enclave_url="$1"
    local expected_hash="$2"

    echo "========================================"
    echo "  Toy Example Attestation Verification"
    echo "========================================"
    echo ""

    check_deps

    if [ -z "$enclave_url" ]; then
        fail "Usage: $0 <enclave-url> [expected-compose-hash]"
        echo ""
        echo "Examples:"
        echo "  $0 https://toy-example.dstack.info"
        echo "  $0 https://toy-example.dstack.info abc123..."
        exit 1
    fi

    # Step 1: Fetch compose hash from enclave
    info "Step 1: Fetching remote compose hash"
    local remote_hash
    remote_hash=$(fetch_compose_hash "$enclave_url") || exit 1
    echo "  Remote hash: $remote_hash"
    echo ""

    # Step 2: Compare with expected hash
    if [ -n "$expected_hash" ]; then
        info "Step 2: Comparing with provided expected hash"
        echo "  Expected:  $expected_hash"
        echo "  Remote:    $remote_hash"

        if [ "$remote_hash" = "$expected_hash" ]; then
            success "Compose hashes match!"
        else
            fail "Compose hash MISMATCH!"
            echo ""
            echo "The enclave is running a different configuration than expected."
            echo "This could indicate:"
            echo "  - A legitimate update (check deployment logs)"
            echo "  - Configuration tampering"
            echo "  - Wrong expected hash provided"
            exit 1
        fi
    else
        info "Step 2: No expected hash provided"
        echo "  To verify, compute hash from source:"
        echo "  sha256sum enclave/docker-compose.yml"
        echo ""

        # Try to find local compose file
        local script_dir
        script_dir="$(cd "$(dirname "$0")" && pwd)"
        local compose_file="$script_dir/../enclave/docker-compose.yml"

        if [ -f "$compose_file" ]; then
            info "Found local compose file, calculating hash..."
            local local_hash
            local_hash=$(calculate_local_hash "$compose_file")
            echo "  Local hash:  $local_hash"
            echo "  Remote hash: $remote_hash"

            if [ "$local_hash" = "$remote_hash" ]; then
                success "Local and remote hashes match!"
            else
                warn "Local and remote hashes differ"
                echo "  This may be expected if the deployed version differs from local"
            fi
        fi
    fi
    echo ""

    # Step 3: Try to fetch full attestation
    info "Step 3: Fetching full attestation (optional)"
    local attestation
    if attestation=$(fetch_attestation "$enclave_url"); then
        echo "  Attestation retrieved successfully"

        # Extract key fields if JSON
        if echo "$attestation" | jq -e '.' &>/dev/null; then
            echo "  Timestamp: $(echo "$attestation" | jq -r '.timestamp // "N/A"')"
            echo "  App Version: $(echo "$attestation" | jq -r '.appVersion // "N/A"')"

            if echo "$attestation" | jq -e '.tdxQuote' &>/dev/null; then
                success "TDX quote present in attestation"
            else
                warn "No TDX quote found (may be normal for some configurations)"
            fi
        fi
    else
        warn "Could not fetch full attestation"
    fi
    echo ""

    # Step 4: Health check
    info "Step 4: Checking enclave health"
    local health_url="${enclave_url%/}:8080/health"
    local health
    if health=$(curl -s -f "$health_url" 2>/dev/null); then
        success "Enclave is healthy"
        echo "  Response: $health"
    else
        warn "Health check failed or unavailable"
    fi
    echo ""

    # Summary
    echo "========================================"
    echo "  Verification Complete"
    echo "========================================"
    echo ""
    echo "Remote compose hash: $remote_hash"
    echo ""
    echo "Next steps for full verification:"
    echo "1. Find the git commit with this compose hash"
    echo "2. Audit the source code at that commit"
    echo "3. Verify: grep -r 'direct_message' enclave/src/"
    echo "4. Check Base contract for this hash"
    echo ""

    if [ -n "$expected_hash" ] && [ "$remote_hash" = "$expected_hash" ]; then
        success "VERIFICATION PASSED"
        exit 0
    else
        info "Manual verification required (no expected hash provided)"
        exit 0
    fi
}

main "$@"
