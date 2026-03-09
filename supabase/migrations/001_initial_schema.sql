-- VoltTrack MVP Schema
-- Electrical Testing & Compliance Platform

-- Profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  role TEXT DEFAULT 'technician' CHECK (role IN ('admin', 'technician')),
  company_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Companies (customers of the testing firm)
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sites (locations within a company)
CREATE TABLE sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Test Reports (parent document)
CREATE TABLE test_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id),
  company_id UUID REFERENCES companies(id),
  site_id UUID REFERENCES sites(id),
  report_number TEXT,
  report_type TEXT CHECK (report_type IN ('nfpa_70b', 'infrared', 'power_systems', 'preventative_maintenance')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'complete', 'sent')),
  test_date DATE NOT NULL DEFAULT CURRENT_DATE,
  technician_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Assets (equipment tested)
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES test_reports(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  equipment_type TEXT,
  manufacturer TEXT,
  model TEXT,
  serial_number TEXT,
  location TEXT,
  install_date DATE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Test Readings (measurements per asset)
CREATE TABLE test_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
  report_id UUID REFERENCES test_reports(id) ON DELETE CASCADE,
  parameter TEXT NOT NULL,
  value TEXT,
  unit TEXT,
  result TEXT CHECK (result IN ('pass', 'fail', 'marginal', 'n/a')),
  notes TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Findings (issues discovered)
CREATE TABLE findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES test_reports(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES assets(id),
  severity TEXT CHECK (severity IN ('critical', 'major', 'minor', 'observation')),
  description TEXT NOT NULL,
  recommendation TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Photos
CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES test_reports(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES assets(id),
  finding_id UUID REFERENCES findings(id),
  storage_path TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER test_reports_updated_at
  BEFORE UPDATE ON test_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users can only access their own data
CREATE POLICY "profiles_own" ON profiles FOR ALL USING (auth.uid() = id);

CREATE POLICY "companies_own" ON companies FOR ALL USING (auth.uid() = owner_id);

CREATE POLICY "sites_own" ON sites FOR ALL
  USING (company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid()));

CREATE POLICY "reports_own" ON test_reports FOR ALL USING (auth.uid() = owner_id);

CREATE POLICY "assets_own" ON assets FOR ALL
  USING (report_id IN (SELECT id FROM test_reports WHERE owner_id = auth.uid()));

CREATE POLICY "readings_own" ON test_readings FOR ALL
  USING (report_id IN (SELECT id FROM test_reports WHERE owner_id = auth.uid()));

CREATE POLICY "findings_own" ON findings FOR ALL
  USING (report_id IN (SELECT id FROM test_reports WHERE owner_id = auth.uid()));

CREATE POLICY "photos_own" ON photos FOR ALL
  USING (report_id IN (SELECT id FROM test_reports WHERE owner_id = auth.uid()));

-- Profile auto-creation on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
