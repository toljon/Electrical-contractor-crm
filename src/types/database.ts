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

export interface Contact {
  id: string
  org_id: string
  customer_id: string
  name: string
  title: string | null
  email: string | null
  phone: string | null
  contact_type: 'primary' | 'billing' | 'operations' | 'safety' | 'other'
  is_primary: boolean
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

export interface Contract {
  id: string
  org_id: string
  customer_id: string
  contract_number: string | null
  contract_type: ContractType
  status: 'draft' | 'active' | 'expired' | 'cancelled'
  start_date: string
  end_date: string | null
  auto_renew: boolean
  renewal_notice_days: number
  inspection_frequency: InspectionFrequency | null
  value_cents: number | null
  payment_terms: string
  notes: string | null
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
  asset_id?: string | null // compat alias for equipment_id
  severity: FindingSeverity | null
  description: string
  standard_ref: string | null
  recommendation: string | null
  status: 'open' | 'quoted' | 'approved' | 'scheduled' | 'resolved'
  sort_order: number
  created_at: string
  asset?: Asset // compat join
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

// ─── Backward-compat exports for old MVP pages (will be removed in Tasks 7-11) ───

export type ReportStatus = 'draft' | 'complete' | 'sent'
export type UserRole = Role

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
  test_readings?: TestReading[]
}

export interface FullReport extends TestReport {
  assets: (Asset & { test_readings: TestReading[] })[]
  findings: (Finding & { asset?: Asset })[]
  photos: Photo[]
}

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

export const INFRARED_PARAMETERS = [
  { parameter: 'Maximum Temperature', unit: '°F' },
  { parameter: 'Ambient Temperature', unit: '°F' },
  { parameter: 'Temperature Rise (ΔT)', unit: '°F' },
  { parameter: 'Emissivity Setting', unit: '' },
  { parameter: 'Distance to Target', unit: 'ft' },
  { parameter: 'Load at Time of Scan', unit: 'A' },
  { parameter: '% of Rated Load', unit: '%' },
]

export const SEVERITY_LABELS: Record<FindingSeverity, string> = {
  critical: 'Critical',
  major: 'Major',
  minor: 'Minor',
  observation: 'Observation',
}
