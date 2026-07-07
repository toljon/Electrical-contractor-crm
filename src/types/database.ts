// src/types/database.ts

export type Role = 'admin' | 'manager' | 'technician' | 'sales' | 'bim' | 'shop'
export type Trade = 'hvac' | 'plumbing' | 'fire_protection'
export type WorkOrderStatus = 'created' | 'assigned' | 'en_route' | 'on_site' | 'in_progress' | 'complete' | 'invoiced' | 'cancelled'
export type WorkType = 'inspection' | 'repair' | 'installation' | 'maintenance' | 'startup' | 'emergency'
export type FindingSeverity = 'critical' | 'major' | 'minor' | 'observation'
export type ReadingResult = 'pass' | 'fail' | 'marginal' | 'n/a'
export type ReportType = 'ashrae_180' | 'nfpa_25' | 'backflow' | 'tab' | 'med_gas' | 'commissioning'
export type CustomerType = 'commercial' | 'industrial' | 'government' | 'utility'
export type ContractType = 'inspection' | 'service' | 'installation' | 'msa'
export type InspectionFrequency = 'monthly' | 'quarterly' | 'semi_annual' | 'annual'
export type ProjectPhase = 'pursuit' | 'preconstruction' | 'coordination' | 'fabrication' | 'installation' | 'commissioning' | 'closeout' | 'warranty'
export type ProjectMarket = 'life_science' | 'healthcare' | 'higher_ed' | 'commercial_office' | 'data_center' | 'other'
export type AssemblyType = 'pipe_spool' | 'duct_section' | 'mech_rack' | 'plumbing_battery' | 'pump_skid' | 'riser' | 'other'
export type AssemblyStatus = 'modeled' | 'released' | 'in_fabrication' | 'qc' | 'shipped' | 'delivered' | 'installed'

export const TRADE_LABELS: Record<Trade, string> = {
  hvac: 'HVAC',
  plumbing: 'Plumbing',
  fire_protection: 'Fire Protection',
}

export const TRADE_COLORS: Record<Trade, string> = {
  hvac: 'bg-sky-100 text-sky-800',
  plumbing: 'bg-emerald-100 text-emerald-800',
  fire_protection: 'bg-red-100 text-red-800',
}

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  ashrae_180: 'ASHRAE/ACCA 180 HVAC Preventive Maintenance',
  nfpa_25: 'NFPA 25 Fire Protection Inspection & Testing',
  backflow: 'Backflow Prevention Assembly Test',
  tab: 'Testing, Adjusting & Balancing (TAB)',
  med_gas: 'NFPA 99 Medical Gas Verification',
  commissioning: 'Commissioning / Functional Performance Test',
}

export const EQUIPMENT_TYPES = [
  { value: 'ahu', label: 'Air Handling Unit (AHU)', trade: 'hvac' },
  { value: 'rtu', label: 'Rooftop Unit (RTU)', trade: 'hvac' },
  { value: 'chiller', label: 'Chiller', trade: 'hvac' },
  { value: 'cooling_tower', label: 'Cooling Tower', trade: 'hvac' },
  { value: 'boiler', label: 'Boiler', trade: 'hvac' },
  { value: 'pump', label: 'Pump (HW / CHW / CW)', trade: 'hvac' },
  { value: 'heat_exchanger', label: 'Heat Exchanger', trade: 'hvac' },
  { value: 'vav_box', label: 'VAV / Terminal Unit', trade: 'hvac' },
  { value: 'fan_coil', label: 'Fan Coil Unit', trade: 'hvac' },
  { value: 'exhaust_fan', label: 'Exhaust / Supply Fan', trade: 'hvac' },
  { value: 'vfd', label: 'Variable Frequency Drive (VFD)', trade: 'hvac' },
  { value: 'water_heater', label: 'Domestic Water Heater', trade: 'plumbing' },
  { value: 'booster_pump', label: 'Domestic Booster Pump', trade: 'plumbing' },
  { value: 'backflow_preventer', label: 'Backflow Preventer', trade: 'plumbing' },
  { value: 'med_gas', label: 'Medical Gas System', trade: 'plumbing' },
  { value: 'fire_pump', label: 'Fire Pump', trade: 'fire_protection' },
  { value: 'sprinkler_system', label: 'Sprinkler System', trade: 'fire_protection' },
  { value: 'standpipe', label: 'Standpipe / FDC', trade: 'fire_protection' },
  { value: 'other', label: 'Other', trade: 'hvac' },
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

export const PROJECT_PHASE_LABELS: Record<ProjectPhase, string> = {
  pursuit: 'Pursuit',
  preconstruction: 'Preconstruction',
  coordination: 'BIM Coordination',
  fabrication: 'Fabrication',
  installation: 'Installation',
  commissioning: 'Commissioning',
  closeout: 'Closeout',
  warranty: 'Warranty',
}

export const PROJECT_PHASE_COLORS: Record<ProjectPhase, string> = {
  pursuit: 'bg-gray-100 text-gray-700',
  preconstruction: 'bg-blue-100 text-blue-700',
  coordination: 'bg-purple-100 text-purple-700',
  fabrication: 'bg-amber-100 text-amber-700',
  installation: 'bg-indigo-100 text-indigo-700',
  commissioning: 'bg-teal-100 text-teal-700',
  closeout: 'bg-green-100 text-green-700',
  warranty: 'bg-gray-100 text-gray-500',
}

export const PROJECT_MARKET_LABELS: Record<ProjectMarket, string> = {
  life_science: 'Life Science / Lab',
  healthcare: 'Healthcare',
  higher_ed: 'Higher Education',
  commercial_office: 'Commercial Office',
  data_center: 'Data Center',
  other: 'Other',
}

export const ASSEMBLY_TYPE_LABELS: Record<AssemblyType, string> = {
  pipe_spool: 'Pipe Spool',
  duct_section: 'Duct Section',
  mech_rack: 'Multi-Trade Rack',
  plumbing_battery: 'Plumbing Battery',
  pump_skid: 'Pump Skid',
  riser: 'Riser',
  other: 'Other',
}

export const ASSEMBLY_STATUS_LABELS: Record<AssemblyStatus, string> = {
  modeled: 'Modeled',
  released: 'Released to Shop',
  in_fabrication: 'In Fabrication',
  qc: 'QC',
  shipped: 'Shipped',
  delivered: 'Delivered',
  installed: 'Installed',
}

export const ASSEMBLY_STATUS_COLORS: Record<AssemblyStatus, string> = {
  modeled: 'bg-gray-100 text-gray-700',
  released: 'bg-blue-100 text-blue-700',
  in_fabrication: 'bg-amber-100 text-amber-700',
  qc: 'bg-purple-100 text-purple-700',
  shipped: 'bg-indigo-100 text-indigo-700',
  delivered: 'bg-teal-100 text-teal-700',
  installed: 'bg-green-100 text-green-700',
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
  trade: Trade | null
  manufacturer: string | null
  model: string | null
  serial_number: string | null
  qr_code: string | null
  capacity_rating: string | null // tons, MBH, CFM, GPM — unit depends on equipment type
  refrigerant: string | null
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
  project_id: string | null
  assigned_to: string | null
  order_number: string | null
  work_type: WorkType
  trade: Trade | null
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

export interface Project {
  id: string
  org_id: string
  name: string
  project_number: string | null
  general_contractor: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  market: ProjectMarket | null
  trades: Trade[] | null
  phase: ProjectPhase
  contract_value_cents: number | null
  bim_model_url: string | null
  start_date: string | null
  target_completion: string | null
  project_manager: string | null
  notes: string | null
  created_at: string
}

export interface PrefabAssembly {
  id: string
  org_id: string
  project_id: string
  assembly_number: string
  name: string | null
  assembly_type: AssemblyType
  trade: Trade | null
  bim_reference: string | null
  drawing_url: string | null
  status: AssemblyStatus
  shop_hours_estimated: number | null
  shop_hours_actual: number | null
  scheduled_ship_date: string | null
  shipped_at: string | null
  installed_at: string | null
  install_location: string | null
  notes: string | null
  created_at: string
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

// Pre-loaded reading templates per report type
export const HVAC_PM_PARAMETERS = [
  { parameter: 'Supply Air Temperature', unit: '°F' },
  { parameter: 'Return Air Temperature', unit: '°F' },
  { parameter: 'Temperature Split (ΔT)', unit: '°F' },
  { parameter: 'Filter Pressure Drop', unit: 'in. w.c.' },
  { parameter: 'Fan Motor Current', unit: 'A' },
  { parameter: 'Suction Pressure', unit: 'psig' },
  { parameter: 'Discharge Pressure', unit: 'psig' },
  { parameter: 'Superheat', unit: '°F' },
  { parameter: 'Subcooling', unit: '°F' },
  { parameter: 'Belt / Coupling Condition', unit: '' },
  { parameter: 'Condensate Drain Clear', unit: '' },
]

export const NFPA25_PARAMETERS = [
  { parameter: 'Static Pressure', unit: 'psi' },
  { parameter: 'Residual Pressure', unit: 'psi' },
  { parameter: 'Flow Rate', unit: 'gpm' },
  { parameter: 'Main Drain Test — Pressure Drop', unit: 'psi' },
  { parameter: 'Fire Pump Churn Pressure', unit: 'psi' },
  { parameter: 'Fire Pump 100% Flow Pressure', unit: 'psi' },
  { parameter: 'Jockey Pump Start Pressure', unit: 'psi' },
  { parameter: 'Alarm Valve Trip Time', unit: 'sec' },
  { parameter: 'Tamper / Flow Switch Function', unit: '' },
]

export const BACKFLOW_PARAMETERS = [
  { parameter: 'Check Valve #1 Differential', unit: 'psid' },
  { parameter: 'Check Valve #2 Differential', unit: 'psid' },
  { parameter: 'Relief Valve Opening Point', unit: 'psid' },
  { parameter: 'Line Pressure', unit: 'psi' },
  { parameter: 'Shutoff Valve #1 Holds', unit: '' },
  { parameter: 'Shutoff Valve #2 Holds', unit: '' },
]

export const TAB_PARAMETERS = [
  { parameter: 'Design Airflow', unit: 'CFM' },
  { parameter: 'Measured Airflow', unit: 'CFM' },
  { parameter: 'Percent of Design', unit: '%' },
  { parameter: 'Fan Speed', unit: 'RPM' },
  { parameter: 'Motor Current', unit: 'A' },
  { parameter: 'External Static Pressure', unit: 'in. w.c.' },
  { parameter: 'Design Water Flow', unit: 'GPM' },
  { parameter: 'Measured Water Flow', unit: 'GPM' },
]

export const SEVERITY_LABELS: Record<FindingSeverity, string> = {
  critical: 'Critical',
  major: 'Major',
  minor: 'Minor',
  observation: 'Observation',
}
