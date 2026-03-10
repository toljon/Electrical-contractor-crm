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
