# ⚡ VoltTrack — Electrical Testing Platform

> Turn field test data into finished, customer-ready reports instantly.

VoltTrack eliminates the 3-4 hours electrical testing companies spend manually generating reports. Technicians capture field data in the app, and professional PDF reports are generated automatically — ready to send the same day.

---

## Stack

- **Next.js 14** (App Router + TypeScript)
- **Supabase** (Postgres + Auth + Storage)
- **Tailwind CSS** + **shadcn/ui**
- **@react-pdf/renderer** — server-side PDF generation
- **react-hook-form** + **zod** — form validation
- **react-dropzone** — photo uploads

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
2. In the SQL editor, run: `supabase/migrations/001_initial_schema.sql`
3. Create a Storage bucket named `report-photos`

### 3. Configure environment

```bash
cp .env.local.example .env.local
# Fill in your Supabase URL, anon key, and service role key
```

### 4. Run

```bash
npm run dev
# → http://localhost:3000
```

---

## Core Workflow

```
Login → Create Company → New Report → Add Assets + Readings → Add Findings → Upload Photos → Generate PDF
```

### Report Types Supported
- **NFPA 70B** — Electrical compliance testing (pre-loaded parameters)
- **Infrared** — Thermal imaging inspections (pre-loaded parameters)
- **Power Systems** — Load and stress testing
- **Preventative Maintenance** — Ongoing equipment servicing

### PDF Reports Include
- Cover page with customer info, site, technician, test date
- Asset inventory with full equipment details
- Test readings table (color-coded PASS / FAIL / MARGINAL)
- Findings section (sorted by severity: Critical → Major → Minor → Observation)
- Photo appendix
- Technician signature block

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/login/          # Login / signup
│   ├── (dashboard)/           # Protected app shell
│   │   ├── page.tsx           # Dashboard
│   │   ├── reports/           # Report CRUD + wizard
│   │   ├── companies/         # Customer management
│   │   └── settings/          # Account + setup guide
│   └── api/
│       ├── reports/[id]/pdf/  # PDF generation endpoint
│       └── photos/upload/     # Photo upload endpoint
├── components/
│   ├── pdf/ReportTemplate.tsx # @react-pdf/renderer template
│   ├── reports/               # Field input components
│   └── layout/Sidebar.tsx
├── lib/supabase/              # Client + server Supabase clients
├── types/database.ts          # All types + constants
└── middleware.ts              # Auth protection
supabase/
└── migrations/001_initial_schema.sql
```

---

## Target Market

Mid-sized electrical testing & compliance companies (10-75 technicians, $2-20M revenue) currently using Word/Excel for reporting.

**Report Types Targeted:** NFPA 70B · Infrared · Power Systems · Preventative Maintenance

---

## Agency Agents

This project uses [agency-agents](https://github.com/msitarzewski/agency-agents) for AI-assisted development. Install agents to `~/.claude/agents/` to activate them.
