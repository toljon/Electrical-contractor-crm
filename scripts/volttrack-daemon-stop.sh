#!/usr/bin/env bash
set -euo pipefail

PLIST_NAME="com.volttrack.daemon"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_NAME.plist"

if [[ -f "$PLIST_PATH" ]]; then
  launchctl unload "$PLIST_PATH" 2>/dev/null || true
  rm -f "$PLIST_PATH"
  echo "VoltTrack daemon stopped."
else
  echo "VoltTrack daemon is not installed."
fi

# Clean up lock file
rm -f /tmp/volttrack-daemon.lock
