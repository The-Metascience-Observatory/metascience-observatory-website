#!/usr/bin/env bash
# Mark build/dependency directories as ignored by Dropbox (kept locally,
# never synced). Dropbox restoring a stale .next from the cloud mid-build
# breaks `next dev`/`next build` (ENOENT prerender-manifest.json), and
# syncing node_modules races npm installs.
#
# The user.com.dropbox.ignored xattr is lost whenever a directory is deleted
# and recreated, so this script is re-run automatically via the npm predev /
# prebuild hooks and scripts/with-dropbox-paused.sh. Safe to run any time.
set -u

cd "$(dirname "$0")/.." || exit 0

set_ignored() {
  local dir="$1"
  mkdir -p "$dir"
  if command -v attr >/dev/null 2>&1; then
    attr -s com.dropbox.ignored -V 1 "$dir" >/dev/null 2>&1
  elif command -v setfattr >/dev/null 2>&1; then
    setfattr -n user.com.dropbox.ignored -v 1 "$dir" >/dev/null 2>&1
  fi
}

set_ignored .next
set_ignored .next-dev
set_ignored node_modules
exit 0
