#!/usr/bin/env bash
set -euo pipefail

PLIST_NAME="com.volttrack.daemon"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_NAME.plist"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Check prerequisites
if [[ ! -f "$HOME/.volttrack-daemon.env" ]]; then
  echo "Error: ~/.volttrack-daemon.env not found."
  echo "Create it with:"
  echo "  SLACK_BOT_TOKEN=xoxb-your-token"
  echo "  SLACK_CHANNEL_ID=C0123456789"
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
        <string>$SCRIPT_DIR/volttrack-daemon.sh</string>
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
        <string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin:$HOME/.local/bin:$HOME/.npm-global/bin</string>
    </dict>
</dict>
</plist>
EOF

# Load the job
launchctl unload "$PLIST_PATH" 2>/dev/null || true
launchctl load "$PLIST_PATH"

echo "VoltTrack daemon started."
echo "  Polling every 60 seconds"
echo "  Logs: $PROJECT_DIR/data/daemon.log"
echo "  Stop: scripts/volttrack-daemon-stop.sh"
