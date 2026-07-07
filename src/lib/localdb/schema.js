// Single source of truth for the TGG Ops SQLite schema.
// Imported by database.ts (app) and scripts/seed.mjs (demo data).
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name     TEXT,
  created_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS organizations (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  slug          TEXT UNIQUE NOT NULL,
  logo_url      TEXT,
  primary_color TEXT DEFAULT '#B91C1C',
  address       TEXT,
  city          TEXT,
  state         TEXT,
  zip           TEXT,
  phone         TEXT,
  email         TEXT,
  website       TEXT,
  license_number TEXT,
  created_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS profiles (
  id            TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  org_id        TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  full_name     TEXT,
  role          TEXT DEFAULT 'technician'
                  CHECK (role IN ('admin','manager','technician','sales','bim','shop')),
  title         TEXT,
  phone         TEXT,
  certifications TEXT, -- JSON array
  created_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS customers (
  id              TEXT PRIMARY KEY,
  org_id          TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  dba             TEXT,
  customer_type   TEXT CHECK (customer_type IN ('commercial','industrial','government','utility')),
  billing_address TEXT,
  billing_city    TEXT,
  billing_state   TEXT,
  billing_zip     TEXT,
  payment_terms   TEXT DEFAULT 'net30',
  tax_exempt      INTEGER DEFAULT 0,
  notes           TEXT,
  status          TEXT DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at      TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS contacts (
  id           TEXT PRIMARY KEY,
  org_id       TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id  TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  title        TEXT,
  email        TEXT,
  phone        TEXT,
  contact_type TEXT DEFAULT 'primary',
  is_primary   INTEGER DEFAULT 0,
  created_at   TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS locations (
  id           TEXT PRIMARY KEY,
  org_id       TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id  TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  address      TEXT,
  city         TEXT,
  state        TEXT,
  zip          TEXT,
  latitude     REAL,
  longitude    REAL,
  site_contact TEXT,
  site_phone   TEXT,
  site_email   TEXT,
  access_notes TEXT,
  service_hours TEXT,
  created_at   TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS equipment (
  id              TEXT PRIMARY KEY,
  org_id          TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id     TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  customer_id     TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  equipment_type  TEXT NOT NULL,
  trade           TEXT CHECK (trade IN ('hvac','plumbing','fire_protection')),
  manufacturer    TEXT,
  model           TEXT,
  serial_number   TEXT,
  qr_code         TEXT UNIQUE,
  capacity_rating TEXT,
  refrigerant     TEXT,
  install_date    TEXT,
  last_inspected  TEXT,
  location_detail TEXT,
  status          TEXT DEFAULT 'active' CHECK (status IN ('active','decommissioned','removed')),
  sort_order      INTEGER DEFAULT 0,
  created_at      TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS contracts (
  id                   TEXT PRIMARY KEY,
  org_id               TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id          TEXT NOT NULL REFERENCES customers(id),
  contract_number      TEXT,
  contract_type        TEXT DEFAULT 'inspection',
  status               TEXT DEFAULT 'active',
  start_date           TEXT NOT NULL,
  end_date             TEXT,
  auto_renew           INTEGER DEFAULT 1,
  renewal_notice_days  INTEGER DEFAULT 60,
  inspection_frequency TEXT,
  value_cents          INTEGER,
  payment_terms        TEXT DEFAULT 'net30',
  notes                TEXT,
  created_at           TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS projects (
  id                   TEXT PRIMARY KEY,
  org_id               TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  project_number       TEXT,
  general_contractor   TEXT,
  address              TEXT,
  city                 TEXT,
  state                TEXT DEFAULT 'MA',
  zip                  TEXT,
  market               TEXT CHECK (market IN ('life_science','healthcare','higher_ed','commercial_office','data_center','other')),
  trades               TEXT, -- JSON array
  phase                TEXT NOT NULL DEFAULT 'preconstruction'
                         CHECK (phase IN ('pursuit','preconstruction','coordination','fabrication','installation','commissioning','closeout','warranty')),
  contract_value_cents INTEGER,
  bim_model_url        TEXT,
  start_date           TEXT,
  target_completion    TEXT,
  project_manager      TEXT REFERENCES profiles(id),
  notes                TEXT,
  created_at           TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS prefab_assemblies (
  id                   TEXT PRIMARY KEY,
  org_id               TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id           TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  assembly_number      TEXT NOT NULL,
  name                 TEXT,
  assembly_type        TEXT NOT NULL DEFAULT 'pipe_spool'
                         CHECK (assembly_type IN ('pipe_spool','duct_section','mech_rack','plumbing_battery','pump_skid','riser','other')),
  trade                TEXT CHECK (trade IN ('hvac','plumbing','fire_protection')),
  bim_reference        TEXT,
  drawing_url          TEXT,
  status               TEXT NOT NULL DEFAULT 'modeled'
                         CHECK (status IN ('modeled','released','in_fabrication','qc','shipped','delivered','installed')),
  shop_hours_estimated REAL,
  shop_hours_actual    REAL,
  scheduled_ship_date  TEXT,
  shipped_at           TEXT,
  installed_at         TEXT,
  install_location     TEXT,
  notes                TEXT,
  created_at           TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS work_orders (
  id              TEXT PRIMARY KEY,
  org_id          TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id     TEXT NOT NULL REFERENCES customers(id),
  location_id     TEXT REFERENCES locations(id),
  contract_id     TEXT REFERENCES contracts(id),
  project_id      TEXT REFERENCES projects(id),
  assigned_to     TEXT REFERENCES profiles(id),
  order_number    TEXT,
  work_type       TEXT DEFAULT 'inspection'
                    CHECK (work_type IN ('inspection','repair','installation','maintenance','startup','emergency')),
  trade           TEXT CHECK (trade IN ('hvac','plumbing','fire_protection')),
  status          TEXT DEFAULT 'created'
                    CHECK (status IN ('created','assigned','en_route','on_site','in_progress','complete','invoiced','cancelled')),
  scheduled_date  TEXT,
  scheduled_time  TEXT,
  estimated_hours REAL,
  priority        TEXT DEFAULT 'normal' CHECK (priority IN ('low','normal','high','emergency')),
  special_instructions TEXT,
  report_generated INTEGER DEFAULT 0,
  report_sent     INTEGER DEFAULT 0,
  created_at      TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at      TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS inspection_reports (
  id                   TEXT PRIMARY KEY,
  org_id               TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  work_order_id        TEXT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  customer_id          TEXT NOT NULL REFERENCES customers(id),
  location_id          TEXT REFERENCES locations(id),
  report_number        TEXT,
  report_type          TEXT CHECK (report_type IN ('ashrae_180','nfpa_25','backflow','tab','med_gas','commissioning')),
  test_date            TEXT NOT NULL DEFAULT (date('now')),
  technician_id        TEXT REFERENCES profiles(id),
  technician_name      TEXT,
  technician_certs     TEXT,
  ambient_temp_f       REAL,
  humidity_pct         REAL,
  weather_conditions   TEXT,
  executive_summary    TEXT,
  compliance_statement TEXT,
  next_inspection_date TEXT,
  customer_signature   TEXT,
  signed_by            TEXT,
  signed_at            TEXT,
  pdf_url              TEXT,
  notes                TEXT,
  created_at           TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS test_readings (
  id           TEXT PRIMARY KEY,
  org_id       TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  report_id    TEXT NOT NULL REFERENCES inspection_reports(id) ON DELETE CASCADE,
  equipment_id TEXT REFERENCES equipment(id),
  parameter    TEXT NOT NULL,
  value        TEXT,
  unit         TEXT,
  result       TEXT CHECK (result IN ('pass','fail','marginal','n/a')),
  notes        TEXT,
  sort_order   INTEGER DEFAULT 0,
  created_at   TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS findings (
  id             TEXT PRIMARY KEY,
  org_id         TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  report_id      TEXT NOT NULL REFERENCES inspection_reports(id) ON DELETE CASCADE,
  equipment_id   TEXT REFERENCES equipment(id),
  severity       TEXT CHECK (severity IN ('critical','major','minor','observation')),
  description    TEXT NOT NULL,
  standard_ref   TEXT,
  recommendation TEXT,
  status         TEXT DEFAULT 'open'
                   CHECK (status IN ('open','quoted','approved','scheduled','resolved')),
  sort_order     INTEGER DEFAULT 0,
  created_at     TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS photos (
  id           TEXT PRIMARY KEY,
  org_id       TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  report_id    TEXT REFERENCES inspection_reports(id) ON DELETE CASCADE,
  finding_id   TEXT REFERENCES findings(id),
  equipment_id TEXT REFERENCES equipment(id),
  storage_path TEXT NOT NULL,
  caption      TEXT,
  taken_at     TEXT,
  created_at   TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_profiles_org ON profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_customers_org ON customers(org_id);
CREATE INDEX IF NOT EXISTS idx_locations_customer ON locations(customer_id);
CREATE INDEX IF NOT EXISTS idx_equipment_location ON equipment(location_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_org ON work_orders(org_id);
CREATE INDEX IF NOT EXISTS idx_reports_work_order ON inspection_reports(work_order_id);
CREATE INDEX IF NOT EXISTS idx_readings_report ON test_readings(report_id);
CREATE INDEX IF NOT EXISTS idx_findings_report ON findings(report_id);
CREATE INDEX IF NOT EXISTS idx_photos_report ON photos(report_id);
CREATE INDEX IF NOT EXISTS idx_assemblies_project ON prefab_assemblies(project_id);
`
