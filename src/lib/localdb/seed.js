// Deterministic TGG Ops demo dataset. Shared by scripts/seed.mjs (CLI)
// and the demo auto-seed in database.ts (serverless/preview deployments).
// IDs are fixed (demo-0001...) so independently seeded instances agree.
//
// PROVENANCE — read before changing names in here:
//   * Customers, projects, general contractors, engineers, facility names and
//     company details are TG Gallagher's OWN publicly published portfolio and
//     company pages (tggallagher.com/project/*, /who-we-are/, /prefab/).
//     Each project below carries the source page it came from.
//   * Everything operational — readings, findings, shop hours, contract
//     values, dates, work orders — is SYNTHETIC. It illustrates the product;
//     it is not TG Gallagher data.
//   * Staff names are invented on purpose. Real employees are named on their
//     site; attaching fabricated inspection findings to a real person's name
//     is a line this dataset does not cross.
// The UI carries a "Demo data" marker so none of this can be mistaken for a
// real service record.
import { randomBytes, scryptSync } from 'crypto'

export function seedDemo(db) {
// One transaction: the auto-seed in database.ts only runs while the users
// table is empty, so a half-finished seed would never be retried.
const seedAll = db.transaction(() => {
// ── helpers ─────────────────────────────────────────────
let idSeq = 0
const uuid = () => `demo-${String(++idSeq).padStart(4, '0')}`
const hashPassword = (password) => {
  const salt = randomBytes(16).toString('hex')
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`
}
const daysFromNow = (n) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}
const daysAfter = (date, n) => {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().split('T')[0]
}
// deterministic pseudo-random so re-seeding gives the same demo
let rngState = 42
const rng = () => {
  rngState = (rngState * 1103515245 + 12345) % 2147483648
  return rngState / 2147483648
}
const pick = (arr) => arr[Math.floor(rng() * arr.length)]
const between = (lo, hi) => lo + rng() * (hi - lo)
const round1 = (n) => Math.round(n * 10) / 10

const insert = (table, row) => {
  const cols = Object.keys(row)
  db.prepare(
    `INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`
  ).run(...cols.map((c) => row[c]))
  return row.id
}

// ── org + users ─────────────────────────────────────────
// HQ and phone are the published ones; the prefab shop is at 8 Connector Rd,
// Andover MA (130,000 sq ft, ISO 9001:2015).
const ORG = uuid()
insert('organizations', {
  id: ORG, name: 'TG Gallagher', slug: 'tg-gallagher',
  address: '309 Waverley Oaks Road, Suite 200',
  city: 'Waltham', state: 'MA', zip: '02452',
  phone: '(617) 661-7000', website: 'https://www.tggallagher.com',
  license_number: 'MA PL-8842 / SM-1170',
})

const PASSWORD = hashPassword('gallagher')
const people = [
  ['demo@tggallagher.com', 'Pat Sullivan', 'admin', 'VP of Operations'],
  ['mfitz@tggallagher.com', 'Mike Fitzgerald', 'technician', 'HVAC Service Tech'],
  ['sdoyle@tggallagher.com', 'Sarah Doyle', 'technician', 'Plumbing Foreman'],
  ['kbarros@tggallagher.com', 'Kevin Barros', 'technician', 'Fire Protection Tech'],
  ['jchen@tggallagher.com', 'James Chen', 'bim', 'VDC Coordinator'],
  ['rmurphy@tggallagher.com', 'Rob Murphy', 'shop', 'Fab Shop Lead'],
]
const userIds = {}
for (const [email, name, role, title] of people) {
  const id = uuid()
  userIds[name] = id
  insert('users', { id, email, password_hash: PASSWORD, full_name: name })
  insert('profiles', { id, org_id: ORG, full_name: name, role, title })
}
const HVAC_TECH = userIds['Mike Fitzgerald']
const PLUMB_TECH = userIds['Sarah Doyle']
const FP_TECH = userIds['Kevin Barros']

// ── customers, locations, equipment ─────────────────────
// Institutions TG Gallagher publicly names as clients, with the specific
// facilities described on their own project pages. Equipment tags and
// capacities follow what those pages describe (e.g. the Booth Theatre's
// two 125-ton chillers; the 192 fan coil units at 51 Brattle Street).
const customersSpec = [
  {
    name: 'Mass General Brigham', type: 'commercial', city: 'Boston',
    locations: [
      { name: "Brigham & Women's Faulkner Hospital — Inpatient Tower", city: 'Boston', equipment: [
        ['FP-1', 'fire_pump', 'fire_protection', 'Peerless', '1,000 GPM'],
        ['SPK-1', 'sprinkler_system', 'fire_protection', 'Viking', 'Wet + 2 pre-action'],
        ['MG-1', 'med_gas', 'plumbing', 'BeaconMedaes', 'Med air / vac / O2'],
        ['AHU-1', 'ahu', 'hvac', 'Trane', '30,000 CFM'],
        ['DWH-1', 'water_heater', 'plumbing', 'PVI', '500 gal'],
        ['BFP-1', 'backflow_preventer', 'plumbing', 'Watts', '4 in'],
      ]},
    ],
  },
  {
    name: 'Harvard University', type: 'commercial', city: 'Cambridge',
    locations: [
      { name: '51 Brattle Street — Mechanical Room', city: 'Cambridge', equipment: [
        ['AHU-2', 'ahu', 'hvac', 'JCI', '18,000 CFM'],
        ['P-1', 'pump', 'hvac', 'Bell & Gossett', '600 GPM'],
        ['P-2', 'pump', 'hvac', 'Bell & Gossett', '600 GPM'],
        ['FCU-BANK', 'fan_coil', 'hvac', 'Daikin', '192 units'],
      ]},
      { name: 'T.H. Chan School of Public Health — Building 2', city: 'Boston', equipment: [
        ['AHU-3', 'ahu', 'hvac', 'Trane', '15,000 CFM'],
        ['AHU-4', 'ahu', 'hvac', 'Trane', '15,000 CFM'],
        ['EF-12', 'exhaust_fan', 'hvac', 'Greenheck', '8,500 CFM'],
      ]},
    ],
  },
  {
    name: 'Boston University', type: 'commercial', city: 'Boston',
    locations: [
      { name: 'Joan & Edgar Booth Theatre — Chiller Plant', city: 'Boston', equipment: [
        ['CH-1', 'chiller', 'hvac', 'Daikin', '125 tons'],
        ['CH-2', 'chiller', 'hvac', 'Daikin', '125 tons'],
        ['B-1', 'boiler', 'hvac', 'AERCO', '2,000 MBH'],
        ['B-2', 'boiler', 'hvac', 'AERCO', '2,000 MBH'],
        ['P-3', 'pump', 'hvac', 'Bell & Gossett', '800 GPM'],
        ['STP-1', 'standpipe', 'fire_protection', null, 'Class I'],
      ]},
    ],
  },
  {
    name: 'King Street Properties', type: 'commercial', city: 'Boston',
    locations: [
      { name: '305 Western Ave — Allston Labworks Penthouse', city: 'Boston', equipment: [
        ['AHU-5', 'ahu', 'hvac', 'JCI', '40,000 CFM'],
        ['ERV-1', 'heat_exchanger', 'hvac', 'Alfa Laval', 'Energy recovery'],
        ['CT-1', 'cooling_tower', 'hvac', 'BAC', '600 tons'],
        ['BFP-3', 'backflow_preventer', 'plumbing', 'Febco', '3 in'],
      ]},
    ],
  },
  {
    name: 'Hobbs Brook Management', type: 'commercial', city: 'Waltham',
    locations: [
      { name: '225 Wyman Street — Penthouse', city: 'Waltham', equipment: [
        ['RTU-1', 'rtu', 'hvac', 'Daikin', '80 tons'],
        ['RTU-2', 'rtu', 'hvac', 'Daikin', '80 tons'],
        ['BFP-4', 'backflow_preventer', 'plumbing', 'Watts', '4 in'],
      ]},
    ],
  },
  {
    name: 'Dana-Farber Cancer Institute', type: 'commercial', city: 'Boston',
    locations: [
      { name: 'Longwood Campus — Central Plant', city: 'Boston', equipment: [
        ['CH-3', 'chiller', 'hvac', 'Carrier', '450 tons'],
        ['P-5', 'pump', 'hvac', 'Grundfos', '900 GPM'],
        ['FP-2', 'fire_pump', 'fire_protection', 'Aurora', '750 GPM'],
        ['MG-2', 'med_gas', 'plumbing', 'BeaconMedaes', 'Med air / vac'],
      ]},
    ],
  },
]

const equipmentIds = [] // {id, name, locId, custId, trade}
const locationIds = []  // {id, custId, name}
const customerIds = {}
for (const spec of customersSpec) {
  const custId = insert('customers', {
    id: uuid(), org_id: ORG, name: spec.name, customer_type: spec.type,
    billing_city: spec.city, billing_state: 'MA', payment_terms: 'net30', status: 'active',
  })
  customerIds[spec.name] = custId
  for (const loc of spec.locations) {
    const locId = insert('locations', {
      id: uuid(), org_id: ORG, customer_id: custId, name: loc.name,
      city: loc.city ?? spec.city, state: 'MA',
      service_hours: '24/7 emergency — (617) 661-7000',
    })
    locationIds.push({ id: locId, custId, name: loc.name })
    loc.equipment.forEach(([name, type, trade, mfr, capacity], i) => {
      const eqId = insert('equipment', {
        id: uuid(), org_id: ORG, location_id: locId, customer_id: custId,
        name, equipment_type: type, trade, manufacturer: mfr,
        capacity_rating: capacity, status: 'active', sort_order: i,
        install_date: daysFromNow(-Math.floor(between(700, 3000))),
      })
      equipmentIds.push({ id: eqId, name, locId, custId, trade })
    })
  }
}

const locByName = (n) => locationIds.find((l) => l.name.startsWith(n))
const equipAt = (locId, trade) =>
  equipmentIds.filter((e) => e.locId === locId && (!trade || e.trade === trade))

// ── service history: work orders + reports + readings ───
// TG Gallagher's service department runs "quarterly and annual NFPA-compliant
// inspection programs" plus HVAC preventive maintenance, so the PM programs
// below mirror that cadence across all three trades.
const ahu3 = equipmentIds.find((e) => e.name === 'AHU-3')

let woSeq = 1000
let repSeq = 2000

const makeWorkOrder = (custId, locId, opts = {}) =>
  insert('work_orders', {
    id: uuid(), org_id: ORG, customer_id: custId, location_id: locId,
    assigned_to: opts.tech, order_number: `WO-${woSeq++}`,
    work_type: opts.workType ?? 'maintenance', trade: opts.trade ?? 'hvac',
    status: opts.status ?? 'complete', scheduled_date: opts.date,
    priority: opts.priority ?? 'normal',
    updated_at: `${opts.date}T15:00:00.000Z`,
  })

const READING_TEMPLATES = {
  ashrae_180: (eq, quarterIdx) => {
    // AHU-3 carries the predictive-maintenance story: its temperature split
    // decays 19°F -> 11°F across the year while everything else holds.
    const isDrifter = ahu3 && eq.id === ahu3.id
    const deltaT = isDrifter ? 19 - quarterIdx * 2.7 : between(17, 21)
    return [
      ['Supply Air Temperature', round1(55 + between(-1, 2)), '°F', 'pass'],
      ['Temperature Split (ΔT)', round1(deltaT), '°F', deltaT < 14 ? (deltaT < 12 ? 'fail' : 'marginal') : 'pass'],
      ['Filter Pressure Drop', round1(between(0.3, 0.9)), 'in. w.c.', 'pass'],
      ['Fan Motor Current', round1(between(18, 42)), 'A', 'pass'],
    ]
  },
  nfpa_25: () => [
    ['Churn Pressure', round1(between(118, 132)), 'psi', 'pass'],
    ['Suction Pressure', round1(between(48, 60)), 'psi', 'pass'],
    ['Jockey Pump Start Pressure', round1(between(95, 105)), 'psi', 'pass'],
    ['Weekly Churn Run Time', 10, 'min', 'pass'],
  ],
  backflow: () => {
    const relief = round1(between(1.8, 3.4))
    return [
      ['Check Valve #1 Differential', round1(between(5.2, 8.4)), 'psid', 'pass'],
      ['Check Valve #2 Differential', round1(between(3.1, 5.6)), 'psid', 'pass'],
      ['Relief Valve Opening Point', relief, 'psid', relief < 2.0 ? 'fail' : 'pass'],
    ]
  },
  med_gas: () => [
    ['Medical Air Purity', round1(between(99.2, 99.9)), '%', 'pass'],
    ['Source Pressure', round1(between(50, 55)), 'psi', 'pass'],
    ['Alarm Verification', 'Verified', null, 'pass'],
    ['Cross-Connection Test', 'None detected', null, 'pass'],
  ],
  tab: () => [
    ['Design Airflow', Math.round(between(9000, 30000)), 'CFM', 'pass'],
    ['Measured Airflow', Math.round(between(8800, 29500)), 'CFM', 'pass'],
    ['External Static Pressure', round1(between(1.6, 3.2)), 'in. w.c.', 'pass'],
  ],
  commissioning: () => [
    ['Sequence of Operations', 'Verified', null, 'pass'],
    ['Occupied/Unoccupied Changeover', 'Verified', null, 'pass'],
    ['Alarm Points Tested', Math.round(between(18, 40)), 'points', 'pass'],
  ],
}

const FINDINGS_BY_TYPE = {
  ashrae_180: [
    ['minor', 'Filter pressure drop above replacement threshold', 'Replace filter bank at next PM', 'ASHRAE/ACCA 180 Table 5-3', 'resolved'],
    ['major', 'Supply fan belt fraying and misaligned', 'Replace belt set and realign sheaves', 'ASHRAE/ACCA 180 Table 5-3', 'open'],
    ['observation', 'Condensate pan showing early corrosion', 'Monitor at next PM; treat and coat pan', null, 'open'],
  ],
  nfpa_25: [
    ['critical', 'Jockey pump short-cycling — suspected check valve leak', 'Replace jockey pump check valve', 'NFPA 25 8.3.1', 'open'],
    ['minor', 'Discharge gauge out of calibration', 'Replace 0-300 psi gauge', 'NFPA 25 13.4.3', 'resolved'],
    ['major', 'Pre-action panel trouble signal on supervisory circuit', 'Trace circuit and replace end-of-line device', 'NFPA 25 13.4.1', 'quoted'],
  ],
  backflow: [
    ['major', 'Relief valve discharging continuously under static', 'Rebuild RP assembly and retest', '248 CMR 10.14', 'quoted'],
    ['observation', 'Test cocks stiff — service before next annual', 'Exercise and lubricate test cocks', null, 'open'],
  ],
  med_gas: [
    ['minor', 'Zone valve box label illegible', 'Replace zone valve box labeling', 'NFPA 99 5.1.4', 'resolved'],
  ],
  tab: [
    ['observation', 'Terminal box 4-2 within tolerance but at low end of range', 'Re-balance at next seasonal changeover', null, 'open'],
  ],
  commissioning: [],
}

/** One PM visit: work order + report + readings + (sometimes) a finding. */
function pmVisit({ locName, trade, reportType, date, tech, techName, certs, quarterIdx, workType }) {
  const loc = locByName(locName)
  if (!loc) return
  const woId = makeWorkOrder(loc.custId, loc.id, { date, trade, tech, workType: workType ?? 'inspection' })
  const repId = insert('inspection_reports', {
    id: uuid(), org_id: ORG, work_order_id: woId, customer_id: loc.custId,
    location_id: loc.id, report_number: `TGG-${repSeq++}`,
    report_type: reportType, test_date: date,
    technician_id: tech, technician_name: techName, technician_certs: certs,
    next_inspection_date: daysAfter(date, 90),
  })
  db.prepare('UPDATE work_orders SET report_generated = 1 WHERE id = ?').run(woId)

  const subjects = equipAt(loc.id, trade)
  for (const eq of subjects) {
    const rows = READING_TEMPLATES[reportType](eq, quarterIdx ?? 0)
    rows.forEach(([parameter, value, unit, result], i) =>
      insert('test_readings', {
        id: uuid(), org_id: ORG, report_id: repId, equipment_id: eq.id,
        parameter, value: String(value), unit, result, sort_order: i,
      })
    )
  }

  const pool = FINDINGS_BY_TYPE[reportType] ?? []
  if (pool.length && rng() < 0.55) {
    const [severity, description, recommendation, standard_ref, status] = pick(pool)
    insert('findings', {
      id: uuid(), org_id: ORG, report_id: repId,
      equipment_id: subjects.length ? pick(subjects).id : null,
      severity, description, recommendation, standard_ref, status, sort_order: 0,
    })
  }
  return repId
}

// Quarterly HVAC preventive maintenance across the four HVAC-heavy sites.
// q = 0 is the oldest visit; the newest lands 6 days ago so the service side
// reads as active rather than dormant.
const HVAC_PM_SITES = [
  'T.H. Chan School of Public Health',
  '51 Brattle Street',
  'Joan & Edgar Booth Theatre',
  '305 Western Ave',
]
for (let q = 0; q < 4; q++) {
  const date = daysFromNow(-(3 - q) * 91 - 6)
  for (const locName of HVAC_PM_SITES) {
    pmVisit({
      locName, trade: 'hvac', reportType: 'ashrae_180', date,
      tech: HVAC_TECH, techName: 'Mike Fitzgerald',
      certs: 'EPA 608 Universal, OSHA 30', quarterIdx: q,
    })
  }
}

// Quarterly NFPA 25 fire protection inspections — their published cadence.
for (let q = 0; q < 4; q++) {
  const date = daysFromNow(-(3 - q) * 91 - 12)
  for (const locName of ["Brigham & Women's Faulkner Hospital", 'Longwood Campus']) {
    pmVisit({
      locName, trade: 'fire_protection', reportType: 'nfpa_25', date,
      tech: FP_TECH, techName: 'Kevin Barros',
      certs: 'NICET II Water-Based Systems, OSHA 30',
    })
  }
}

// Annual backflow certifications and med gas verification (plumbing).
pmVisit({
  locName: '225 Wyman Street', trade: 'plumbing', reportType: 'backflow',
  date: daysFromNow(-24), tech: PLUMB_TECH, techName: 'Sarah Doyle',
  certs: 'MA Backflow Tester #B-4471, Master Plumber',
})
pmVisit({
  locName: '305 Western Ave', trade: 'plumbing', reportType: 'backflow',
  date: daysFromNow(-51), tech: PLUMB_TECH, techName: 'Sarah Doyle',
  certs: 'MA Backflow Tester #B-4471, Master Plumber',
})
pmVisit({
  locName: "Brigham & Women's Faulkner Hospital", trade: 'plumbing', reportType: 'med_gas',
  date: daysFromNow(-33), tech: PLUMB_TECH, techName: 'Sarah Doyle',
  certs: 'ASSE 6030 Med Gas Verifier, Master Plumber',
})
pmVisit({
  locName: 'Longwood Campus', trade: 'plumbing', reportType: 'med_gas',
  date: daysFromNow(-78), tech: PLUMB_TECH, techName: 'Sarah Doyle',
  certs: 'ASSE 6030 Med Gas Verifier, Master Plumber',
})

// Construction-side closeout deliverables: TAB and commissioning.
pmVisit({
  locName: '305 Western Ave', trade: 'hvac', reportType: 'tab',
  date: daysFromNow(-17), tech: HVAC_TECH, techName: 'Mike Fitzgerald',
  certs: 'NEBB Certified TAB Supervisor', workType: 'startup',
})
pmVisit({
  locName: '225 Wyman Street', trade: 'hvac', reportType: 'commissioning',
  date: daysFromNow(-9), tech: HVAC_TECH, techName: 'Mike Fitzgerald',
  certs: 'EPA 608 Universal, OSHA 30', workType: 'startup',
})

// Today's board + the next few days, so the dashboard always has live work.
const today = daysFromNow(0)
const wo = (locName, opts) => {
  const loc = locByName(locName)
  if (loc) makeWorkOrder(loc.custId, loc.id, opts)
}
wo("Brigham & Women's Faulkner Hospital", { date: today, status: 'on_site', workType: 'maintenance', trade: 'hvac', tech: HVAC_TECH })
wo('Joan & Edgar Booth Theatre', { date: today, status: 'en_route', workType: 'repair', trade: 'hvac', priority: 'high', tech: HVAC_TECH })
wo('Longwood Campus', { date: today, status: 'assigned', workType: 'inspection', trade: 'fire_protection', tech: FP_TECH })
wo('225 Wyman Street', { date: today, status: 'assigned', workType: 'inspection', trade: 'plumbing', tech: PLUMB_TECH })
wo('51 Brattle Street', { date: daysFromNow(1), status: 'created', workType: 'maintenance', trade: 'hvac', tech: HVAC_TECH })
wo('305 Western Ave', { date: daysFromNow(2), status: 'created', workType: 'startup', trade: 'hvac', tech: HVAC_TECH })
wo('T.H. Chan School of Public Health', { date: daysFromNow(-2), status: 'complete', workType: 'emergency', trade: 'hvac', priority: 'emergency', tech: HVAC_TECH })
wo('Longwood Campus', { date: daysFromNow(-4), status: 'complete', workType: 'repair', trade: 'plumbing', tech: PLUMB_TECH })

// ── construction projects + prefab pipeline ─────────────
// Every project below is from TG Gallagher's published portfolio, with the
// general contractor and market as listed on their own project page.
// Contract values are ILLUSTRATIVE — TGG does not publish them.
const projectsSpec = [
  // name, number, GC, city, market, phase, illustrative value, trades, source slug
  ['101 Smith Place', '26-104', 'Erland Construction', 'Cambridge', 'life_science', 'fabrication', 18_500_000, ['hvac', 'plumbing', 'fire_protection'], '101-smith-place'],
  ["Brigham & Women's Faulkner Hospital Inpatient Tower", '26-098', 'Turner Construction', 'Boston', 'healthcare', 'installation', 24_200_000, ['hvac', 'plumbing', 'fire_protection'], 'brigham-womens-faulkner-hospital-inpatient-tower'],
  ['305 Western Ave — Allston Labworks', '25-141', 'Consigli Construction', 'Boston', 'life_science', 'commissioning', 31_000_000, ['hvac'], '305-western-ave'],
  ['74 Middlesex Ave', '26-112', 'Greystar (GMP)', 'Somerville', 'life_science', 'coordination', 27_400_000, ['hvac'], '74-middlesex-ave'],
  ['225 Wyman Street', '25-087', 'Gilbane Building Co.', 'Waltham', 'commercial_office', 'closeout', 15_800_000, ['hvac'], '225-wyman-street'],
  ['51 Brattle Street', '25-063', 'Mechanical Prime', 'Cambridge', 'higher_ed', 'warranty', 6_900_000, ['hvac'], '51-brattle-street'],
  ['Boston University — Booth Theatre', '25-052', 'BOND', 'Boston', 'higher_ed', 'warranty', 9_400_000, ['hvac'], 'boston-university-theater'],
  ['Harvard Chan Building 2 — AHU Replacement', '26-120', 'Mechanical Prime', 'Boston', 'higher_ed', 'preconstruction', 4_600_000, ['hvac'], 'building-2-ahu-replacement'],
]
const projectIds = []
const projectByName = {}
for (const [name, num, gc, city, market, phase, value, trades, slug] of projectsSpec) {
  const id = insert('projects', {
    id: uuid(), org_id: ORG, name, project_number: num, general_contractor: gc,
    city, state: 'MA', market, phase, contract_value_cents: value * 100,
    trades: JSON.stringify(trades),
    bim_model_url: `https://acc.autodesk.com/docs/files/projects/tgg-${num}`,
    project_manager: userIds['James Chen'],
    target_completion: daysFromNow(Math.floor(between(120, 540))),
    notes: `Reference: tggallagher.com/project/${slug}/ — contract value shown is illustrative demo data.`,
  })
  projectIds.push(id)
  projectByName[name] = id
}

// Prefab assemblies. Types mirror what TGG says it prefabricates: pump and
// boiler skids, risers, rooftop-unit modules, mechanical closets, penthouse
// piping, and (at the Faulkner tower) nearly 70 bathroom pods.
// Estimated-vs-actual hours are patterned so the Insights chart tells a
// story: multi-trade racks run over, spools run under.
const assemblyPatterns = [
  // type, trade, estRange, actualBias, count, label prefix
  ['pipe_spool', 'hvac', [10, 22], 0.93, 24, 'SP'],
  ['pipe_spool', 'plumbing', [8, 18], 0.97, 16, 'SP'],
  ['duct_section', 'hvac', [6, 14], 1.04, 14, 'DS'],
  ['mech_rack', 'hvac', [38, 64], 1.18, 10, 'MR'],
  ['plumbing_battery', 'plumbing', [20, 34], 1.08, 12, 'PB'],
  ['pump_skid', 'hvac', [45, 70], 1.02, 8, 'PS'],
  ['riser', 'fire_protection', [14, 26], 0.99, 7, 'RS'],
]
const statuses = ['modeled', 'released', 'in_fabrication', 'qc', 'shipped', 'delivered', 'installed']
// Bathroom pods belong to the Faulkner tower; everything else spreads across
// the projects that are actually in fabrication or installation.
const FAB_PROJECTS = [
  projectByName['101 Smith Place'],
  projectByName["Brigham & Women's Faulkner Hospital Inpatient Tower"],
  projectByName['305 Western Ave — Allston Labworks'],
  projectByName['74 Middlesex Ave'],
  projectByName['225 Wyman Street'],
]
let asmSeq = 1
for (const [type, trade, [lo, hi], bias, count, prefix] of assemblyPatterns) {
  for (let i = 0; i < count; i++) {
    const projId = type === 'plumbing_battery'
      ? projectByName["Brigham & Women's Faulkner Hospital Inpatient Tower"]
      : pick(FAB_PROJECTS)
    const est = round1(between(lo, hi))
    // weight toward the middle/late pipeline so the shop looks busy
    const status = pick([...statuses, 'in_fabrication', 'shipped', 'installed', 'installed'])
    const done = ['shipped', 'delivered', 'installed'].includes(status)
    const shippedDaysAgo = Math.floor(between(1, 56))
    insert('prefab_assemblies', {
      id: uuid(), org_id: ORG, project_id: projId,
      assembly_number: `${prefix}-${String(asmSeq++).padStart(3, '0')}`,
      assembly_type: type, trade, status,
      bim_reference: `RVT-${Math.floor(between(10000, 99999))}`,
      shop_hours_estimated: est,
      shop_hours_actual: done || status === 'qc' ? round1(est * bias * between(0.88, 1.12)) : null,
      scheduled_ship_date: done ? daysFromNow(-shippedDaysAgo) : daysFromNow(Math.floor(between(3, 45))),
      shipped_at: done ? daysFromNow(-shippedDaysAgo) : null,
      installed_at: status === 'installed' ? daysFromNow(-Math.max(0, shippedDaysAgo - 7)) : null,
      install_location: `Level ${Math.ceil(between(1, 9))}, Zone ${pick(['A', 'B', 'C'])}`,
    })
  }
}

})

seedAll()
  return { login: 'demo@tggallagher.com', password: 'gallagher' }
}
