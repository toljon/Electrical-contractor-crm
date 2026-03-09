# VoltTrack ERP — Phase 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild VoltTrack from a report-centric MVP into an ERP-first platform where contractors manage customers, locations, equipment, and work orders — with field execution (inspection checklists, test readings, findings, photos) and auto-generated PDF reports as the output of a completed work order.

**Architecture:** Multi-tenant Next.js 16 app (App Router) backed by Supabase Postgres with RLS per `org_id`. The current schema is scrapped and replaced with an ERP-first hierarchy: `organizations → customers → locations → equipment` and `organizations → work_orders → inspection_reports → findings/readings/photos`. The Claude API (Anthropic Agent SDK) powers the Report Agent that auto-generates and emails reports on work order completion.

**Tech Stack:** Next.js 16, Supabase (Postgres + Auth + Storage), Tailwind + shadcn/ui, @react-pdf/renderer, Anthropic SDK, Resend (email), Vitest (unit tests), Playwright (E2E)

**BRD Reference:** `docs/plans/2026-03-09-volttrack-erp-design.md`

---

## Pre-Flight: Read These First

- `docs/plans/2026-03-09-volttrack-erp-design.md` — full product spec and entity model
- `supabase/migrations/001_initial_schema.sql` — current schema (being replaced)
- `src/lib/supabase/` — existing Supabase client setup (server.ts and client.ts, keep these)
- `src/components/ui/` — shadcn components already installed, use them

---

## Task 1: Test Infrastructure Setup

**Files:**
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Modify: `package.json`

**Step 1: Install Vitest**

```bash
npm install -D vitest @vitejs/plugin-react @vitest/ui jsdom
```

**Step 2: Create vitest config**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

**Step 3: Create test setup**

Create `src/test/setup.ts`:
```ts
import '@testing-library/jest-dom'
```

**Step 4: Add test scripts to package.json**

Add to `scripts`:
```json
"test": "vitest",
"test:ui": "vitest --ui",
"test:run": "vitest run"
```

Install testing library:
```bash
npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

**Step 5: Write a smoke test**

Create `src/test/smoke.test.ts`:
```ts
describe('test infrastructure', () => {
  it('works', () => {
    expect(1 + 1).toBe(2)
  })
})
```

**Step 6: Run and confirm passing**

```bash
npm run test:run
```
Expected: `1 passed`

**Step 7: Commit**

```bash
git add vitest.config.ts src/test/ package.json package-lock.json
git commit -m "chore: add Vitest test infrastructure"
```

---

## Task 2: New Database Schema

**Files:**
- Create: `supabase/migrations/002_erp_schema.sql`

The current `001_initial_schema.sql` tables (profiles, companies, sites, test_reports, assets, test_readings, findings, photos) are being replaced. The new schema is org-first.

**Step 1: Write the migration**

Create `supabase/migrations/002_erp_schema.sql`:

```sql
-- VoltTrack ERP Schema
-- Replaces report-centric MVP schema with ERP-first hierarchy

-- Drop old tables (order matters for FK constraints)
DROP TABLE IF EXISTS photos CASCADE;
DROP TABLE IF EXISTS findings CASCADE;
DROP TABLE IF EXISTS test_readings CASCADE;
DROP TABLE IF EXISTS assets CASCADE;
DROP TABLE IF EXISTS test_reports CASCADE;
DROP TABLE IF EXISTS sites CASCADE;
DROP TABLE IF EXISTS companies CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- ─────────────────────────────────────────────
-- ORGANIZATIONS (tenants)
-- ─────────────────────────────────────────────
CREATE TABLE organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  logo_url    TEXT,
  primary_color TEXT DEFAULT '#EAB308',
  address     TEXT,
  city        TEXT,
  state       TEXT,
  zip         TEXT,
  phone       TEXT,
  email       TEXT,
  website     TEXT,
  license_number TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- PROFILES (extends auth.users, belongs to org)
-- ─────────────────────────────────────────────
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id      UUID REFERENCES organizations(id) ON DELETE CASCADE,
  full_name   TEXT,
  role        TEXT DEFAULT 'technician'
                CHECK (role IN ('admin', 'manager', 'technician', 'sales')),
  title       TEXT,
  phone       TEXT,
  certifications TEXT[], -- e.g. ['NETA Level III', 'NFPA 70E']
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- CUSTOMERS (the contractor's clients)
-- ─────────────────────────────────────────────
CREATE TABLE customers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  dba             TEXT,
  customer_type   TEXT CHECK (customer_type IN ('commercial', 'industrial', 'government', 'utility')),
  billing_address TEXT,
  billing_city    TEXT,
  billing_state   TEXT,
  billing_zip     TEXT,
  payment_terms   TEXT DEFAULT 'net30' CHECK (payment_terms IN ('net15', 'net30', 'net60', 'prepaid')),
  tax_exempt      BOOLEAN DEFAULT false,
  notes           TEXT,
  status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- CONTACTS (multiple per customer)
-- ─────────────────────────────────────────────
CREATE TABLE contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  title       TEXT,
  email       TEXT,
  phone       TEXT,
  contact_type TEXT DEFAULT 'primary'
                CHECK (contact_type IN ('primary', 'billing', 'operations', 'safety', 'other')),
  is_primary  BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- LOCATIONS (sites per customer)
-- ─────────────────────────────────────────────
CREATE TABLE locations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  address         TEXT,
  city            TEXT,
  state           TEXT,
  zip             TEXT,
  latitude        NUMERIC,
  longitude       NUMERIC,
  site_contact    TEXT,
  site_phone      TEXT,
  site_email      TEXT,
  access_notes    TEXT,
  service_hours   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- EQUIPMENT (assets per location)
-- ─────────────────────────────────────────────
CREATE TABLE equipment (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id     UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  equipment_type  TEXT NOT NULL, -- from taxonomy: 'switchgear', 'transformer', etc.
  manufacturer    TEXT,
  model           TEXT,
  serial_number   TEXT,
  qr_code         TEXT UNIQUE,
  voltage_rating  TEXT,
  kva_rating      TEXT,
  install_date    DATE,
  last_inspected  DATE,
  location_detail TEXT, -- 'Building A, Room 101, MCC-1'
  status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'decommissioned', 'removed')),
  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- CONTRACTS
-- ─────────────────────────────────────────────
CREATE TABLE contracts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id         UUID NOT NULL REFERENCES customers(id),
  contract_number     TEXT,
  contract_type       TEXT DEFAULT 'inspection'
                        CHECK (contract_type IN ('inspection', 'service', 'installation', 'msa')),
  status              TEXT DEFAULT 'active'
                        CHECK (status IN ('draft', 'active', 'expired', 'cancelled')),
  start_date          DATE NOT NULL,
  end_date            DATE,
  auto_renew          BOOLEAN DEFAULT true,
  renewal_notice_days INT DEFAULT 60,
  inspection_frequency TEXT
                        CHECK (inspection_frequency IN ('monthly', 'quarterly', 'semi_annual', 'annual')),
  value_cents         INT, -- annual contract value in cents
  payment_terms       TEXT DEFAULT 'net30',
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- WORK ORDERS (operational spine)
-- ─────────────────────────────────────────────
CREATE TABLE work_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id     UUID NOT NULL REFERENCES customers(id),
  location_id     UUID REFERENCES locations(id),
  contract_id     UUID REFERENCES contracts(id),
  assigned_to     UUID REFERENCES profiles(id),
  order_number    TEXT,
  work_type       TEXT DEFAULT 'inspection'
                    CHECK (work_type IN ('inspection', 'repair', 'installation', 'emergency')),
  status          TEXT DEFAULT 'created'
                    CHECK (status IN ('created', 'assigned', 'en_route', 'on_site', 'in_progress', 'complete', 'invoiced', 'cancelled')),
  scheduled_date  DATE,
  scheduled_time  TIME,
  estimated_hours NUMERIC,
  priority        TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'emergency')),
  special_instructions TEXT,
  report_generated BOOLEAN DEFAULT false,
  report_sent     BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- INSPECTION REPORTS (output of a completed work order)
-- ─────────────────────────────────────────────
CREATE TABLE inspection_reports (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  work_order_id       UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  customer_id         UUID NOT NULL REFERENCES customers(id),
  location_id         UUID REFERENCES locations(id),
  report_number       TEXT,
  report_type         TEXT CHECK (report_type IN ('nfpa_70b', 'neta_mts', 'infrared', 'power_quality', 'arc_flash', 'acceptance')),
  test_date           DATE NOT NULL DEFAULT CURRENT_DATE,
  technician_id       UUID REFERENCES profiles(id),
  technician_name     TEXT,
  technician_certs    TEXT,
  ambient_temp_f      NUMERIC,
  humidity_pct        NUMERIC,
  weather_conditions  TEXT,
  executive_summary   TEXT, -- AI-generated
  compliance_statement TEXT,
  next_inspection_date DATE,
  customer_signature  TEXT, -- base64 or storage path
  signed_by           TEXT,
  signed_at           TIMESTAMPTZ,
  pdf_url             TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- TEST READINGS (measurements per equipment item)
-- ─────────────────────────────────────────────
CREATE TABLE test_readings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  report_id       UUID NOT NULL REFERENCES inspection_reports(id) ON DELETE CASCADE,
  equipment_id    UUID REFERENCES equipment(id),
  parameter       TEXT NOT NULL,
  value           TEXT,
  unit            TEXT,
  result          TEXT CHECK (result IN ('pass', 'fail', 'marginal', 'n/a')),
  notes           TEXT,
  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- FINDINGS (deficiencies discovered during inspection)
-- ─────────────────────────────────────────────
CREATE TABLE findings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  report_id       UUID NOT NULL REFERENCES inspection_reports(id) ON DELETE CASCADE,
  equipment_id    UUID REFERENCES equipment(id),
  severity        TEXT CHECK (severity IN ('critical', 'major', 'minor', 'observation')),
  description     TEXT NOT NULL,
  standard_ref    TEXT, -- e.g. 'NFPA 70B 11.17.2'
  recommendation  TEXT,
  status          TEXT DEFAULT 'open'
                    CHECK (status IN ('open', 'quoted', 'approved', 'scheduled', 'resolved')),
  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- PHOTOS
-- ─────────────────────────────────────────────
CREATE TABLE photos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  report_id       UUID REFERENCES inspection_reports(id) ON DELETE CASCADE,
  finding_id      UUID REFERENCES findings(id),
  equipment_id    UUID REFERENCES equipment(id),
  storage_path    TEXT NOT NULL,
  caption         TEXT,
  taken_at        TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- TRIGGERS
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER work_orders_updated_at
  BEFORE UPDATE ON work_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Profile auto-creation on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────
ALTER TABLE organizations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment       ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders     ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_readings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE findings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos          ENABLE ROW LEVEL SECURITY;

-- Helper: get current user's org_id from profiles
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid()
$$;

-- Organizations: members can read their own org
CREATE POLICY "org_members" ON organizations
  FOR ALL USING (id = public.current_org_id());

-- Profiles: users can read profiles in their org
CREATE POLICY "profiles_own_org" ON profiles
  FOR ALL USING (org_id = public.current_org_id());

-- All other tables: scoped to org_id
CREATE POLICY "customers_org" ON customers FOR ALL USING (org_id = public.current_org_id());
CREATE POLICY "contacts_org" ON contacts FOR ALL USING (org_id = public.current_org_id());
CREATE POLICY "locations_org" ON locations FOR ALL USING (org_id = public.current_org_id());
CREATE POLICY "equipment_org" ON equipment FOR ALL USING (org_id = public.current_org_id());
CREATE POLICY "contracts_org" ON contracts FOR ALL USING (org_id = public.current_org_id());
CREATE POLICY "work_orders_org" ON work_orders FOR ALL USING (org_id = public.current_org_id());
CREATE POLICY "inspection_reports_org" ON inspection_reports FOR ALL USING (org_id = public.current_org_id());
CREATE POLICY "test_readings_org" ON test_readings FOR ALL USING (org_id = public.current_org_id());
CREATE POLICY "findings_org" ON findings FOR ALL USING (org_id = public.current_org_id());
CREATE POLICY "photos_org" ON photos FOR ALL USING (org_id = public.current_org_id());
```

**Step 2: Run migration in Supabase**

Go to Supabase Dashboard → SQL Editor → paste and run `002_erp_schema.sql`.

Or via CLI if installed:
```bash
supabase db push
```

**Step 3: Verify tables exist**

```bash
curl -s "https://tksrzfjxwpyitghrdfov.supabase.co/rest/v1/organizations?limit=1" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```
Expected: `[]` (empty array, no error)

**Step 4: Commit**

```bash
git add supabase/migrations/002_erp_schema.sql
git commit -m "feat: ERP-first database schema with org-scoped RLS"
```

---

## Task 3: TypeScript Types

**Files:**
- Create: `src/types/database.ts` (replaces existing)

**Step 1: Write types for all new tables**

```ts
// src/types/database.ts

export type Role = 'admin' | 'manager' | 'technician' | 'sales'
export type WorkOrderStatus = 'created' | 'assigned' | 'en_route' | 'on_site' | 'in_progress' | 'complete' | 'invoiced' | 'cancelled'
export type WorkType = 'inspection' | 'repair' | 'installation' | 'emergency'
export type FindingSeverity = 'critical' | 'major' | 'minor' | 'observation'
export type ReadingResult = 'pass' | 'fail' | 'marginal' | 'n/a'
export type ReportType = 'nfpa_70b' | 'neta_mts' | 'infrared' | 'power_quality' | 'arc_flash' | 'acceptance'
export type CustomerType = 'commercial' | 'industrial' | 'government' | 'utility'
export type ContractType = 'inspection' | 'service' | 'installation' | 'msa'
export type InspectionFrequency = 'monthly' | 'quarterly' | 'semi_annual' | 'annual'

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  nfpa_70b: 'NFPA 70B Preventative Maintenance',
  neta_mts: 'ANSI/NETA MTS Maintenance Testing',
  infrared: 'Infrared Thermography',
  power_quality: 'Power Quality Analysis',
  arc_flash: 'Arc Flash Study',
  acceptance: 'NETA ATS Acceptance Testing',
}

export const EQUIPMENT_TYPES = [
  { value: 'switchgear', label: 'Switchgear' },
  { value: 'switchboard', label: 'Switchboard' },
  { value: 'panelboard', label: 'Panelboard' },
  { value: 'mcc', label: 'Motor Control Center (MCC)' },
  { value: 'transformer_dry', label: 'Transformer (Dry-Type)' },
  { value: 'transformer_liquid', label: 'Transformer (Liquid-Filled)' },
  { value: 'circuit_breaker', label: 'Circuit Breaker' },
  { value: 'relay', label: 'Protective Relay' },
  { value: 'vfd', label: 'Variable Frequency Drive (VFD)' },
  { value: 'ups', label: 'Uninterruptible Power Supply (UPS)' },
  { value: 'generator', label: 'Generator' },
  { value: 'transfer_switch', label: 'Transfer Switch (ATS/MTS)' },
  { value: 'motor', label: 'Motor' },
  { value: 'busway', label: 'Busway / Busduct' },
  { value: 'cable', label: 'Cable / Conductor' },
  { value: 'spd', label: 'Surge Protection Device (SPD)' },
  { value: 'emergency_lighting', label: 'Emergency Lighting' },
  { value: 'other', label: 'Other' },
] as const

export const SEVERITY_COLORS: Record<FindingSeverity, string> = {
  critical: 'bg-red-100 text-red-800',
  major: 'bg-orange-100 text-orange-800',
  minor: 'bg-yellow-100 text-yellow-800',
  observation: 'bg-blue-100 text-blue-800',
}

export const STATUS_COLORS: Record<WorkOrderStatus, string> = {
  created: 'bg-gray-100 text-gray-700',
  assigned: 'bg-blue-100 text-blue-700',
  en_route: 'bg-purple-100 text-purple-700',
  on_site: 'bg-indigo-100 text-indigo-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  complete: 'bg-green-100 text-green-700',
  invoiced: 'bg-teal-100 text-teal-700',
  cancelled: 'bg-red-100 text-red-700',
}

// DB row types (matches Supabase schema)
export interface Organization {
  id: string
  name: string
  slug: string
  logo_url: string | null
  primary_color: string
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  phone: string | null
  email: string | null
  license_number: string | null
  created_at: string
}

export interface Profile {
  id: string
  org_id: string | null
  full_name: string | null
  role: Role
  title: string | null
  phone: string | null
  certifications: string[] | null
  created_at: string
}

export interface Customer {
  id: string
  org_id: string
  name: string
  dba: string | null
  customer_type: CustomerType | null
  billing_address: string | null
  billing_city: string | null
  billing_state: string | null
  billing_zip: string | null
  payment_terms: string
  tax_exempt: boolean
  notes: string | null
  status: 'active' | 'inactive'
  created_at: string
}

export interface Location {
  id: string
  org_id: string
  customer_id: string
  name: string
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  site_contact: string | null
  site_phone: string | null
  access_notes: string | null
  created_at: string
}

export interface Equipment {
  id: string
  org_id: string
  location_id: string
  customer_id: string
  name: string
  equipment_type: string
  manufacturer: string | null
  model: string | null
  serial_number: string | null
  qr_code: string | null
  voltage_rating: string | null
  install_date: string | null
  last_inspected: string | null
  location_detail: string | null
  status: 'active' | 'decommissioned' | 'removed'
  sort_order: number
  created_at: string
}

export interface WorkOrder {
  id: string
  org_id: string
  customer_id: string
  location_id: string | null
  contract_id: string | null
  assigned_to: string | null
  order_number: string | null
  work_type: WorkType
  status: WorkOrderStatus
  scheduled_date: string | null
  estimated_hours: number | null
  priority: 'low' | 'normal' | 'high' | 'emergency'
  special_instructions: string | null
  report_generated: boolean
  report_sent: boolean
  created_at: string
  updated_at: string
}

export interface InspectionReport {
  id: string
  org_id: string
  work_order_id: string
  customer_id: string
  location_id: string | null
  report_number: string | null
  report_type: ReportType | null
  test_date: string
  technician_id: string | null
  technician_name: string | null
  technician_certs: string | null
  executive_summary: string | null
  compliance_statement: string | null
  next_inspection_date: string | null
  pdf_url: string | null
  notes: string | null
  created_at: string
}

export interface TestReading {
  id: string
  org_id: string
  report_id: string
  equipment_id: string | null
  parameter: string
  value: string | null
  unit: string | null
  result: ReadingResult | null
  notes: string | null
  sort_order: number
  created_at: string
}

export interface Finding {
  id: string
  org_id: string
  report_id: string
  equipment_id: string | null
  severity: FindingSeverity | null
  description: string
  standard_ref: string | null
  recommendation: string | null
  status: 'open' | 'quoted' | 'approved' | 'scheduled' | 'resolved'
  sort_order: number
  created_at: string
}

export interface Photo {
  id: string
  org_id: string
  report_id: string | null
  finding_id: string | null
  equipment_id: string | null
  storage_path: string
  caption: string | null
  created_at: string
}
```

**Step 2: Write type tests**

Create `src/test/types.test.ts`:
```ts
import { REPORT_TYPE_LABELS, EQUIPMENT_TYPES, SEVERITY_COLORS, STATUS_COLORS } from '@/types/database'

describe('database types', () => {
  it('has label for every report type', () => {
    expect(REPORT_TYPE_LABELS.nfpa_70b).toBe('NFPA 70B Preventative Maintenance')
    expect(REPORT_TYPE_LABELS.infrared).toBe('Infrared Thermography')
  })

  it('has equipment types array', () => {
    expect(EQUIPMENT_TYPES.length).toBeGreaterThan(10)
    expect(EQUIPMENT_TYPES.find(e => e.value === 'switchgear')).toBeDefined()
  })

  it('has severity colors for all severities', () => {
    expect(SEVERITY_COLORS.critical).toContain('red')
    expect(SEVERITY_COLORS.observation).toContain('blue')
  })
})
```

**Step 3: Run tests**

```bash
npm run test:run
```
Expected: all pass

**Step 4: Commit**

```bash
git add src/types/database.ts src/test/types.test.ts
git commit -m "feat: ERP database types and constants"
```

---

## Task 4: Multi-Tenant Auth & Onboarding

**Files:**
- Create: `src/app/(onboarding)/onboarding/page.tsx`
- Modify: `src/app/(auth)/login/page.tsx`
- Modify: `src/middleware.ts`
- Create: `src/lib/auth.ts`

**Context:** When a user signs up, they land in an unboarded state (profile exists, `org_id` is null). Middleware detects this and redirects to `/onboarding` where they create their organization. After org creation, their profile is linked to the org.

**Step 1: Write middleware test**

Create `src/test/middleware.test.ts`:
```ts
// Note: middleware runs in Edge runtime — test the logic, not the middleware itself
import { shouldRedirectToOnboarding } from '@/lib/auth'

describe('auth helpers', () => {
  it('requires onboarding when org_id is null', () => {
    expect(shouldRedirectToOnboarding(null)).toBe(true)
  })

  it('does not require onboarding when org_id is set', () => {
    expect(shouldRedirectToOnboarding('some-uuid')).toBe(false)
  })
})
```

**Step 2: Run and confirm it fails**

```bash
npm run test:run
```
Expected: FAIL — `Cannot find module '@/lib/auth'`

**Step 3: Create auth helpers**

Create `src/lib/auth.ts`:
```ts
export function shouldRedirectToOnboarding(orgId: string | null | undefined): boolean {
  return !orgId
}
```

**Step 4: Run tests, confirm passing**

```bash
npm run test:run
```
Expected: PASS

**Step 5: Update middleware**

Replace `src/middleware.ts` with:
```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  // Public routes
  if (path.startsWith('/login') || path.startsWith('/onboarding')) {
    if (user && path.startsWith('/login')) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return supabaseResponse
  }

  // Unauthenticated → login
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Authenticated but no org → onboarding
  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single()

  if (!profile?.org_id && !path.startsWith('/onboarding')) {
    return NextResponse.redirect(new URL('/onboarding', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}
```

**Step 6: Create onboarding page**

Create `src/app/(onboarding)/onboarding/page.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Zap } from 'lucide-react'

export default function OnboardingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    companyName: '',
    licenseNumber: '',
    phone: '',
    city: '',
    state: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const slug = form.companyName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')

    // Create organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: form.companyName,
        slug: `${slug}-${Math.random().toString(36).slice(2, 6)}`,
        phone: form.phone,
        city: form.city,
        state: form.state,
        license_number: form.licenseNumber,
      })
      .select()
      .single()

    if (orgError) {
      setError(orgError.message)
      setLoading(false)
      return
    }

    // Link profile to org, set role to admin
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ org_id: org.id, role: 'admin' })
      .eq('id', user.id)

    if (profileError) {
      setError(profileError.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="bg-yellow-400 rounded-lg p-2">
            <Zap className="h-6 w-6 text-gray-900" />
          </div>
          <span className="text-2xl font-bold text-gray-900">VoltTrack</span>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Set up your company</CardTitle>
            <CardDescription>This takes 60 seconds. You can update everything later.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="companyName">Company name *</Label>
                <Input
                  id="companyName"
                  value={form.companyName}
                  onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
                  placeholder="Acme Electrical Testing"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={form.city}
                    onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                    placeholder="Boston"
                  />
                </div>
                <div>
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={form.state}
                    onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                    placeholder="MA"
                    maxLength={2}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="(617) 555-0100"
                />
              </div>
              <div>
                <Label htmlFor="licenseNumber">Electrical license number</Label>
                <Input
                  id="licenseNumber"
                  value={form.licenseNumber}
                  onChange={e => setForm(f => ({ ...f, licenseNumber: e.target.value }))}
                  placeholder="E-12345"
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <Button
                type="submit"
                className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold"
                disabled={loading}
              >
                {loading ? 'Setting up…' : 'Get started →'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

**Step 7: Commit**

```bash
git add src/lib/auth.ts src/middleware.ts src/app/\(onboarding\)/ src/test/middleware.test.ts
git commit -m "feat: multi-tenant onboarding flow and updated middleware"
```

---

## Task 5: App Shell & Navigation

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/app/page.tsx`

**Step 1: Update root redirect**

`src/app/page.tsx`:
```tsx
import { redirect } from 'next/navigation'
export default function RootPage() {
  redirect('/dashboard')
}
```

**Step 2: Update sidebar navigation**

Replace `src/components/layout/Sidebar.tsx`:
```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Users, MapPin, Wrench, ClipboardList,
  FileText, Settings, Zap, LogOut
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/work-orders', label: 'Work Orders', icon: ClipboardList },
  { href: '/reports', label: 'Reports', icon: FileText },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="w-60 bg-gray-900 min-h-screen flex flex-col">
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="bg-yellow-400 rounded p-1.5">
            <Zap className="h-4 w-4 text-gray-900" />
          </div>
          <span className="font-bold text-white text-lg">VoltTrack</span>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              pathname.startsWith(href)
                ? 'bg-yellow-400 text-gray-900'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="p-3 border-t border-gray-800">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white w-full transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
```

**Step 3: Update dashboard layout**

Replace `src/app/(dashboard)/layout.tsx` with a layout that imports Sidebar:
```tsx
import { Sidebar } from '@/components/layout/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
```

**Step 4: Commit**

```bash
git add src/app/page.tsx src/components/layout/Sidebar.tsx src/app/\(dashboard\)/layout.tsx
git commit -m "feat: update app shell with ERP navigation"
```

---

## Task 6: Dashboard Page

**Files:**
- Modify: `src/app/(dashboard)/page.tsx` → move to `src/app/(dashboard)/dashboard/page.tsx`
- Create: `src/app/(dashboard)/dashboard/page.tsx`

**Step 1: Create dashboard page**

Create `src/app/(dashboard)/dashboard/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, ClipboardList, AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import { STATUS_COLORS, SEVERITY_COLORS } from '@/types/database'
import type { WorkOrderStatus, FindingSeverity } from '@/types/database'

export default async function DashboardPage() {
  const supabase = await createClient()

  const today = new Date().toISOString().split('T')[0]

  const [
    { data: todayJobs },
    { count: openFindings },
    { count: completedThisMonth },
    { data: recentWorkOrders },
  ] = await Promise.all([
    supabase
      .from('work_orders')
      .select('*, customer:customers(name), location:locations(name)')
      .eq('scheduled_date', today)
      .not('status', 'in', '("cancelled","invoiced")')
      .order('scheduled_date'),
    supabase
      .from('findings')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open'),
    supabase
      .from('work_orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'complete')
      .gte('updated_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    supabase
      .from('work_orders')
      .select('*, customer:customers(name), location:locations(name)')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Link href="/work-orders/new">
          <Button className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold">
            <Plus className="h-4 w-4 mr-2" />
            New Work Order
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Today&apos;s Jobs</CardTitle>
            <Clock className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{todayJobs?.length ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Open Deficiencies</CardTitle>
            <AlertTriangle className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{openFindings ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Completed This Month</CardTitle>
            <CheckCircle className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{completedThisMonth ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Work Orders</CardTitle>
          <Link href="/work-orders" className="text-sm text-yellow-600 hover:underline">View all</Link>
        </CardHeader>
        <CardContent>
          {!recentWorkOrders?.length ? (
            <div className="text-center py-12">
              <ClipboardList className="h-12 w-12 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No work orders yet.</p>
              <Link href="/work-orders/new">
                <Button variant="outline"><Plus className="h-4 w-4 mr-2" />Create First Work Order</Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y">
              {recentWorkOrders.map(wo => (
                <Link key={wo.id} href={`/work-orders/${wo.id}`}
                  className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-2 px-2 rounded transition-colors">
                  <div>
                    <div className="font-medium text-gray-900">
                      {(wo.customer as { name: string } | null)?.name} — {(wo.location as { name: string } | null)?.name ?? 'No location'}
                    </div>
                    <div className="text-sm text-gray-500">{wo.work_type} · {wo.scheduled_date ?? 'Unscheduled'}</div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[wo.status as WorkOrderStatus]}`}>
                    {wo.status.replace('_', ' ')}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/\(dashboard\)/dashboard/
git commit -m "feat: ERP dashboard with work order stats"
```

---

## Task 7: Customer Management (CRM)

**Files:**
- Create: `src/app/(dashboard)/customers/page.tsx`
- Create: `src/app/(dashboard)/customers/new/page.tsx`
- Create: `src/app/(dashboard)/customers/[id]/page.tsx`
- Create: `src/app/(dashboard)/customers/[id]/locations/new/page.tsx`

**Step 1: Customer list page**

Create `src/app/(dashboard)/customers/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Users, ChevronRight, Building2 } from 'lucide-react'

export default async function CustomersPage() {
  const supabase = await createClient()
  const { data: customers } = await supabase
    .from('customers')
    .select('*, locations(count), work_orders(count)')
    .eq('status', 'active')
    .order('name')

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-500 mt-1">{customers?.length ?? 0} active customers</p>
        </div>
        <Link href="/customers/new">
          <Button className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold">
            <Plus className="h-4 w-4 mr-2" />
            Add Customer
          </Button>
        </Link>
      </div>

      {!customers?.length ? (
        <Card>
          <CardContent className="text-center py-16">
            <Users className="h-12 w-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No customers yet.</p>
            <Link href="/customers/new">
              <Button variant="outline"><Plus className="h-4 w-4 mr-2" />Add First Customer</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {customers.map(c => (
            <Link key={c.id} href={`/customers/${c.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-gray-100 rounded-lg p-2">
                      <Building2 className="h-5 w-5 text-gray-500" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{c.name}</div>
                      <div className="text-sm text-gray-500">
                        {c.billing_city && `${c.billing_city}, ${c.billing_state}`}
                        {c.customer_type && ` · ${c.customer_type}`}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 2: New customer form**

Create `src/app/(dashboard)/customers/new/page.tsx` — use a server action to insert and redirect:
```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function NewCustomerPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '', dba: '', customerType: '', billingAddress: '',
    billingCity: '', billingState: '', billingZip: '',
    paymentTerms: 'net30', notes: '',
  })

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { data: profile } = await supabase.from('profiles').select('org_id').single()
    const { data, error: err } = await supabase.from('customers').insert({
      org_id: profile!.org_id,
      name: form.name,
      dba: form.dba || null,
      customer_type: form.customerType || null,
      billing_address: form.billingAddress || null,
      billing_city: form.billingCity || null,
      billing_state: form.billingState || null,
      billing_zip: form.billingZip || null,
      payment_terms: form.paymentTerms,
      notes: form.notes || null,
    }).select().single()
    if (err) { setError(err.message); setLoading(false); return }
    router.push(`/customers/${data.id}`)
  }

  return (
    <div className="p-8 max-w-2xl">
      <Link href="/customers" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to customers
      </Link>
      <Card>
        <CardHeader><CardTitle>New Customer</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Company name *</Label>
                <Input value={form.name} onChange={set('name')} required />
              </div>
              <div className="col-span-2">
                <Label>DBA (if different)</Label>
                <Input value={form.dba} onChange={set('dba')} />
              </div>
              <div>
                <Label>Customer type</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.customerType} onChange={set('customerType')}>
                  <option value="">Select…</option>
                  <option value="commercial">Commercial</option>
                  <option value="industrial">Industrial</option>
                  <option value="government">Government</option>
                  <option value="utility">Utility</option>
                </select>
              </div>
              <div>
                <Label>Payment terms</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.paymentTerms} onChange={set('paymentTerms')}>
                  <option value="net15">Net 15</option>
                  <option value="net30">Net 30</option>
                  <option value="net60">Net 60</option>
                  <option value="prepaid">Prepaid</option>
                </select>
              </div>
              <div className="col-span-2">
                <Label>Billing address</Label>
                <Input value={form.billingAddress} onChange={set('billingAddress')} />
              </div>
              <div>
                <Label>City</Label>
                <Input value={form.billingCity} onChange={set('billingCity')} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>State</Label>
                  <Input value={form.billingState} onChange={set('billingState')} maxLength={2} />
                </div>
                <div>
                  <Label>ZIP</Label>
                  <Input value={form.billingZip} onChange={set('billingZip')} />
                </div>
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3 pt-2">
              <Button type="submit" className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold" disabled={loading}>
                {loading ? 'Saving…' : 'Create customer'}
              </Button>
              <Link href="/customers"><Button variant="outline">Cancel</Button></Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

**Step 3: Customer detail page** (shows locations, contacts, recent work orders — scaffold with tabs)

Create `src/app/(dashboard)/customers/[id]/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Plus, MapPin, ClipboardList } from 'lucide-react'
import { STATUS_COLORS } from '@/types/database'
import type { WorkOrderStatus } from '@/types/database'

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: customer }, { data: locations }, { data: workOrders }] = await Promise.all([
    supabase.from('customers').select('*').eq('id', id).single(),
    supabase.from('locations').select('*, equipment(count)').eq('customer_id', id).order('name'),
    supabase.from('work_orders').select('*, location:locations(name)').eq('customer_id', id).order('created_at', { ascending: false }).limit(10),
  ])

  if (!customer) notFound()

  return (
    <div className="p-8">
      <Link href="/customers" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to customers
      </Link>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
          {customer.dba && <p className="text-gray-500">DBA: {customer.dba}</p>}
          <p className="text-gray-500 text-sm mt-1">
            {[customer.billing_city, customer.billing_state].filter(Boolean).join(', ')}
            {customer.customer_type && ` · ${customer.customer_type}`}
          </p>
        </div>
        <Link href={`/work-orders/new?customerId=${id}`}>
          <Button className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold">
            <Plus className="h-4 w-4 mr-2" />New Work Order
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Locations */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><MapPin className="h-4 w-4" />Locations</CardTitle>
            <Link href={`/customers/${id}/locations/new`}>
              <Button size="sm" variant="outline"><Plus className="h-3 w-3 mr-1" />Add</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {!locations?.length ? (
              <p className="text-gray-500 text-sm py-4">No locations yet.</p>
            ) : (
              <div className="space-y-2">
                {locations.map(loc => (
                  <Link key={loc.id} href={`/customers/${id}/locations/${loc.id}`}
                    className="block p-3 rounded-lg hover:bg-gray-50 border transition-colors">
                    <div className="font-medium text-sm">{loc.name}</div>
                    <div className="text-xs text-gray-500">{[loc.city, loc.state].filter(Boolean).join(', ')}</div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent work orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><ClipboardList className="h-4 w-4" />Work Orders</CardTitle>
            <Link href={`/work-orders?customerId=${id}`}>
              <Button size="sm" variant="ghost" className="text-yellow-600">View all</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {!workOrders?.length ? (
              <p className="text-gray-500 text-sm py-4">No work orders yet.</p>
            ) : (
              <div className="space-y-2">
                {workOrders.map(wo => (
                  <Link key={wo.id} href={`/work-orders/${wo.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 border transition-colors">
                    <div>
                      <div className="font-medium text-sm">{wo.work_type} — {(wo.location as { name: string } | null)?.name ?? 'No location'}</div>
                      <div className="text-xs text-gray-500">{wo.scheduled_date ?? 'Unscheduled'}</div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[wo.status as WorkOrderStatus]}`}>
                      {wo.status.replace('_', ' ')}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

**Step 4: Commit**

```bash
git add src/app/\(dashboard\)/customers/
git commit -m "feat: customer management CRM pages"
```

---

## Task 8: Work Order Management

**Files:**
- Create: `src/app/(dashboard)/work-orders/page.tsx`
- Create: `src/app/(dashboard)/work-orders/new/page.tsx`
- Create: `src/app/(dashboard)/work-orders/[id]/page.tsx`

Follow the same pattern as customers. Key fields for work order creation:
- Customer (required, dropdown)
- Location (filtered by selected customer)
- Work type (inspection / repair / installation / emergency)
- Scheduled date
- Assigned technician (dropdown of org users with role=technician)
- Priority
- Special instructions

Work order detail page shows:
- Status bar with status update button
- Linked inspection report (if exists) with link to `/reports/[id]`
- "Start Inspection" button if status is `on_site` or `in_progress` and no report exists yet → navigates to `/reports/new?workOrderId=[id]`

**Step 1: Work order list**

Create `src/app/(dashboard)/work-orders/page.tsx` — mirrors customers/page.tsx pattern, querying `work_orders` with customer + location joins, filterable by status.

**Step 2: New work order form**

Create `src/app/(dashboard)/work-orders/new/page.tsx` — client component, loads customers on mount, loads locations when customer selected. Inserts work order and redirects to detail.

**Step 3: Work order detail**

Create `src/app/(dashboard)/work-orders/[id]/page.tsx` — shows full work order details, status update controls, link to inspection report.

**Step 4: Commit after each sub-task**

```bash
git commit -m "feat: work order list/create/detail pages"
```

---

## Task 9: Field Execution — Inspection Report

**Files:**
- Create: `src/app/(dashboard)/reports/new/page.tsx` (replaces existing)
- Create: `src/app/(dashboard)/reports/[id]/page.tsx`
- Create: `src/app/(dashboard)/reports/[id]/readings/page.tsx`
- Create: `src/app/(dashboard)/reports/[id]/findings/page.tsx`

**Context:** An inspection report is created from a work order. The URL is `/reports/new?workOrderId=<id>`. The report creation flow:
1. Create report record linked to work order
2. Select equipment from the location's inventory to include
3. Enter test readings per equipment
4. Log findings/deficiencies with severity and photos
5. Mark work order complete → triggers Report Agent

**Step 1: New report page**

The new report form should:
- Pre-fill customer, location, technician from the work order
- Let user select report type (nfpa_70b, neta_mts, infrared, etc.)
- Enter test date, report number, ambient conditions
- Create the report record, then redirect to `/reports/[id]/readings`

**Step 2: Test readings page**

`/reports/[id]/readings`:
- Lists all equipment at the location
- For each piece of equipment: add readings (parameter, value, unit, result)
- Pre-loaded parameter templates based on equipment type (e.g., switchgear: insulation resistance, contact resistance, breaker timing)
- Inline add/edit/delete readings

**Step 3: Findings page**

`/reports/[id]/findings` — mirrors existing VoltTrack findings UI but linked to ERP finding records. Photo upload via `/api/photos/upload`.

**Step 4: Complete work order button**

On the work order detail page, "Mark Complete" button:
- Sets `work_orders.status = 'complete'`
- Calls `/api/reports/[id]/generate` to trigger Report Agent

**Step 5: Commit**

```bash
git commit -m "feat: inspection report creation, readings, and findings"
```

---

## Task 10: Report Agent (AI Automation)

**Files:**
- Create: `src/app/api/reports/[id]/generate/route.ts`
- Create: `src/lib/agents/report-agent.ts`

**Step 1: Install Anthropic SDK**

```bash
npm install @anthropic-ai/sdk
```

**Step 2: Add env var**

Add to `.env.local`:
```
ANTHROPIC_API_KEY=your_key_here
```

Add to Vercel:
```bash
echo "your_anthropic_key" | vercel env add ANTHROPIC_API_KEY production
```

**Step 3: Write report agent**

Create `src/lib/agents/report-agent.ts`:
```ts
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

interface ReportData {
  customerName: string
  locationName: string
  reportType: string
  testDate: string
  technicianName: string
  findings: Array<{
    severity: string
    description: string
    recommendation: string | null
    standardRef: string | null
  }>
  readings: Array<{
    parameter: string
    value: string | null
    unit: string | null
    result: string | null
  }>
}

export async function generateExecutiveSummary(data: ReportData): Promise<string> {
  const findingsSummary = data.findings.length > 0
    ? `Findings: ${data.findings.map(f => `[${f.severity.toUpperCase()}] ${f.description}`).join('; ')}`
    : 'No deficiencies identified.'

  const readingsSummary = data.readings
    .filter(r => r.result === 'fail' || r.result === 'marginal')
    .map(r => `${r.parameter}: ${r.value}${r.unit ? ' ' + r.unit : ''} (${r.result})`)
    .join(', ')

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: `Write a concise, professional executive summary (2-3 paragraphs) for an electrical inspection report.

Customer: ${data.customerName}
Location: ${data.locationName}
Report type: ${data.reportType}
Test date: ${data.testDate}
Technician: ${data.technicianName}
${findingsSummary}
${readingsSummary ? `Out-of-tolerance readings: ${readingsSummary}` : ''}

Write in third person. Be factual and professional. Lead with the overall condition assessment, then summarize findings, then state recommended next steps. Do not use filler phrases like "It is important to note".`,
      },
    ],
  })

  return message.content[0].type === 'text' ? message.content[0].text : ''
}
```

**Step 4: Write test for agent**

Create `src/test/report-agent.test.ts`:
```ts
import { generateExecutiveSummary } from '@/lib/agents/report-agent'

// Integration test — requires ANTHROPIC_API_KEY in env
// Run only when explicitly testing AI features
describe.skipIf(!process.env.ANTHROPIC_API_KEY)('report agent', () => {
  it('generates an executive summary', async () => {
    const summary = await generateExecutiveSummary({
      customerName: 'Acme Manufacturing',
      locationName: 'Plant A',
      reportType: 'NFPA 70B Preventative Maintenance',
      testDate: '2026-03-09',
      technicianName: 'J. Smith, NETA Level III',
      findings: [
        { severity: 'major', description: 'Loose connection at bus bar', recommendation: 'Tighten to spec torque', standardRef: 'NFPA 70B 11.17' }
      ],
      readings: [
        { parameter: 'Insulation Resistance', value: '50', unit: 'MΩ', result: 'marginal' }
      ],
    })
    expect(summary.length).toBeGreaterThan(100)
    expect(summary).toContain('Acme')
  }, 30000)
})
```

**Step 5: Create generate API route**

Create `src/app/api/reports/[id]/generate/route.ts`:
```ts
import { createClient } from '@/lib/supabase/server'
import { generateExecutiveSummary } from '@/lib/agents/report-agent'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch report with related data
  const { data: report } = await supabase
    .from('inspection_reports')
    .select(`
      *,
      customer:customers(name),
      location:locations(name),
      findings(*),
      test_readings(*)
    `)
    .eq('id', id)
    .single()

  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const summary = await generateExecutiveSummary({
    customerName: (report.customer as { name: string })?.name ?? 'Unknown',
    locationName: (report.location as { name: string })?.name ?? 'Unknown',
    reportType: report.report_type ?? 'Inspection',
    testDate: report.test_date,
    technicianName: report.technician_name ?? 'Technician',
    findings: (report.findings as Array<{ severity: string; description: string; recommendation: string | null; standard_ref: string | null }>).map(f => ({
      severity: f.severity,
      description: f.description,
      recommendation: f.recommendation,
      standardRef: f.standard_ref,
    })),
    readings: (report.test_readings as Array<{ parameter: string; value: string | null; unit: string | null; result: string | null }>).map(r => ({
      parameter: r.parameter,
      value: r.value,
      unit: r.unit,
      result: r.result,
    })),
  })

  // Save summary to report
  await supabase
    .from('inspection_reports')
    .update({ executive_summary: summary })
    .eq('id', id)

  return NextResponse.json({ summary })
}
```

**Step 6: Commit**

```bash
git add src/lib/agents/ src/app/api/reports/ src/test/report-agent.test.ts
git commit -m "feat: Report Agent — AI-generated executive summary via Claude API"
```

---

## Task 11: PDF Report Generation

**Files:**
- Modify: `src/lib/pdf/` (adapt existing PDF template to new schema)
- Modify: `src/app/api/reports/[id]/pdf/route.ts`

**Context:** The existing `@react-pdf/renderer` template in `src/lib/pdf/` and `src/components/pdf/` needs to be updated to use the new data model: `inspection_reports` + `findings` + `test_readings` + `photos` joined from `inspection_reports.work_order_id → work_orders → customers/locations`.

**Step 1:** Read existing `src/lib/pdf/` and `src/components/pdf/ReportTemplate.tsx`

**Step 2:** Update the PDF template to use new field names and include the AI-generated `executive_summary` at the top of the report.

**Step 3:** Update the API route to fetch from new schema.

**Step 4:** Test by calling `/api/reports/[id]/pdf` and verifying a PDF is returned.

**Step 5: Commit**

```bash
git commit -m "feat: update PDF template for ERP schema"
```

---

## Task 12: Deploy & Smoke Test

**Step 1: Run full test suite**

```bash
npm run test:run
```
Expected: all pass

**Step 2: Build locally**

```bash
npm run build
```
Expected: no errors

**Step 3: Deploy to Vercel**

```bash
vercel --prod --yes
```

**Step 4: Add ANTHROPIC_API_KEY to Vercel**

```bash
echo "your_key" | vercel env add ANTHROPIC_API_KEY production
vercel --prod --yes
```

**Step 5: Smoke test on production**

- [ ] Log in at https://volttrack-ten.vercel.app
- [ ] Complete onboarding (create org)
- [ ] Add a customer
- [ ] Add a location to the customer
- [ ] Add equipment to the location
- [ ] Create a work order
- [ ] Create an inspection report from the work order
- [ ] Add test readings and a finding
- [ ] Mark work order complete → verify AI summary generates
- [ ] Download PDF report

**Step 6: Commit any fixes**

```bash
git commit -m "fix: production smoke test fixes"
```

---

## Phase 1 Complete

Phase 1 delivers a working ERP core:
- Multi-tenant onboarding
- Customer / location / equipment management
- Work order lifecycle
- Inspection report with test readings, findings, photos
- AI-generated executive summary (Report Agent)
- PDF report generation

**Next phase:** Contracts, compliance calendar, and deficiency-to-revenue workflow (Phase 2 plan to be written separately).
