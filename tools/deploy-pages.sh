#!/usr/bin/env bash
# Deploys web/ to the gh-pages branch under /play/ (served at
# https://gameologist.com/Super-Microbe-World/play/). Nothing else on gh-pages is touched.
# Usage: tools/deploy-pages.sh ["commit message"]
set -euo pipefail
cd "$(dirname "$0")/.."
REPO_ROOT=$(pwd)
WT=$(mktemp -d)
MSG=${1:-"Deploy Super Microbe World remake to /play/"}

# Deploy exactly what is committed at HEAD (never half-edited working-tree files).
SNAP=$(mktemp -d)
git archive HEAD web | tar -x -C "$SNAP"
node tools/build-precache.mjs "$SNAP/web"
git fetch -q origin gh-pages
git worktree add -q "$WT" origin/gh-pages
trap 'git -C "$REPO_ROOT" worktree remove --force "$WT" >/dev/null 2>&1 || true; rm -rf "$SNAP"' EXIT

rm -rf "$WT/play"
mkdir -p "$WT/play"
# Copy runtime files only (no tests, notes or screenshots).
(cd "$SNAP/web" && find . -type f \
  ! -path './tests/*' ! -path './screenshots/*' ! -name '*.md' ! -name '*.map' \
  -print0 | xargs -0 -I{} cp --parents {} "$WT/play/")

cd "$WT"
git add -A play
if git diff --cached --quiet; then echo "gh-pages /play/ already up to date"; exit 0; fi
git -c user.name="$(git -C "$REPO_ROOT" config user.name || echo Claude)" -c user.email="$(git -C "$REPO_ROOT" config user.email || echo noreply@anthropic.com)" \
  commit -q -m "$MSG" -m "Built from $(git -C "$REPO_ROOT" rev-parse --short HEAD) on $(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD)."
for i in 1 2 3 4; do git push -q origin HEAD:gh-pages && break || sleep $((2 ** i)); done
echo "Deployed: https://gameologist.com/Super-Microbe-World/play/"
