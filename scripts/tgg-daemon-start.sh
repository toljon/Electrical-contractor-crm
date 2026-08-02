#!/usr/bin/env bash
set -euo pipefail

PLIST_NAME="com.tgg.daemon"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_NAME.plist"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DAEMON_PATH="/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin:$HOME/.local/bin:$HOME/.npm-global/bin"

# Check prerequisites
if [[ ! -f "$HOME/.tgg-daemon.env" ]]; then
  echo "Error: ~/.tgg-daemon.env not found."
  echo "Create it with:"
  echo "  SLACK_BOT_TOKEN=xoxb-your-token"
  echo "  SLACK_CHANNEL_ID=C0123456789"
  echo "  ALLOWED_SLACK_USERS=U0123456789,U0987654321"
  exit 1
fi

source "$HOME/.tgg-daemon.env"

if [[ -z "${ALLOWED_SLACK_USERS:-}" ]]; then
  echo "Error: ALLOWED_SLACK_USERS is not set in ~/.tgg-daemon.env."
  echo "The daemon only acts on messages from the Slack user IDs listed there, so"
  echo "without it every message is refused. Add:"
  echo "  ALLOWED_SLACK_USERS=U0123456789,U0987654321"
  exit 1
fi

# Stock macOS ships GNU timeout only as gtimeout (homebrew coreutils), if at all.
# Resolve it against the PATH launchd hands the daemon, not this shell's.
if ! PATH="$DAEMON_PATH" command -v timeout > /dev/null && ! PATH="$DAEMON_PATH" command -v gtimeout > /dev/null; then
  echo "Error: neither 'timeout' nor 'gtimeout' is on the daemon's PATH."
  echo "The daemon needs one of them to bound each run. Install GNU coreutils:"
  echo "  brew install coreutils"
  exit 1
fi

# Create the launchd plist
mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST_PATH" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$PLIST_NAME</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>$SCRIPT_DIR/tgg-daemon.sh</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$PROJECT_DIR</string>
    <key>StartInterval</key>
    <integer>60</integer>
    <key>StandardOutPath</key>
    <string>$PROJECT_DIR/data/daemon.log</string>
    <key>StandardErrorPath</key>
    <string>$PROJECT_DIR/data/daemon.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>$DAEMON_PATH</string>
    </dict>
</dict>
</plist>
EOF

# Load the job
launchctl unload "$PLIST_PATH" 2>/dev/null || true
launchctl load "$PLIST_PATH"

echo "TGG daemon started."
echo "  Polling every 60 seconds"
echo "  Logs: $PROJECT_DIR/data/daemon.log"
echo "  Stop: scripts/tgg-daemon-stop.sh"
