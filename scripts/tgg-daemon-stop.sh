#!/usr/bin/env bash
set -euo pipefail

PLIST_NAME="com.tgg.daemon"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_NAME.plist"

if [[ -f "$PLIST_PATH" ]]; then
  launchctl unload "$PLIST_PATH" 2>/dev/null || true
  rm -f "$PLIST_PATH"
  echo "TGG daemon stopped."
else
  echo "TGG daemon is not installed."
fi

# Clean up lock dir
rm -rf /tmp/tgg-daemon.lock
