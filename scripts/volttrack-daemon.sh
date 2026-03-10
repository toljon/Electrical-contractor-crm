#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────
# VoltTrack Slack Daemon
# Polls #volttrack-builds and runs Claude Code
# ─────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DATA_DIR="$PROJECT_DIR/data"
LOCK_FILE="/tmp/volttrack-daemon.lock"
WATERMARK_FILE="$DATA_DIR/last_processed_ts"
ENV_FILE="$HOME/.volttrack-daemon.env"
MAX_TIMEOUT=600  # 10 minutes per message

# Load credentials
if [[ ! -f "$ENV_FILE" ]]; then
  echo "$(date): ERROR — $ENV_FILE not found. Create it with SLACK_BOT_TOKEN and SLACK_CHANNEL_ID." >&2
  exit 1
fi
source "$ENV_FILE"

if [[ -z "${SLACK_BOT_TOKEN:-}" || -z "${SLACK_CHANNEL_ID:-}" ]]; then
  echo "$(date): ERROR — SLACK_BOT_TOKEN and SLACK_CHANNEL_ID must be set in $ENV_FILE" >&2
  exit 1
fi

# Ensure data dir exists
mkdir -p "$DATA_DIR"

# Initialize watermark if missing (set to "now" so we don't process old messages)
if [[ ! -f "$WATERMARK_FILE" ]]; then
  echo "0" > "$WATERMARK_FILE"
  echo "$(date): Initialized watermark file"
fi

# ─────────────────────────────────────────────
# Slack API helpers
# ─────────────────────────────────────────────

slack_get_messages() {
  local oldest="$1"
  curl -s -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
    "https://slack.com/api/conversations.history?channel=$SLACK_CHANNEL_ID&oldest=$oldest&limit=10"
}

slack_post_reply() {
  local thread_ts="$1"
  local text="$2"
  curl -s -X POST "https://slack.com/api/chat.postMessage" \
    -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg channel "$SLACK_CHANNEL_ID" --arg thread "$thread_ts" --arg text "$text" \
      '{channel: $channel, thread_ts: $thread, text: $text}')"
}

# ─────────────────────────────────────────────
# Main logic (runs under flock)
# ─────────────────────────────────────────────

run_daemon() {
  local watermark
  watermark="$(cat "$WATERMARK_FILE")"

  # Fetch new messages
  local response
  response="$(slack_get_messages "$watermark")"

  local ok
  ok="$(echo "$response" | jq -r '.ok')"
  if [[ "$ok" != "true" ]]; then
    echo "$(date): Slack API error: $(echo "$response" | jq -r '.error // "unknown"')"
    return 1
  fi

  # Get messages (reverse to process oldest first)
  local messages
  messages="$(echo "$response" | jq -c '[.messages[] | select(.subtype == null)] | reverse')"
  local count
  count="$(echo "$messages" | jq 'length')"

  if [[ "$count" -eq 0 ]]; then
    return 0
  fi

  echo "$(date): Found $count new message(s) to process"

  # Process each message
  for i in $(seq 0 $((count - 1))); do
    local msg_text msg_ts msg_user
    msg_text="$(echo "$messages" | jq -r ".[$i].text")"
    msg_ts="$(echo "$messages" | jq -r ".[$i].ts")"
    msg_user="$(echo "$messages" | jq -r ".[$i].user")"

    echo "$(date): Processing message from $msg_user: ${msg_text:0:80}..."

    # Post "working on it" reply
    slack_post_reply "$msg_ts" ":zap: Working on it..." > /dev/null

    # Build the prompt
    local prompt
    prompt="You are the VoltTrack automation agent. You are working on the VoltTrack ERP app — a Next.js 16 + Supabase electrical contractor platform.

A team member posted this request in Slack:

---
$msg_text
---

Instructions:
1. Implement the requested change in the codebase
2. Run tests with: npm run test:run
3. Run the build with: npm run build
4. If tests and build pass, commit with a descriptive message and push to main
5. If something fails, explain what went wrong

Safety rules:
- Never modify .env or .env.local files
- Never drop database tables
- Never force push
- Never delete branches
- Keep changes focused on what was requested

After completing, provide a brief summary of what you changed."

    # Run Claude Code
    local claude_output exit_code
    set +e
    claude_output="$(timeout "$MAX_TIMEOUT" claude -p "$prompt" \
      --allowedTools "Edit,Write,Read,Glob,Grep,Bash" \
      --output-format json \
      --permission-mode bypassPermissions \
      --no-session-persistence \
      --max-budget-usd 5 \
      2>&1)"
    exit_code=$?
    set -e

    if [[ $exit_code -eq 0 ]]; then
      # Extract the result text from JSON output
      local result_text
      result_text="$(echo "$claude_output" | jq -r '.result // .content // "Done — check the repo for changes."' 2>/dev/null || echo "$claude_output")"

      # Truncate if too long for Slack (max ~3000 chars for readability)
      if [[ ${#result_text} -gt 3000 ]]; then
        result_text="${result_text:0:2900}...\n\n_(truncated — see commit for full details)_"
      fi

      slack_post_reply "$msg_ts" ":white_check_mark: Done!\n\n$result_text\n\n:rocket: Auto-deploying to https://volttrack-ten.vercel.app" > /dev/null
      echo "$(date): Successfully processed message $msg_ts"
    elif [[ $exit_code -eq 124 ]]; then
      slack_post_reply "$msg_ts" ":x: Timed out after 10 minutes. The request may be too complex — try breaking it into smaller changes." > /dev/null
      echo "$(date): TIMEOUT processing message $msg_ts"
    else
      # Truncate error output
      local error_text="${claude_output:0:2000}"
      slack_post_reply "$msg_ts" ":x: Failed (exit code $exit_code):\n\`\`\`\n$error_text\n\`\`\`" > /dev/null
      echo "$(date): FAILED processing message $msg_ts (exit $exit_code)"
    fi

    # Update watermark
    echo "$msg_ts" > "$WATERMARK_FILE"
  done
}

# ─────────────────────────────────────────────
# Entry point with flock
# ─────────────────────────────────────────────

exec 200>"$LOCK_FILE"
if ! flock -n 200; then
  echo "$(date): Another instance is running, skipping."
  exit 0
fi

cd "$PROJECT_DIR"
run_daemon
