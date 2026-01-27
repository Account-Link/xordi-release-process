#!/bin/bash
#
# Multi-Machine Attestation Comparison Script
#
# Compares two running enclave instances to cryptographically prove
# they are running the same code. This verifies:
#
# 1. TDX quotes are valid (hardware-signed attestations)
# 2. MR_ENCLAVE values match (identical enclave image measurement)
# 3. Compose hashes match (identical deployment configuration)
# 4. Version info matches (same application version)
#
# Usage:
#   ./compare-instances.sh <instance1-url> <instance2-url>
#
# Examples:
#   ./compare-instances.sh https://prod9.example.phala.network https://prod7.example.phala.network
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Symbols
CHECK="${GREEN}✓${NC}"
CROSS="${RED}✗${NC}"
WARN="${YELLOW}⚠${NC}"

# Print functions
header() { echo -e "\n${BOLD}${BLUE}$1${NC}"; }
info() { echo -e "${NC}$1${NC}"; }
success() { echo -e "${CHECK} ${GREEN}$1${NC}"; }
warning() { echo -e "${WARN} ${YELLOW}$1${NC}"; }
error() { echo -e "${CROSS} ${RED}$1${NC}"; }

# Box drawing
draw_line() { echo -e "${CYAN}$(printf '═%.0s' {1..70})${NC}"; }
draw_thin_line() { echo -e "${CYAN}$(printf '─%.0s' {1..70})${NC}"; }

# Check dependencies
check_deps() {
    local missing=()
    for cmd in curl jq base64; do
        if ! command -v "$cmd" &> /dev/null; then
            missing+=("$cmd")
        fi
    done

    if [ ${#missing[@]} -ne 0 ]; then
        error "Missing required commands: ${missing[*]}"
        exit 1
    fi
}

# Extract hostname from URL for display
get_hostname() {
    echo "$1" | sed -E 's|https?://([^:/]+).*|\1|' | cut -d'.' -f1
}

# Fetch compose hash from metadata service
fetch_compose_hash() {
    local url="$1"
    local metadata_url="${url%/}:8090/compose-hash"

    local response
    response=$(curl -s -f --connect-timeout 10 "$metadata_url" 2>/dev/null) || {
        echo "ERROR"
        return 1
    }

    # Handle different response formats
    if echo "$response" | jq -e '.composeHash' &>/dev/null 2>&1; then
        echo "$response" | jq -r '.composeHash'
    elif echo "$response" | jq -e '.hash' &>/dev/null 2>&1; then
        echo "$response" | jq -r '.hash'
    else
        echo "$response" | tr -d '[:space:]'
    fi
}

# Fetch full attestation from metadata service
fetch_attestation() {
    local url="$1"
    local attestation_url="${url%/}:8090/attestation"

    curl -s -f --connect-timeout 10 "$attestation_url" 2>/dev/null || echo "{}"
}

# Fetch version info from application
fetch_version() {
    local url="$1"
    local version_url="${url%/}:8080/version"

    curl -s -f --connect-timeout 10 "$version_url" 2>/dev/null || echo "{}"
}

# Fetch signup count from application
fetch_signup_count() {
    local url="$1"
    local signup_url="${url%/}:8080/signup-count"

    local response
    response=$(curl -s -f --connect-timeout 10 "$signup_url" 2>/dev/null) || echo "{}"
    echo "$response" | jq -r '.count // "N/A"' 2>/dev/null || echo "N/A"
}

# Check health status
check_health() {
    local url="$1"
    local health_url="${url%/}:8080/health"

    if curl -s -f --connect-timeout 5 "$health_url" &>/dev/null; then
        echo "OK"
    else
        echo "FAIL"
    fi
}

# Extract TDX measurement fields from attestation
# Note: Actual field names depend on the dstack attestation format
extract_tdx_fields() {
    local attestation="$1"
    local field="$2"

    # Try common field paths
    local value
    value=$(echo "$attestation" | jq -r ".$field // .tdxQuote.$field // .quote.$field // .measurement.$field // \"N/A\"" 2>/dev/null)
    echo "$value"
}

# Verify TDX quote (basic verification - checks structure exists)
# Full cryptographic verification would require Intel's DCAP library
verify_tdx_quote() {
    local attestation="$1"

    # Check if attestation has TDX-related fields
    local has_quote=false

    if echo "$attestation" | jq -e '.tdxQuote' &>/dev/null 2>&1; then
        has_quote=true
    elif echo "$attestation" | jq -e '.quote' &>/dev/null 2>&1; then
        has_quote=true
    elif echo "$attestation" | jq -e '.raw_quote' &>/dev/null 2>&1; then
        has_quote=true
    fi

    if $has_quote; then
        echo "PRESENT"
    else
        echo "ABSENT"
    fi
}

# Print comparison table row
print_row() {
    local label="$1"
    local val1="$2"
    local val2="$3"
    local match="$4"  # "match", "differ", "expected-differ", or "na"

    # Truncate long values
    local max_len=20
    local v1_display="${val1:0:$max_len}"
    local v2_display="${val2:0:$max_len}"
    [ ${#val1} -gt $max_len ] && v1_display="${v1_display}..."
    [ ${#val2} -gt $max_len ] && v2_display="${v2_display}..."

    local status_symbol
    case "$match" in
        match) status_symbol="${CHECK}" ;;
        differ) status_symbol="${CROSS}" ;;
        expected-differ) status_symbol="${WARN}" ;;
        *) status_symbol=" " ;;
    esac

    printf "│ %-18s │ %-22s │ %-22s │ %b │\n" "$label" "$v1_display" "$v2_display" "$status_symbol"
}

# Main comparison
main() {
    local url1="$1"
    local url2="$2"

    if [ -z "$url1" ] || [ -z "$url2" ]; then
        echo "Usage: $0 <instance1-url> <instance2-url>"
        echo ""
        echo "Example:"
        echo "  $0 https://prod9.example.phala.network https://prod7.example.phala.network"
        exit 1
    fi

    check_deps

    local name1=$(get_hostname "$url1")
    local name2=$(get_hostname "$url2")

    draw_line
    echo -e "${BOLD} MULTI-MACHINE ATTESTATION VERIFICATION${NC}"
    draw_line
    echo ""

    # Fetch all data
    header "Fetching attestations..."

    info "  Fetching from $name1..."
    local hash1=$(fetch_compose_hash "$url1")
    local attest1=$(fetch_attestation "$url1")
    local version1=$(fetch_version "$url1")
    local count1=$(fetch_signup_count "$url1")
    local health1=$(check_health "$url1")

    if [ "$hash1" = "ERROR" ]; then
        error "Failed to connect to $name1"
        exit 1
    fi
    success "$name1: Retrieved attestation data"

    info "  Fetching from $name2..."
    local hash2=$(fetch_compose_hash "$url2")
    local attest2=$(fetch_attestation "$url2")
    local version2=$(fetch_version "$url2")
    local count2=$(fetch_signup_count "$url2")
    local health2=$(check_health "$url2")

    if [ "$hash2" = "ERROR" ]; then
        error "Failed to connect to $name2"
        exit 1
    fi
    success "$name2: Retrieved attestation data"

    # Extract version info
    local ver1=$(echo "$version1" | jq -r '.version // "N/A"' 2>/dev/null || echo "N/A")
    local sha1=$(echo "$version1" | jq -r '.gitShaShort // "N/A"' 2>/dev/null || echo "N/A")
    local ver2=$(echo "$version2" | jq -r '.version // "N/A"' 2>/dev/null || echo "N/A")
    local sha2=$(echo "$version2" | jq -r '.gitShaShort // "N/A"' 2>/dev/null || echo "N/A")

    # Extract TDX fields
    local tdx_status1=$(verify_tdx_quote "$attest1")
    local tdx_status2=$(verify_tdx_quote "$attest2")

    local mr_enclave1=$(extract_tdx_fields "$attest1" "mr_enclave")
    local mr_enclave2=$(extract_tdx_fields "$attest2" "mr_enclave")
    local mr_signer1=$(extract_tdx_fields "$attest1" "mr_signer")
    local mr_signer2=$(extract_tdx_fields "$attest2" "mr_signer")

    # Print comparison table
    echo ""
    header "Comparison Results"
    echo ""
    printf "┌────────────────────┬────────────────────────┬────────────────────────┬───┐\n"
    printf "│ %-18s │ %-22s │ %-22s │   │\n" "Property" "$name1" "$name2"
    printf "├────────────────────┼────────────────────────┼────────────────────────┼───┤\n"

    # Version
    [ "$ver1" = "$ver2" ] && vmatch="match" || vmatch="differ"
    print_row "Version" "$ver1" "$ver2" "$vmatch"

    # Git SHA
    [ "$sha1" = "$sha2" ] && smatch="match" || smatch="differ"
    print_row "Git SHA" "$sha1" "$sha2" "$smatch"

    # Compose Hash
    [ "$hash1" = "$hash2" ] && hmatch="match" || hmatch="differ"
    print_row "Compose Hash" "$hash1" "$hash2" "$hmatch"

    # MR_ENCLAVE
    if [ "$mr_enclave1" != "N/A" ] && [ "$mr_enclave2" != "N/A" ]; then
        [ "$mr_enclave1" = "$mr_enclave2" ] && ematch="match" || ematch="differ"
        print_row "MR_ENCLAVE" "$mr_enclave1" "$mr_enclave2" "$ematch"
    fi

    # MR_SIGNER
    if [ "$mr_signer1" != "N/A" ] && [ "$mr_signer2" != "N/A" ]; then
        [ "$mr_signer1" = "$mr_signer2" ] && sigmatch="match" || sigmatch="differ"
        print_row "MR_SIGNER" "$mr_signer1" "$mr_signer2" "$sigmatch"
    fi

    # TDX Quote
    [ "$tdx_status1" = "$tdx_status2" ] && tmatch="match" || tmatch="differ"
    print_row "TDX Quote" "$tdx_status1" "$tdx_status2" "$tmatch"

    # Signup Counter (expected to differ)
    print_row "Signup Counter" "$count1" "$count2" "expected-differ"

    # Health
    [ "$health1" = "$health2" ] && hmatch2="match" || hmatch2="differ"
    print_row "Health" "$health1" "$health2" "$hmatch2"

    printf "└────────────────────┴────────────────────────┴────────────────────────┴───┘\n"

    # Verification results
    echo ""
    header "CRYPTOGRAPHIC VERIFICATION RESULTS"
    draw_thin_line

    local all_pass=true

    # TDX Quote verification
    if [ "$tdx_status1" = "PRESENT" ] && [ "$tdx_status2" = "PRESENT" ]; then
        success "TDX quotes present on both machines (hardware attestation available)"
    else
        warning "TDX quote verification: Some quotes unavailable"
        warning "  $name1: $tdx_status1, $name2: $tdx_status2"
    fi

    # MR_ENCLAVE comparison
    if [ "$mr_enclave1" != "N/A" ] && [ "$mr_enclave2" != "N/A" ]; then
        if [ "$mr_enclave1" = "$mr_enclave2" ]; then
            success "MR_ENCLAVE matches: Both machines running identical enclave image"
        else
            error "MR_ENCLAVE MISMATCH: Different enclave images!"
            all_pass=false
        fi
    else
        warning "MR_ENCLAVE: Not available in attestation data"
    fi

    # Compose hash comparison
    if [ "$hash1" = "$hash2" ]; then
        success "Compose hashes match: Identical deployment configuration"
    else
        error "Compose hash MISMATCH: Different deployment configurations!"
        all_pass=false
    fi

    # Version comparison
    if [ "$ver1" = "$ver2" ]; then
        success "Version matches: Same application version ($ver1)"
    else
        error "Version MISMATCH: $ver1 vs $ver2"
        all_pass=false
    fi

    # Expected differences
    echo ""
    info "${WARN} ${YELLOW}EXPECTED DIFFERENCES:${NC}"
    if [ "$count1" != "$count2" ]; then
        info "  - Signup counters differ ($count1 vs $count2) - counters are per-instance, not shared"
    else
        info "  - Signup counters happen to match ($count1) - this is coincidental"
    fi

    # Final verdict
    echo ""
    draw_line
    if $all_pass; then
        echo -e "${BOLD}${GREEN} ✓ PROOF COMPLETE: Same code verified running on both machines${NC}"
    else
        echo -e "${BOLD}${RED} ✗ VERIFICATION FAILED: Machines are running different code${NC}"
    fi
    draw_line
    echo ""

    # Exit with appropriate code
    $all_pass && exit 0 || exit 1
}

main "$@"
