# 🔧 TGG Ops — TG Gallagher Mechanical Operations Platform

> Field service, inspection reporting, and BIM-driven prefab tracking for TG Gallagher — HVAC, plumbing, and fire protection.

TGG Ops is the operations platform for [TG Gallagher](https://www.tggallagher.com), a mechanical contractor headquartered in Waltham, MA serving large commercial construction projects across Greater Boston. It covers two sides of the business:

1. **Service & inspections** — customers, locations, mechanical equipment inventory, work orders, and compliance inspection reports (ASHRAE 180 PM, NFPA 25, backflow, TAB, med gas, commissioning) with AI-generated executive summaries and same-day PDF delivery.
2. **Construction & prefab** — commercial projects (life science, healthcare, higher ed) tracked from preconstruction through warranty, with BIM-driven prefab assembly tracking (spools, duct sections, multi-trade racks) from model release to field install.

The prefab module doubles as a growing dataset — estimated vs. actual shop hours per assembly type — that feeds project estimation, prefab optimization, and (paired with equipment service history) predictive maintenance.

---

## Stack

- **Next.js 16** (App Router + TypeScript)
- **Supabase** (Postgres + Auth + Storage, multi-tenant with RLS)
- **Tailwind CSS** + **shadcn/ui**
- **@react-pdf/renderer** — server-side PDF generation
- **@anthropic-ai/sdk** — AI executive summaries for inspection reports
- **react-hook-form** + **zod** — form validation
- **react-dropzone** — field photo uploads

---

## Quick Start

### 1. Clone & install

```bash
git clone <repo>
cd Electrical-contractor-crm
npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. In the SQL editor, run the migrations in order:
   `001_initial_schema.sql` → `002_erp_schema.sql` → `003_tg_gallagher_mechanical.sql`
3. Create a Storage bucket named `report-photos`

### 3. Configure environment

```bash
cp .env.local.example .env.local
# Fill in your Supabase URL, anon key, and service role key
# Add ANTHROPIC_API_KEY for AI report summaries
```

### 4. Run

```bash
npm run dev
# → http://localhost:3000
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
