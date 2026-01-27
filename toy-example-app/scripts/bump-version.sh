#!/bin/bash
# bump-version.sh - Bump the version of the toy example enclave
#
# Usage: ./scripts/bump-version.sh [major|minor|patch]
#
# This script:
# 1. Reads the current version from enclave/src/version.ts
# 2. Bumps the specified component (major, minor, or patch)
# 3. Updates enclave/package.json
# 4. Updates enclave/src/version.ts
# 5. Creates a git tag
#
# After running, push with: git push origin feat/toy-example-app --tags

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

VERSION_FILE="$ROOT_DIR/enclave/src/version.ts"
PACKAGE_JSON="$ROOT_DIR/enclave/package.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

usage() {
    echo "Usage: $0 [major|minor|patch]"
    echo ""
    echo "Examples:"
    echo "  $0 patch   # 1.0.0 -> 1.0.1"
    echo "  $0 minor   # 1.0.0 -> 1.1.0"
    echo "  $0 major   # 1.0.0 -> 2.0.0"
    exit 1
}

# Check argument
if [ $# -ne 1 ]; then
    usage
fi

BUMP_TYPE="$1"

if [[ ! "$BUMP_TYPE" =~ ^(major|minor|patch)$ ]]; then
    echo -e "${RED}Error: Invalid bump type '$BUMP_TYPE'${NC}"
    usage
fi

# Extract current version from version.ts
CURRENT_VERSION=$(grep "export const VERSION = " "$VERSION_FILE" | sed "s/.*'\(.*\)'.*/\1/")

if [ -z "$CURRENT_VERSION" ]; then
    echo -e "${RED}Error: Could not extract version from $VERSION_FILE${NC}"
    exit 1
fi

echo -e "${YELLOW}Current version: $CURRENT_VERSION${NC}"

# Parse version components
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

# Bump the appropriate component
case "$BUMP_TYPE" in
    major)
        MAJOR=$((MAJOR + 1))
        MINOR=0
        PATCH=0
        ;;
    minor)
        MINOR=$((MINOR + 1))
        PATCH=0
        ;;
    patch)
        PATCH=$((PATCH + 1))
        ;;
esac

NEW_VERSION="$MAJOR.$MINOR.$PATCH"
echo -e "${GREEN}New version: $NEW_VERSION${NC}"

# Update version.ts
echo "Updating $VERSION_FILE..."
sed -i "s/export const VERSION = '.*'/export const VERSION = '$NEW_VERSION'/" "$VERSION_FILE"

# Update package.json
echo "Updating $PACKAGE_JSON..."
sed -i "s/\"version\": \".*\"/\"version\": \"$NEW_VERSION\"/" "$PACKAGE_JSON"

# Verify updates
UPDATED_VERSION_TS=$(grep "export const VERSION = " "$VERSION_FILE" | sed "s/.*'\(.*\)'.*/\1/")
UPDATED_VERSION_PKG=$(grep '"version"' "$PACKAGE_JSON" | sed 's/.*"\([0-9]*\.[0-9]*\.[0-9]*\)".*/\1/')

if [ "$UPDATED_VERSION_TS" != "$NEW_VERSION" ] || [ "$UPDATED_VERSION_PKG" != "$NEW_VERSION" ]; then
    echo -e "${RED}Error: Version update verification failed${NC}"
    echo "version.ts: $UPDATED_VERSION_TS"
    echo "package.json: $UPDATED_VERSION_PKG"
    exit 1
fi

# Create git tag
TAG_NAME="v$NEW_VERSION"
echo "Creating git tag: $TAG_NAME"

# Stage the changed files
git add "$VERSION_FILE" "$PACKAGE_JSON"

# Commit the version bump
git commit -m "chore: bump version to $NEW_VERSION

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"

# Create annotated tag
git tag -a "$TAG_NAME" -m "Release $NEW_VERSION"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Version bumped: $CURRENT_VERSION -> $NEW_VERSION${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Updated files:"
echo "  - $VERSION_FILE"
echo "  - $PACKAGE_JSON"
echo ""
echo "Created tag: $TAG_NAME"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  git push origin feat/toy-example-app --tags"
echo ""
echo "This will trigger automatic deployment to prod7 and prod9."
