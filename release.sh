#!/usr/bin/env zsh

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
RESET='\033[0m'
STEP=1

next() {
    STEP=$((STEP + 1))
}

pause() {
    print ""
    print -P "${YELLOW}$1${RESET}"
    print "Press any key to continue, or Ctrl+C to abort..."
    read -rsk 1
    print ""
    next
}

on_exit() {
    local code=$?
    [[ $code -eq 0 ]] && return
    print -P "${RED}Release failed (exit ${code}). Run 'pnpm i' to restore node_modules.${RESET}"
}
trap on_exit EXIT

print -P "${GREEN}=== Corpus Release Script ===${RESET}"

# Login
if pnpm whoami &>/dev/null; then
    print -P "${GREEN}Step ${STEP}: Already logged in as $(pnpm whoami), skipping...${RESET}"
    next
else
    print -P "${GREEN}Step ${STEP}: Running pnpm login...${RESET}"
    pnpm login
    pause "Step ${STEP} complete. Ready to clean?"
fi

# Clean dist and node_modules from all packages
print -P "${RED}Step ${STEP}: Deleting dist and node_modules...${RESET}"

remove() {
    local src="$1"
    if [[ -d "$src" ]]; then
        print "  Removing $src"
        rm -rf "$src"
    fi
}

remove "node_modules"

for dir in packages/*/; do
    remove "${dir}dist"
    remove "${dir}node_modules"
done

pause "Step ${STEP} complete. Ready to install dependencies?"

# Install dependencies
print -P "${GREEN}Step ${STEP}: Running pnpm i...${RESET}"
pnpm i
pause "Step ${STEP} complete. Ready to create a changeset?"

# Changeset (interactive — waits for CLI to finish naturally)
print -P "${GREEN}Step ${STEP}: Running pnpm run changeset...${RESET}"
pnpm run changeset
pause "Step ${STEP} complete. Ready to version packages?"

# Version
print -P "${GREEN}Step ${STEP}: Running pnpm run version...${RESET}"
pnpm run version
pause "Step ${STEP} complete. Review the version bump and changelog, then commit?"

# Commit
CLI_VERSION=$(node -p "require('./packages/cli/package.json').version")
CORPUS_VERSION=$(node -p "require('./packages/corpus/package.json').version")
print -P "${GREEN}Step ${STEP}: Committing...${RESET}"
git add -A
git commit -m "corpus v${CORPUS_VERSION} & cli v${CLI_VERSION}"
pause "Step ${STEP} complete. Ready to publish?"

# Release
print -P "${GREEN}Step ${STEP}: Running checks and publishing...${RESET}"
pnpm run check
pnpm run release
next

# Push
print -P "${GREEN}Step ${STEP}: Pushing commit and tags...${RESET}"
git push --follow-tags
print -P "${GREEN}=== Release complete ===${RESET}"
