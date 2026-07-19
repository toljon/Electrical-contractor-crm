# 🔧 TGG Ops — TG Gallagher Mechanical Operations Platform

> Field service, inspection reporting, and BIM-driven prefab tracking for TG Gallagher — HVAC, plumbing, and fire protection.

TGG Ops is the operations platform for [TG Gallagher](https://www.tggallagher.com), a mechanical contractor headquartered in Waltham, MA serving large commercial construction projects across Greater Boston. It covers two sides of the business:

1. **Service & inspections** — customers, locations, mechanical equipment inventory, work orders, and compliance inspection reports (ASHRAE 180 PM, NFPA 25, backflow, TAB, med gas, commissioning) with AI-generated executive summaries and same-day PDF delivery.
2. **Construction & prefab** — commercial projects (life science, healthcare, higher ed) tracked from preconstruction through warranty, with BIM-driven prefab assembly tracking (spools, duct sections, multi-trade racks) from model release to field install.

The prefab module doubles as a growing dataset — estimated vs. actual shop hours per assembly type — that feeds project estimation, prefab optimization, and (paired with equipment service history) predictive maintenance.

---

## How This Fits With Your ERP

TGG Ops is **not** an ERP replacement — it's the operational data layer that
sits on top of one. An ERP (Trimble/Viewpoint Vista, Spectrum, etc.) remains
the system of record for money: GL, AP/AR, job costing, union payroll,
subcontracts, WIP, and compliance. TGG Ops captures what the ERP never sees:

| Layer | ERP (system of record) | TGG Ops (operational layer) |
|---|---|---|
| Field service | Invoices a service call | Tech enters readings from the mechanical room, phone-first; same-day NFPA 25 / ASHRAE 180 / backflow PDF |
| Prefab shop | Cost codes and labor dollars | Est-vs-actual **shop hours per assembly type** — which assemblies run over, which run under |
| Equipment | A fixed asset or a billing line | Multi-year reading history per unit — the raw material for predictive maintenance |
| Intelligence | Reports on what happened | AI summaries, failure-trend detection, estimating feedback loops |

The natural integration is one-way-then-two-way sync: TGG Ops adopts the
ERP's job numbers and cost codes, and pushes completed work orders and shop
hours back — making the ERP's job costing *more* accurate, not competing
with it.

---

## Stack

- **Next.js 16** (App Router + TypeScript)
- **Embedded SQLite** (better-sqlite3) — zero-config local database with
  org scoping enforced server-side; no external database service required
- **Cookie-session auth** — signed HMAC sessions, scrypt password hashing
- **Tailwind CSS** + **shadcn/ui**
- **@react-pdf/renderer** — server-side PDF generation
- **@anthropic-ai/sdk** — AI executive summaries for inspection reports
- **react-hook-form** + **zod** — form validation
- **react-dropzone** — field photo uploads (stored on local disk)

> This version is fully self-contained. The database lives at
> `data/tgg-ops.db` and photos in `data/uploads/` — back up `data/` to keep
> everything. The data layer speaks the Supabase client API
> (`src/lib/supabase/*` are drop-in local adapters), so moving to hosted
> Supabase later is a matter of swapping those two files back —
> see [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md).

---

## Quick Start

```bash
git clone <repo>
cd Electrical-contractor-crm
npm install
npm run dev
# → http://localhost:3000 — you land straight on the seeded demo dashboard
```

**Demo mode is on by default**: an empty database auto-seeds the TG Gallagher
demo dataset and every visitor is signed in automatically as
`demo@tggallagher.com` — no login screen. Set `TGG_DEMO_MODE=0` to restore
the real login/signup flow (`npm run seed` recreates the demo data and its
login `demo@tggallagher.com` / `gallagher`).

Optional environment (`.env.local`):

```bash
ANTHROPIC_API_KEY=...   # enables AI executive summaries on reports
SESSION_SECRET=...      # set in production; dev falls back to a fixed secret
TGG_DEMO_MODE=0         # turn OFF auto-login + auto-seed (real auth flow)
```

---

## Core Workflows

**Service / inspection:**

```
Login → Customer → Location → Equipment → Work Order → Inspection Report
      → Readings + Findings + Photos → AI Summary → PDF
```

**Construction / prefab:**

```
Project (GC, market, trades, BIM model) → Prefab Assemblies
      → Modeled → Released → Fabrication → QC → Shipped → Installed
```

### Trades

HVAC · Plumbing · Fire Protection — equipment, work orders, and prefab assemblies are all trade-tagged.

### Inspection Report Types

- **ASHRAE/ACCA 180** — HVAC preventive maintenance
- **NFPA 25** — Fire protection inspection, testing & maintenance
- **Backflow** — Backflow prevention assembly testing
- **TAB** — Testing, adjusting & balancing
- **NFPA 99** — Medical gas verification (hospital/lab work)
- **Commissioning** — Functional performance testing

### PDF Reports Include

- Cover page with customer, site, technician, and test date
- Equipment inventory with capacity ratings and service details
- Test readings table (color-coded PASS / FAIL / MARGINAL)
- Findings sorted by severity (Critical → Major → Minor → Observation) with code references
- Photo documentation and signature block
- AI-generated executive summary

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/login/          # Login / signup
│   ├── (onboarding)/          # Organization setup
│   ├── (dashboard)/           # Protected app shell
│   │   ├── dashboard/         # Daily ops overview
│   │   ├── projects/          # Construction projects (BIM, phases)
│   │   ├── prefab/            # Prefab shop pipeline
│   │   ├── customers/         # Customers, locations, equipment
│   │   ├── work-orders/       # Field work scheduling
│   │   ├── reports/           # Inspection report wizard
│   │   └── settings/          # Account + setup guide
│   └── api/
│       ├── reports/[id]/pdf/       # PDF generation
│       ├── reports/[id]/generate/  # AI executive summary
│       └── photos/upload/          # Field photo upload
├── components/
│   ├── pdf/ReportTemplate.tsx # @react-pdf/renderer template
│   ├── reports/               # Field input components
│   └── layout/Sidebar.tsx
├── lib/
│   ├── agents/report-agent.ts # Claude-powered summary generation
│   └── supabase/              # Client + server Supabase clients
├── types/database.ts          # Domain types + trade/report taxonomies
└── middleware.ts              # Auth protection
supabase/
└── migrations/                # 001 → 003 (003 = mechanical + prefab schema)
```

---

## Data & AI Roadmap

The schema is deliberately structured to accumulate the datasets that matter to a mechanical contractor with a BIM/prefab operation:

- **Estimation** — `prefab_assemblies.shop_hours_estimated` vs `shop_hours_actual` by assembly type, trade, and project market
- **Prefab optimization** — pipeline stage durations (released → fabricated → shipped → installed) to find shop bottlenecks
- **Predictive maintenance** — `equipment` service history + `test_readings` trends (ΔT drift, pressure drop, flow degradation) to flag failures before they happen
- **Report automation** — AI executive summaries today; auto-drafted findings and code references next

---

## Agency Agents

This project uses [agency-agents](https://github.com/msitarzewski/agency-agents) for AI-assisted development. Install agents to `~/.claude/agents/` to activate them.
