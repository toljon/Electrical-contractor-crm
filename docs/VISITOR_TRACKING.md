# Visitor tracking

A private access log for the deployed demo, so you can tell whether a prospect
opened the link you sent them.

It records, per request: IP address, coarse location, referrer, user agent, path
and timestamp. Hits are rolled up into **sessions** (one visitor, one sitting)
and shown on a private report page.

## What a visitor sees

Nothing. Capture happens entirely in `middleware.ts` on the server, inside
`after()` — after the response has already been sent. There is:

- no tracking script and no pixel,
- no extra cookie and no `localStorage`,
- nothing in the browser's network tab,
- no added latency on the page they requested.

The report page is not linked from anywhere in the app and does not appear in
the nav.

## Setup

One variable is required to read the report. Everything else is optional.

```bash
# Required to view the report. Must be at least 16 characters — the route
# returns 404 for a shorter key, since it travels in a query string.
VISIT_ACCESS_KEY="$(openssl rand -hex 24)"
```

Then open:

```
https://<your-deployment>/api/events?k=<VISIT_ACCESS_KEY>
```

Add `&format=json` for the raw records.

Without the key the URL returns a plain `404` — the same response an
unrouted path gives, so probing it reveals nothing.

### Make the history survive on Vercel

**This matters.** The SQLite database falls back to `/tmp` on Vercel (see
`resolveDataDir` in `src/lib/localdb/database.ts`), which is per-instance and
wiped on every cold start. Without a durable store the report will quietly go
empty, which reads as "nobody visited" when it means "the instance restarted".

Point it at any Upstash-compatible Redis REST endpoint (the Upstash integration
in the Vercel marketplace has a free tier and sets `KV_REST_API_*` for you):

```bash
VISIT_KV_REST_API_URL=https://xxx.upstash.io
VISIT_KV_REST_API_TOKEN=...
```

`KV_REST_API_URL` / `KV_REST_API_TOKEN` are also picked up, so the Vercel
integration's own variables work with no extra configuration. When Redis is
configured it becomes the source of truth for the report; the last 5000 records
are kept. The report header tells you which store it read from, and warns when
running on Vercel without one.

### Get pinged instead of checking

```bash
VISIT_WEBHOOK_URL=https://hooks.slack.com/services/...   # or a Discord webhook
```

Fires once per new session — not once per request — so someone reading three
pages produces one message, not three. Bots are never sent; link unfurls are.

### Flag the visitors you actually care about

```bash
VISIT_WATCH=gallagher,waltham
```

Comma-separated substrings matched against the visitor's network, city, region,
referrer and host. Matches sort to the top of the report with a badge, and get a
🎯 in the webhook message. Purely presentational — it changes nothing about what
is recorded.

### Name the network a visitor is on

```bash
VISIT_IPINFO_TOKEN=...      # ipinfo.io, free tier is enough
```

Turns a bare address into `AS1234 Example Corp · host.example.com`. This is the
difference between "someone near Boston" and a recognisable employer, and it is
what `VISIT_WATCH` matches against most usefully.

Off by default because it forwards the visitor's IP to a third party. Results
are cached for 30 days per address.

### Keep your own visits out of the log

```bash
VISIT_IGNORE_IPS=203.0.113.5,198.51.100.7
VISIT_IGNORE_PATHS=/health
```

Both are read by the recorder route at request time, so changing them takes
effect immediately without a redeploy.

### Everything else

| Variable | Default | Purpose |
|---|---|---|
| `VISIT_TRACKING` | on | Set to `0`/`off`/`false` to record nothing at all |
| `VISIT_RETENTION_DAYS` | `90` | How long rows are kept in SQLite |
| `VISIT_SIGNING_SECRET` | `SESSION_SECRET` | HMAC key for the internal beacon |

`VISIT_TRACKING` is evaluated in middleware, which Next.js bundles for the edge
runtime with `process.env` inlined at build time — changing it requires a
redeploy, unlike the recorder-side variables above.

## How it works

```
request
  → middleware.ts               edge runtime; calls trackVisit(), returns immediately
      → after(...)              runs once the response is already sent
          → collectVisit()      classify, extract IP/geo, drop prefetch and assets
          → POST /api/events    HMAC-signed with VISIT_SIGNING_SECRET
              → route.ts        Node runtime
                  → enrich      optional ipinfo lookup
                  → record      SQLite + Redis
                  → notify      webhook, once per session
```

The hop exists because middleware runs on the edge runtime and cannot open
SQLite. The HMAC exists because that route is publicly reachable — without a
signature anyone could write fabricated visits into your log. Requests are
rejected if the signature is missing, wrong, or more than five minutes old.

### Deployment Protection and the internal hop

Vercel's Deployment Protection sits in front of the entire deployment,
*including* the middleware's own request to `/api/events` — verified on a
protected preview deployment, where the hop came back `401`. Preview
deployments are protected by default; production normally is not, so the hop
works there without any of this.

Two ways through, if you need it on a protected deployment:

1. Turn on **Protection Bypass for Automation** in the project's settings. That
   populates `VERCEL_AUTOMATION_BYPASS_SECRET`, which the beacon then sends as
   `x-vercel-protection-bypass` automatically — no further configuration.
2. Configure the Redis store. The recorder is then no longer the only path to
   durable history.

Either way, nothing is lost silently: when the hop fails for any reason, the
middleware writes the same `[visit] …` line to the runtime log that the
recorder would have, so the deployment's logs remain a working fallback sink.

### Files

| Path | Role |
|---|---|
| `src/lib/visits/collect.ts` | Request → `Visit`; classification and filtering (edge-safe) |
| `src/lib/visits/beacon.ts` | Middleware-side dispatch |
| `src/lib/visits/signature.ts` | HMAC for the internal hop |
| `src/lib/visits/store.ts` | SQLite + Redis persistence |
| `src/lib/visits/enrich.ts` | Optional IP → network lookup |
| `src/lib/visits/notify.ts` | Webhook |
| `src/lib/visits/sessions.ts` | Hits → sessions, summary stats |
| `src/lib/visits/report.ts` | HTML rendering |
| `src/app/api/events/route.ts` | Recorder (POST) and report (GET) |

## What it deliberately does not count

**Prefetches.** Next.js prefetches every `<Link>` in the viewport, so opening
one page fires background requests for every other route in the nav — measured
against a production build, loading `/dashboard` alone produced requests for
thirteen other routes. Recording those would claim the visitor read the whole
app.

Next.js strips its own `next-router-prefetch` and `rsc` headers before
middleware runs, so those cannot be used to identify them. What survives is the
browser's Fetch Metadata, and that is what the filter uses:

| | real navigation | prefetch / client-side nav |
|---|---|---|
| `sec-fetch-dest` | `document` | `empty` |
| `sec-fetch-mode` | `navigate` | `cors` |

**The consequence:** in-app navigation after the first page is *not* counted,
because at this layer it is indistinguishable from a prefetch. A session
normally shows the page they landed on rather than every page they clicked. A
landing page per visit is the honest reading; a page list padded with links
nobody clicked is not.

Clients that send no `Sec-Fetch-*` headers at all — crawlers, link unfurlers,
`curl` — are always kept.

## Reading the report

- **Visits** — sessions from something that looks like a real browser.
- **Link previews** — Slack, Teams, iMessage, WhatsApp, LinkedIn and friends
  fetching the page to build an unfurl card. These are worth their own section:
  an unfurl means a *person pasted your link into a conversation*, which is
  often the first sign a link is circulating inside a company.
- **Bots and crawlers** — collapsed by default.

## Limitations worth knowing

- **An IP is a network, not a person.** It identifies an office, a VPN exit or
  a phone carrier. Several people share one; one person changes theirs between
  office, home and mobile.
- **Geo is approximate.** Vercel's city-level headers are derived from the
  address and are regularly wrong by a metro area, and useless behind a VPN.
- **Corporate email scanners open links.** A hit shortly after you send a
  message may be a security appliance, not a reader.
- **Off Vercel, the geo and IP headers can be spoofed** by the client, since
  nothing upstream is overwriting them. On Vercel, `x-vercel-forwarded-for` is
  set by the platform and is the value used.

## Privacy

Server-side request logging is ordinary — every web server does it, and this
records nothing a standard access log wouldn't. It is still personal data under
GDPR/UK GDPR and similar regimes, so if the deployment is public and may be
visited from those jurisdictions, the usual expectations apply: mention it in a
privacy notice, keep the retention window short (`VISIT_RETENTION_DAYS`), and
don't keep it longer than it is useful.

To turn everything off, set `VISIT_TRACKING=0` and redeploy. To also drop the
history, delete the `site_visits` table rows and the `tgg:visits:*` Redis keys.

## Security notes

- `site_visits` is deliberately **not** in the query engine's `ALLOWED_TABLES`
  (`src/lib/localdb/engine.ts`). Demo mode signs every visitor in as the demo
  user, so anything reachable through `/api/db` would be readable by the very
  people the table records. There is a test asserting this.
- For the same reason the report is gated on `VISIT_ACCESS_KEY` rather than on a
  session — a session check would let visitors read the recording of themselves.
- The key is compared in constant time, and a bad key is answered with the same
  bare 404 as a missing route.
