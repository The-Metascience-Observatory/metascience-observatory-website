#!/usr/bin/env bash
# Run a command with the Dropbox daemon paused, then restart it afterward
# (even if the command fails). Dropbox racing the .next/node_modules folders
# corrupts builds and installs, so we pause it for local builds.
#
# Do NOT move the build dir outside the project to dodge Dropbox: Next 15 writes generated
# route types into distDir, and from outside the project TypeScript can't resolve
# 'next/server.js' (no node_modules up that path). It also rewrites tsconfig "include" with a
# machine-specific path. Keep distDir = .next and keep Dropbox off it instead (below).
#
# Two separate Dropbox mechanisms matter here, and only one is correct:
#   - com.dropbox.ignored xattr  -> "leave this path alone"          (what we want)
#   - `dropbox exclude add`      -> "this must not exist locally", so the daemon DELETES it
#     (this is what was silently eating .next mid-build; check with `dropbox exclude list`)
# The xattr dies with the directory, so re-apply it on every run after any rm -rf .next.
set -u

ensure_ignored() {
  mkdir -p "$1"
  setfattr -n user.com.dropbox.ignored -v 1 "$1" 2>/dev/null \
    || attr -s com.dropbox.ignored -V 1 "$1" >/dev/null 2>&1 || true
}
ensure_ignored .next
ensure_ignored .next-dev

is_running() { pgrep -f 'dropbox-lnx' >/dev/null 2>&1; }

DROPBOX_WAS_RUNNING=0
if is_running; then
  DROPBOX_WAS_RUNNING=1
  echo "[with-dropbox-paused] stopping Dropbox..."
  dropbox stop >/dev/null 2>&1 || true
  for _ in $(seq 1 10); do is_running || break; sleep 1; done
  is_running && { pkill -f 'dropbox-lnx' >/dev/null 2>&1 || true; sleep 2; }
fi

restart_dropbox() {
  # Re-mark .next/node_modules as Dropbox-ignored before Dropbox comes back:
  # the xattr is lost when a build recreates the directory, and without it
  # Dropbox syncs .next to the cloud and later restores stale copies over
  # fresh builds (ENOENT prerender-manifest.json in `next dev`).
  bash "$(dirname "$0")/dropbox-ignore.sh" || true
  if [ "$DROPBOX_WAS_RUNNING" = "1" ] && ! is_running; then
    echo "[with-dropbox-paused] restarting Dropbox..."
    dropbox start >/dev/null 2>&1 || true
  fi
}
trap restart_dropbox EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if is_running; then
  echo "[with-dropbox-paused] Dropbox is still running; refusing to start an unsafe server." >&2
  exit 1
fi

"$@"
