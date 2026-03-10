#!/usr/bin/env bash

PLIST_NAME="com.volttrack.daemon"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
WATERMARK_FILE="$PROJECT_DIR/data/last_processed_ts"
LOG_FILE="$PROJECT_DIR/data/daemon.log"

echo "=== VoltTrack Daemon Status ==="
echo ""

# Check if launchd job is loaded
if launchctl list "$PLIST_NAME" &>/dev/null; then
  echo "Status: RUNNING"
  echo ""
  launchctl list "$PLIST_NAME" 2>/dev/null | head -5
else
  echo "Status: STOPPED"
fi

echo ""

# Show watermark
if [[ -f "$WATERMARK_FILE" ]]; then
  local_ts="$(cat "$WATERMARK_FILE")"
  echo "Last processed message ts: $local_ts"
else
  echo "No watermark file (daemon hasn't run yet)"
fi

echo ""

# Show recent log entries
if [[ -f "$LOG_FILE" ]]; then
  echo "=== Last 10 log entries ==="
  tail -10 "$LOG_FILE"
else
  echo "No log file yet"
fi
