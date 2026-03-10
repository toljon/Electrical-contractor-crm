# Slack-Triggered Automation for VoltTrack

## Overview

A local daemon that monitors a dedicated Slack channel (`#volttrack-builds`) and automatically triggers Claude Code to implement requested changes, deploy them, and report results back to Slack.

## Flow

```
#volttrack-builds message
  → volttrack-daemon.sh (launchd, every 60s)
  → Claude Code CLI (headless, scoped tools)
  → git commit + push to main
  → Vercel auto-deploys
  → Slack thread reply with result
```

## Components

### 1. `scripts/volttrack-daemon.sh`

Main loop script executed by launchd every 60 seconds.

**Steps per run:**
1. Acquire lock (`/tmp/volttrack-daemon.lock`) via `flock` — exit if held
2. Read watermark from `data/last_processed_ts`
3. Call Slack `conversations.history` for messages newer than watermark
4. For each new message (sequential, oldest first):
   a. Post "Working on it..." reply to the message thread
   b. Run Claude Code CLI in print mode with the message as prompt
   c. On success: commit, push, post result + Vercel URL to thread
   d. On failure: post error to thread
   e. Update watermark to this message's `ts`
5. Release lock

**Claude Code invocation:**
```bash
claude -p "<system_prompt>\n\nUser request: <slack_message>" \
  --allowedTools "Edit,Write,Read,Glob,Grep,Bash" \
  --max-turns 30 \
  --output-format json
```

**System prompt includes:**
- Project context (Next.js 16, Supabase, ERP app)
- Instructions: implement the change, run tests, run build, commit to main, push
- Safety: don't modify .env files, don't drop database tables, don't force push

**Timeout:** 10 minutes per message. `timeout 600` wraps the Claude Code invocation.

### 2. Slack Integration

**Method:** Direct Slack Web API via `curl` (not MCP tools).

**Required bot token scopes:**
- `channels:history` — read messages from the channel
- `chat:write` — post replies

**Token storage:** `~/.volttrack-daemon.env` (not in repo).

**API calls used:**
- `conversations.history?channel=<id>&oldest=<watermark>` — fetch new messages
- `chat.postMessage` with `thread_ts` — reply in-thread

**Channel:** `#volttrack-builds` — created manually, bot invited.

### 3. Watermark File

**Location:** `data/last_processed_ts`

**Format:** Single line containing Slack message `ts` value (e.g., `1710091200.000100`).

**Purpose:** Tracks the last processed message to avoid re-processing on restart.

**Initialization:** Set to current timestamp on first run.

### 4. Scheduling (launchd)

**Plist:** `~/Library/LaunchAgents/com.volttrack.daemon.plist`

**Behavior:**
- Runs every 60 seconds while user is logged in
- Logs stdout/stderr to `data/daemon.log`
- `KeepAlive` is false — launchd re-triggers on interval, not on crash

### 5. Control Scripts

- `scripts/volttrack-daemon-start.sh` — `launchctl load` the plist
- `scripts/volttrack-daemon-stop.sh` — `launchctl unload` the plist
- `scripts/volttrack-daemon-status.sh` — check if running, show last processed message

## Safety Rails

| Mechanism | Purpose |
|-----------|---------|
| Lock file (`flock`) | Prevents overlapping runs |
| 10-min timeout | Kills hung Claude Code sessions |
| `--max-turns 30` | Prevents runaway tool loops |
| Sequential processing | One message at a time, no conflicts |
| Scoped `--allowedTools` | No destructive tools exposed |
| System prompt guardrails | No .env changes, no force push, no DB drops |
| Error replies to Slack | Failures are visible, not silent |

## Out of Scope (v1)

- No web dashboard — monitor via Slack and logs
- No retry/queue — repost the message if it fails
- No approval gate — auto-deploys to production
- No concurrent processing — one request at a time
- Log rotation — keep last 7 days

## File Layout

```
scripts/
  volttrack-daemon.sh          # Main daemon script
  volttrack-daemon-start.sh    # Load launchd job
  volttrack-daemon-stop.sh     # Unload launchd job
  volttrack-daemon-status.sh   # Check status
data/
  last_processed_ts            # Watermark file
  daemon.log                   # Daemon logs
~/.volttrack-daemon.env        # SLACK_BOT_TOKEN, SLACK_CHANNEL_ID
~/Library/LaunchAgents/
  com.volttrack.daemon.plist   # launchd job definition
```

## Setup Steps

1. Create Slack app at api.slack.com with bot token scopes
2. Create `#volttrack-builds` channel, invite the bot
3. Save bot token and channel ID to `~/.volttrack-daemon.env`
4. Run `scripts/volttrack-daemon-start.sh`
5. Post a test message in the channel
