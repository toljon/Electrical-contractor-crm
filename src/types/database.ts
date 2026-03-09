export type ReportType = 'nfpa_70b' | 'infrared' | 'power_systems' | 'preventative_maintenance'
export type ReportStatus = 'draft' | 'complete' | 'sent'
export type ReadingResult = 'pass' | 'fail' | 'marginal' | 'n/a'
export type FindingSeverity = 'critical' | 'major' | 'minor' | 'observation'
export type UserRole = 'admin' | 'technician'

export interface Profile {
  id: string
  full_name: string | null
  role: UserRole
  company_name: string | null
  created_at: string
}

export interface Company {
  id: string
  owner_id: string
  name: string
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  created_at: string
}

export interface Site {
  id: string
  company_id: string
  name: string
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  created_at: string
}

export interface TestReport {
  id: string
  owner_id: string
  company_id: string | null
  site_id: string | null
  report_number: string | null
  report_type: ReportType | null
  status: ReportStatus
  test_date: string
  technician_name: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // Joined
  company?: Company
  site?: Site
}

export interface Asset {
  id: string
  report_id: string
  name: string
  equipment_type: string | null
  manufacturer: string | null
  model: string | null
  serial_number: string | null
  location: string | null
  install_date: string | null
  sort_order: number
  created_at: string
  // Joined
  test_readings?: TestReading[]
}

export interface TestReading {
  id: string
  asset_id: string
  report_id: string
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
  report_id: string
  asset_id: string | null
  severity: FindingSeverity
  description: string
  recommendation: string | null
  sort_order: number
  created_at: string
  // Joined
  asset?: Asset
}

export interface Photo {
  id: string
  report_id: string
  asset_id: string | null
  finding_id: string | null
  storage_path: string
  caption: string | null
  created_at: string
}

// Full report with all relations
export interface FullReport extends TestReport {
  assets: (Asset & { test_readings: TestReading[] })[]
  findings: (Finding & { asset?: Asset })[]
  photos: Photo[]
}

// NFPA 70B default reading parameters
export const NFPA70B_PARAMETERS = [
  { parameter: 'Insulation Resistance Phase A-G', unit: 'MΩ' },
  { parameter: 'Insulation Resistance Phase B-G', unit: 'MΩ' },
  { parameter: 'Insulation Resistance Phase C-G', unit: 'MΩ' },
  { parameter: 'Contact Resistance Phase A', unit: 'μΩ' },
  { parameter: 'Contact Resistance Phase B', unit: 'μΩ' },
  { parameter: 'Contact Resistance Phase C', unit: 'μΩ' },
  { parameter: 'Trip Test - Instantaneous', unit: 'A' },
  { parameter: 'Trip Test - Long Time Delay', unit: 'A' },
  { parameter: 'Trip Test - Short Time Delay', unit: 'A' },
  { parameter: 'Rated Voltage', unit: 'V' },
  { parameter: 'Rated Current', unit: 'A' },
]

// Infrared default reading parameters
export const INFRARED_PARAMETERS = [
  { parameter: 'Maximum Temperature', unit: '°F' },
  { parameter: 'Ambient Temperature', unit: '°F' },
  { parameter: 'Temperature Rise (ΔT)', unit: '°F' },
  { parameter: 'Emissivity Setting', unit: '' },
  { parameter: 'Distance to Target', unit: 'ft' },
  { parameter: 'Load at Time of Scan', unit: 'A' },
  { parameter: '% of Rated Load', unit: '%' },
]

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  nfpa_70b: 'NFPA 70B Electrical Testing',
  infrared: 'Infrared Inspection',
  power_systems: 'Power Systems Testing',
  preventative_maintenance: 'Preventative Maintenance',
}

export const SEVERITY_COLORS: Record<FindingSeverity, string> = {
  critical: '#dc2626',
  major: '#ea580c',
  minor: '#ca8a04',
  observation: '#2563eb',
}

export const SEVERITY_LABELS: Record<FindingSeverity, string> = {
  critical: 'Critical',
  major: 'Major',
  minor: 'Minor',
  observation: 'Observation',
}
