#!/usr/bin/env zsh

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
RESET='\033[0m'
STEP=0

next() {
    STEP=$((STEP + 1))
}

pause() {
    echo ""
    echo -e "${YELLOW}$1${RESET}"
    echo -e "Press any key to continue, or Ctrl+C to abort..."
    read -rsk 1
    echo ""
    next
}

echo -e "${GREEN}=== Corpus Release Script ===${RESET}"

# Login
if pnpm whoami &>/dev/null; then
    echo -e "${GREEN}Step ${STEP}: Already logged in as $(pnpm whoami), skipping...${RESET}"
    next
else
    echo -e "${GREEN}Step ${STEP}: Running pnpm login...${RESET}"
    pnpm login
    pause "Step ${STEP} complete. Ready to backup?"
fi

# Clean dist and node_modules from all packages (with backup)
echo -e "${RED}Step ${STEP}: Backing up and deleting dist and node_modules...${RESET}"
BACKUP_DIR=".release-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
echo "  Backup folder: $BACKUP_DIR"

backup_and_remove() {
    local src="$1"
    local label="$2"
    if [[ -d "$src" ]]; then
        local dest="$BACKUP_DIR/$label"
        echo "  Backing up $src -> $dest"
        mv "$src" "$dest"
    fi
}

# Root node_modules
backup_and_remove "node_modules" "root__node_modules"

# Package node_modules and dist
for dir in packages/*/; do
    local_name="${dir%/}"          # strip trailing slash
    local_name="${local_name##*/}" # strip leading path
    backup_and_remove "$dir/dist" "${local_name}__dist"
    backup_and_remove "$dir/node_modules" "${local_name}__node_modules"
done

echo "Done. To rollback, restore manually from $BACKUP_DIR/"
pause "Step ${STEP} complete. Ready to install dependencies?"

# Install dependencies
echo -e "${GREEN}Step 3: Running pnpm i...${RESET}"
pnpm i
pause "Step ${STEP} complete. Ready to build?"

# Build all packages
echo -e "${GREEN}Step ${STEP}: Running pnpm -r run build...${RESET}"
pnpm -r run build
pause "Step ${STEP} complete. Ready to format?"

# Format
echo -e "${GREEN}Step ${STEP}: Running pnpm run fm...${RESET}"
pnpm run fm
pause "Step ${STEP} complete. Ready to lint?"

# Lint
echo -e "${GREEN}Step ${STEP}: Running pnpm run lint...${RESET}"
pnpm run lint
pause "Step ${STEP} complete. Ready to test?"

# Test all packages
echo -e "${GREEN}Step ${STEP}: Running pnpm -r test:all...${RESET}"
pnpm -r --reporter=append-only test:all
pause "Step ${STEP} complete. Ready to create a changeset?"

# Changeset (interactive — waits for CLI to finish naturally)
echo -e "${GREEN}Step ${STEP}: Running pnpm run changeset...${RESET}"
pnpm run changeset
pause "Step ${STEP} complete. Ready to version packages?"

# Version
echo -e "${GREEN}Step ${STEP}: Running pnpm run version...${RESET}"
pnpm run version
pause "Step ${STEP} complete. Ready to publish?"

# Release
echo -e "${GREEN}Step ${STEP}: Running pnpm run release...${RESET}"
pnpm run release
pause "Step ${STEP} complete. Ready to format, commit, and push?"

# Format, commit and push
echo -e "${GREEN}Step ${STEP}: Formatting, committing, and pushing...${RESET}"
pnpm run fm
echo -n "  Commit message: "
read -r COMMIT_MSG
if [[ -z "$COMMIT_MSG" ]]; then
    echo -e "${RED}Commit message cannot be empty. Aborting.${RESET}"
    exit 1
fi
git add .
git commit -m "$COMMIT_MSG"
git push

# Cleanup backup
echo ""
echo -e "${GREEN}Cleaning up backup directory $BACKUP_DIR...${RESET}"
rm -rf "$BACKUP_DIR"

echo ""
echo -e "${GREEN}=== Release complete! ===${RESET}"
