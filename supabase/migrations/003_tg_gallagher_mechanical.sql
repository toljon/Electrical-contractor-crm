-- TG Gallagher Mechanical — repurpose schema from electrical testing to
-- mechanical contracting (HVAC, plumbing, fire protection) with BIM/prefab.

-- ─────────────────────────────────────────────
-- ORGANIZATIONS: TGG red brand default
-- ─────────────────────────────────────────────
ALTER TABLE organizations ALTER COLUMN primary_color SET DEFAULT '#B91C1C';

-- ─────────────────────────────────────────────
-- PROFILES: add BIM/VDC and fab-shop roles
-- ─────────────────────────────────────────────
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'manager', 'technician', 'sales', 'bim', 'shop'));

-- ─────────────────────────────────────────────
-- EQUIPMENT: mechanical asset attributes
-- ─────────────────────────────────────────────
ALTER TABLE equipment RENAME COLUMN voltage_rating TO capacity_rating; -- tons / MBH / CFM / GPM
ALTER TABLE equipment DROP COLUMN IF EXISTS kva_rating;
ALTER TABLE equipment ADD COLUMN refrigerant TEXT;
ALTER TABLE equipment ADD COLUMN trade TEXT
  CHECK (trade IN ('hvac', 'plumbing', 'fire_protection'));

-- ─────────────────────────────────────────────
-- WORK ORDERS: trade tagging + broader work types
-- ─────────────────────────────────────────────
ALTER TABLE work_orders ADD COLUMN trade TEXT
  CHECK (trade IN ('hvac', 'plumbing', 'fire_protection'));
ALTER TABLE work_orders DROP CONSTRAINT IF EXISTS work_orders_work_type_check;
ALTER TABLE work_orders ADD CONSTRAINT work_orders_work_type_check
  CHECK (work_type IN ('inspection', 'repair', 'installation', 'maintenance', 'startup', 'emergency'));

-- ─────────────────────────────────────────────
-- INSPECTION REPORTS: mechanical report types
-- ─────────────────────────────────────────────
ALTER TABLE inspection_reports DROP CONSTRAINT IF EXISTS inspection_reports_report_type_check;
-- The electrical report types have no mechanical counterpart, so existing rows
-- are cleared rather than mapped onto a discipline they were not written for.
UPDATE inspection_reports SET report_type = NULL
  WHERE report_type IS NOT NULL
    AND report_type NOT IN ('ashrae_180', 'nfpa_25', 'backflow', 'tab', 'med_gas', 'commissioning');
ALTER TABLE inspection_reports ADD CONSTRAINT inspection_reports_report_type_check
  CHECK (report_type IN ('ashrae_180', 'nfpa_25', 'backflow', 'tab', 'med_gas', 'commissioning'));

-- ─────────────────────────────────────────────
-- PROJECTS (large commercial construction jobs)
-- ─────────────────────────────────────────────
CREATE TABLE projects (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  project_number        TEXT,
  general_contractor    TEXT,
  address               TEXT,
  city                  TEXT,
  state                 TEXT DEFAULT 'MA',
  zip                   TEXT,
  market                TEXT CHECK (market IN ('life_science', 'healthcare', 'higher_ed', 'commercial_office', 'data_center', 'other')),
  trades                TEXT[], -- e.g. ['hvac','plumbing','fire_protection']
  phase                 TEXT NOT NULL DEFAULT 'preconstruction'
                          CHECK (phase IN ('pursuit', 'preconstruction', 'coordination', 'fabrication', 'installation', 'commissioning', 'closeout', 'warranty')),
  contract_value_cents  BIGINT,
  bim_model_url         TEXT, -- Revit / Fabrication model link
  start_date            DATE,
  target_completion     DATE,
  project_manager       UUID REFERENCES profiles(id),
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Service work orders can roll up to a construction project
ALTER TABLE work_orders ADD COLUMN project_id UUID REFERENCES projects(id);

-- ─────────────────────────────────────────────
-- PREFAB ASSEMBLIES (shop fabrication tracking,
-- driven from the BIM model)
-- ─────────────────────────────────────────────
CREATE TABLE prefab_assemblies (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id            UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  assembly_number       TEXT NOT NULL,
  name                  TEXT,
  assembly_type         TEXT NOT NULL DEFAULT 'pipe_spool'
                          CHECK (assembly_type IN ('pipe_spool', 'duct_section', 'mech_rack', 'plumbing_battery', 'pump_skid', 'riser', 'other')),
  trade                 TEXT CHECK (trade IN ('hvac', 'plumbing', 'fire_protection')),
  bim_reference         TEXT, -- model element / spool drawing reference
  drawing_url           TEXT,
  status                TEXT NOT NULL DEFAULT 'modeled'
                          CHECK (status IN ('modeled', 'released', 'in_fabrication', 'qc', 'shipped', 'delivered', 'installed')),
  shop_hours_estimated  NUMERIC, -- estimation + prefab-optimization dataset
  shop_hours_actual     NUMERIC,
  scheduled_ship_date   DATE,
  shipped_at            DATE,
  installed_at          DATE,
  install_location      TEXT, -- e.g. 'Level 3, Zone B'
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────
ALTER TABLE projects          ENABLE ROW LEVEL SECURITY;
ALTER TABLE prefab_assemblies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects_org" ON projects FOR ALL USING (org_id = public.current_org_id());
CREATE POLICY "prefab_assemblies_org" ON prefab_assemblies FOR ALL USING (org_id = public.current_org_id());
