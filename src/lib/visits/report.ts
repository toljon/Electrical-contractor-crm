// Renders the visit log as a self-contained HTML page.
//
// Everything interpolated here — user agents, referrers, paths, query strings —
// is attacker-controlled: a visitor picks their own headers. It all goes through
// `esc`. No external stylesheet, font or script, so the page works from a phone
// on a bad connection and leaks nothing to a third party.

import { storeLabel } from './store'
import { describeDevice } from './notify'
import type { VisitSession } from './types'
import type { VisitSummary } from './sessions'

export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function relativeTime(iso: string, now = Date.now()): string {
  const delta = now - Date.parse(iso)
  if (!Number.isFinite(delta)) return iso
  const minutes = Math.round(delta / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 31) return `${days}d ago`
  return `${Math.round(days / 30)}mo ago`
}

function place(session: VisitSession): string {
  const parts = [session.city, session.region, session.country].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : 'unknown location'
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

function sessionRow(session: VisitSession, now: number): string {
  const pages = session.paths
    .map((p) => `<code class="page">${esc(truncate(p, 60))}</code>`)
    .join(' ')

  // For a crawler or unfurler the matched agent name says more than a guess at
  // its browser and OS ever could.
  const meta: string[] =
    session.kind === 'human' || !session.kindReason
      ? [describeDevice(session.userAgent)]
      : [session.kindReason]
  if (session.timezone) meta.push(session.timezone)
  if (session.hits > 1) meta.push(`${session.hits} requests`)

  return `
  <article class="session${session.watched ? ' watched' : ''}">
    <header>
      <div class="who">
        ${session.watched ? '<span class="tag hit">watched</span>' : ''}
        ${session.kind === 'preview' ? '<span class="tag preview">link preview</span>' : ''}
        <strong>${esc(place(session))}</strong>
      </div>
      <time datetime="${esc(session.lastAt)}" title="${esc(session.lastAt)}">${esc(relativeTime(session.lastAt, now))}</time>
    </header>
    <dl>
      <div><dt>IP</dt><dd><code>${esc(session.ip ?? 'unknown')}</code></dd></div>
      ${session.network ? `<div><dt>Network</dt><dd>${esc(session.network)}</dd></div>` : ''}
      ${session.referrer ? `<div><dt>Came from</dt><dd>${esc(truncate(session.referrer, 90))}</dd></div>` : ''}
      <div><dt>Pages</dt><dd class="pages">${pages}</dd></div>
      <div><dt>Client</dt><dd class="muted">${esc(meta.join(' · '))}</dd></div>
    </dl>
  </article>`
}

function statCard(label: string, value: string | number, hint?: string): string {
  return `<div class="stat"><span class="value">${esc(value)}</span><span class="label">${esc(label)}</span>${
    hint ? `<span class="hint">${esc(hint)}</span>` : ''
  }</div>`
}

export function renderReport(
  sessions: VisitSession[],
  summary: VisitSummary,
  now = Date.now()
): string {
  // Watched sessions sort to the top of their own list rather than getting a
  // section of their own — a separate block would print the same session twice.
  const byWatchedThenRecent = (a: VisitSession, b: VisitSession) =>
    Number(b.watched) - Number(a.watched) || b.lastAt.localeCompare(a.lastAt)

  const humans = sessions.filter((s) => s.kind === 'human').sort(byWatchedThenRecent)
  const previews = sessions.filter((s) => s.kind === 'preview').sort(byWatchedThenRecent)
  const bots = sessions.filter((s) => s.kind === 'bot')

  // On Vercel without Redis the log lives in /tmp, which is per-instance and
  // wiped on cold start. Saying so is important: an empty report would
  // otherwise read as "nobody visited" when it means "the instance restarted".
  const ephemeral = storeLabel() === 'sqlite' && process.env.VERCEL === '1'

  const section = (title: string, list: VisitSession[], emptyNote: string) => `
    <h2>${esc(title)} <span class="count">${list.length}</span></h2>
    ${
      list.length === 0
        ? `<p class="empty">${esc(emptyNote)}</p>`
        : list.map((s) => sessionRow(s, now)).join('')
    }`

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Site activity</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 1.25rem;
    background: #0b0d10; color: #e6e8eb;
    font: 15px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  .wrap { max-width: 780px; margin: 0 auto; }
  h1 { font-size: 1.25rem; margin: 0 0 .25rem; }
  .sub { color: #8b939e; font-size: .8rem; margin: 0 0 1.25rem; }
  h2 { font-size: .95rem; margin: 2rem 0 .75rem; display: flex; align-items: center; gap: .5rem; }
  .count {
    font-size: .7rem; font-weight: 600; color: #8b939e;
    background: #1a1e24; border-radius: 999px; padding: .1rem .5rem;
  }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: .6rem; }
  .stat { background: #12151a; border: 1px solid #1e232b; border-radius: 10px; padding: .75rem .85rem; }
  .stat .value { display: block; font-size: 1.5rem; font-weight: 650; letter-spacing: -.02em; }
  .stat .label { display: block; font-size: .72rem; color: #8b939e; text-transform: uppercase; letter-spacing: .04em; }
  .stat .hint { display: block; font-size: .72rem; color: #6b7280; margin-top: .15rem; }
  .banner {
    background: #2a1f0b; border: 1px solid #4d3a10; color: #f0c674;
    border-radius: 10px; padding: .7rem .85rem; font-size: .8rem; margin-bottom: 1rem;
  }
  .session {
    background: #12151a; border: 1px solid #1e232b;
    border-radius: 10px; padding: .8rem .9rem; margin-bottom: .6rem;
  }
  .session.watched { border-color: #b45309; background: #1a1408; }
  .session header { display: flex; justify-content: space-between; align-items: baseline; gap: .75rem; margin-bottom: .55rem; }
  .who { display: flex; align-items: center; gap: .4rem; flex-wrap: wrap; min-width: 0; }
  .session time { color: #8b939e; font-size: .78rem; white-space: nowrap; }
  .tag {
    font-size: .62rem; text-transform: uppercase; letter-spacing: .05em;
    border-radius: 4px; padding: .1rem .35rem; font-weight: 700;
  }
  .tag.hit { background: #b45309; color: #1a1408; }
  .tag.preview { background: #1e3a5f; color: #93c5fd; }
  dl { margin: 0; display: grid; gap: .3rem; }
  dl > div { display: grid; grid-template-columns: 5.5rem 1fr; gap: .5rem; align-items: start; }
  dt { color: #6b7280; font-size: .75rem; }
  dd { margin: 0; font-size: .82rem; word-break: break-word; min-width: 0; }
  dd.muted { color: #8b939e; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .78rem; }
  .pages { display: flex; flex-wrap: wrap; gap: .25rem; }
  .page { background: #1a1e24; border-radius: 4px; padding: .05rem .35rem; }
  .empty { color: #6b7280; font-size: .82rem; margin: 0 0 .5rem; }
  details { margin-top: .5rem; }
  summary { cursor: pointer; color: #8b939e; font-size: .82rem; }
  footer { margin-top: 2.5rem; color: #4b5563; font-size: .72rem; }
  @media (max-width: 480px) { dl > div { grid-template-columns: 4.5rem 1fr; } }
</style>
</head>
<body>
<div class="wrap">
  <h1>Site activity</h1>
  <p class="sub">
    ${esc(summary.totalHits)} requests · store: ${esc(storeLabel())} ·
    generated <time datetime="${esc(new Date(now).toISOString())}">${esc(new Date(now).toISOString())}</time>
  </p>

  ${
    ephemeral
      ? `<p class="banner"><strong>History is not durable.</strong> Running on Vercel without Redis configured, so the log lives in <code>/tmp</code> and is lost on every cold start. Set <code>VISIT_KV_REST_API_URL</code> and <code>VISIT_KV_REST_API_TOKEN</code> to keep history.</p>`
      : ''
  }

  <div class="stats">
    ${statCard('Visits', summary.humanSessions, `${summary.humanSessions7d} in last 7d`)}
    ${statCard('Unique IPs', summary.uniqueHumanIps)}
    ${statCard('Link shares', summary.previewSessions, 'unfurls')}
    ${statCard(
      'Last visit',
      summary.lastHumanAt ? relativeTime(summary.lastHumanAt, now) : '—'
    )}
    ${summary.watchedSessions > 0 ? statCard('Watched', summary.watchedSessions, 'matched a term') : ''}
  </div>

  ${section('Visits', humans, 'No human visits recorded yet.')}
  ${section('Link previews', previews, 'No unfurls yet — nobody has pasted the URL into a chat app.')}

  <details>
    <summary>Bots and crawlers (${esc(bots.length)})</summary>
    ${bots.length === 0 ? '<p class="empty">None.</p>' : bots.map((s) => sessionRow(s, now)).join('')}
  </details>

  <footer>Private page — not linked from the app. Append <code>&amp;format=json</code> for raw records.</footer>
</div>
<script>
  // Times render as UTC on the server; rewrite to the reader's local zone.
  for (const el of document.querySelectorAll('time[datetime]')) {
    const d = new Date(el.getAttribute('datetime'));
    if (!isNaN(d)) el.title = d.toLocaleString();
  }
  const gen = document.querySelector('.sub time');
  if (gen) { const d = new Date(gen.getAttribute('datetime')); if (!isNaN(d)) gen.textContent = d.toLocaleString(); }
</script>
</body>
</html>`
}
