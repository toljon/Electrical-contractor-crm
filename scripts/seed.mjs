// TGG Ops demo seed — realistic TG Gallagher world for demos.
// Usage: npm run seed        (wipes and recreates data/tgg-ops.db)
// Login: demo@tggallagher.com / gallagher
import Database from 'better-sqlite3'
import { randomUUID, randomBytes, scryptSync } from 'crypto'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { SCHEMA } from '../src/lib/localdb/schema.js'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const DATA_DIR = process.env.TGG_DATA_DIR ?? path.join(ROOT, 'data')
const DB_PATH = path.join(DATA_DIR, 'tgg-ops.db')

fs.mkdirSync(path.join(DATA_DIR, 'uploads'), { recursive: true })
for (const suffix of ['', '-wal', '-shm']) fs.rmSync(DB_PATH + suffix, { force: true })

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
db.exec(SCHEMA)

// ── helpers ─────────────────────────────────────────────
const uuid = () => randomUUID()
const hashPassword = (password) => {
  const salt = randomBytes(16).toString('hex')
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`
}
const daysFromNow = (n) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
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
const ORG = uuid()
insert('organizations', {
  id: ORG, name: 'TG Gallagher', slug: 'tg-gallagher',
  city: 'Waltham', state: 'MA', phone: '(781) 890-7100',
  license_number: 'MA PL-8842 / SM-1170',
})

const PASSWORD = hashPassword('gallagher')
const people = [
  ['demo@tggallagher.com', 'Demo User', 'admin', 'VP of Operations'],
  ['mfitz@tggallagher.com', 'Mike Fitzgerald', 'technician', 'HVAC Service Tech'],
  ['sdoyle@tggallagher.com', 'Sarah Doyle', 'technician', 'Plumbing Foreman'],
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
const TECHS = [userIds['Mike Fitzgerald'], userIds['Sarah Doyle']]

// ── customers, locations, equipment ─────────────────────
const customersSpec = [
  {
    name: 'Longwood Medical Research Center', type: 'commercial', city: 'Boston',
    locations: [
      { name: 'Building C — Central Plant', equipment: [
        ['AHU-1', 'ahu', 'hvac', 'Trane', '30,000 CFM'],
        ['AHU-3', 'ahu', 'hvac', 'Trane', '15,000 CFM'],
        ['CH-1', 'chiller', 'hvac', 'Carrier', '450 tons'],
        ['B-1', 'boiler', 'hvac', 'Cleaver-Brooks', '6,000 MBH'],
        ['P-3', 'pump', 'hvac', 'Bell & Gossett', '800 GPM'],
        ['FP-1', 'fire_pump', 'fire_protection', 'Peerless', '1,000 GPM'],
      ]},
      { name: 'Vivarium Wing', equipment: [
        ['EF-12', 'exhaust_fan', 'hvac', 'Greenheck', '8,500 CFM'],
        ['MG-1', 'med_gas', 'plumbing', 'BeaconMedaes', null],
      ]},
    ],
  },
  {
    name: 'Kendall BioWorks', type: 'commercial', city: 'Cambridge',
    locations: [
      { name: '325 Binney St — Penthouse', equipment: [
        ['RTU-1', 'rtu', 'hvac', 'Daikin', '80 tons'],
        ['RTU-2', 'rtu', 'hvac', 'Daikin', '80 tons'],
        ['CT-1', 'cooling_tower', 'hvac', 'BAC', '600 tons'],
        ['BFP-4', 'backflow_preventer', 'plumbing', 'Watts', '4 in'],
      ]},
    ],
  },
  {
    name: 'Back Bay Tower Partners', type: 'commercial', city: 'Boston',
    locations: [
      { name: '500 Boylston — Mechanical Level', equipment: [
        ['CH-2', 'chiller', 'hvac', 'York', '700 tons'],
        ['SPK-1', 'sprinkler_system', 'fire_protection', 'Viking', null],
        ['DWH-1', 'water_heater', 'plumbing', 'PVI', '500 gal'],
      ]},
    ],
  },
  {
    name: 'Harborview Hospitality Group', type: 'commercial', city: 'Boston',
    locations: [
      { name: 'Seaport Hotel — Basement Plant', equipment: [
        ['B-2', 'boiler', 'hvac', 'Lochinvar', '4,000 MBH'],
        ['BP-1', 'booster_pump', 'plumbing', 'Grundfos', '120 GPM'],
        ['BFP-2', 'backflow_preventer', 'plumbing', 'Febco', '3 in'],
      ]},
    ],
  },
  {
    name: 'Charles River University', type: 'government', city: 'Boston',
    locations: [
      { name: 'Science Quad Utility Plant', equipment: [
        ['AHU-7', 'ahu', 'hvac', 'JCI', '22,000 CFM'],
        ['STP-1', 'standpipe', 'fire_protection', null, null],
        ['HX-2', 'heat_exchanger', 'hvac', 'Alfa Laval', '3,500 MBH'],
      ]},
    ],
  },
  {
    name: 'Seaport Data Holdings', type: 'industrial', city: 'Boston',
    locations: [
      { name: 'DC-2 — CRAH Gallery', equipment: [
        ['CRAH-1', 'ahu', 'hvac', 'Vertiv', '40 tons'],
        ['CRAH-2', 'ahu', 'hvac', 'Vertiv', '40 tons'],
        ['FP-2', 'fire_pump', 'fire_protection', 'Aurora', '750 GPM'],
      ]},
    ],
  },
]

const equipmentIds = [] // {id, name, locId, custId, trade}
const locationIds = []  // {id, custId, name}
const customerIds = []
for (const spec of customersSpec) {
  const custId = insert('customers', {
    id: uuid(), org_id: ORG, name: spec.name, customer_type: spec.type,
    billing_city: spec.city, billing_state: 'MA', payment_terms: 'net30', status: 'active',
  })
  customerIds.push(custId)
  for (const loc of spec.locations) {
    const locId = insert('locations', {
      id: uuid(), org_id: ORG, customer_id: custId, name: loc.name,
      city: spec.city, state: 'MA',
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

// ── service history: work orders + reports + readings ───
// Quarterly PM visits over the past year for the two biggest customers.
// AHU-3 at Longwood gets a deliberately drifting temperature split —
// the predictive-maintenance talking point.
const ahu3 = equipmentIds.find((e) => e.name === 'AHU-3')
const reportTypesByTrade = { hvac: 'ashrae_180', plumbing: 'backflow', fire_protection: 'nfpa_25' }

let woSeq = 1000
const makeWorkOrder = (custId, locId, opts = {}) =>
  insert('work_orders', {
    id: uuid(), org_id: ORG, customer_id: custId, location_id: locId,
    assigned_to: opts.tech ?? pick(TECHS), order_number: `WO-${woSeq++}`,
    work_type: opts.workType ?? 'maintenance', trade: opts.trade ?? 'hvac',
    status: opts.status ?? 'complete', scheduled_date: opts.date,
    priority: opts.priority ?? 'normal',
    updated_at: `${opts.date}T15:00:00.000Z`,
  })

const findingsPool = [
  ['minor', 'Filter pressure drop above replacement threshold', 'Replace filter bank', 'ASHRAE 180 Table 5-3', 'resolved'],
  ['major', 'Supply fan belt fraying and misaligned', 'Replace belt set and realign sheaves', 'ASHRAE 180 Table 5-3', 'open'],
  ['observation', 'Condensate pan showing early corrosion', 'Monitor at next PM; treat pan', null, 'open'],
  ['minor', 'Gauge out of calibration on discharge line', 'Replace 0-200 psi gauge', 'NFPA 25 13.4.3', 'resolved'],
  ['critical', 'Jockey pump short-cycling — suspected check valve leak', 'Replace jockey pump check valve', 'NFPA 25 8.3.1', 'open'],
  ['major', 'Backflow relief valve discharging continuously', 'Rebuild RP assembly, retest', '248 CMR 10.14', 'quoted'],
]

let repSeq = 2000
for (let q = 4; q >= 1; q--) {
  const date = daysFromNow(-q * 90 + 3)
  for (const { id: locId, custId } of locationIds.slice(0, 4)) {
    const trade = 'hvac'
    const woId = makeWorkOrder(custId, locId, { date, trade })
    const repId = insert('inspection_reports', {
      id: uuid(), org_id: ORG, work_order_id: woId, customer_id: custId,
      location_id: locId, report_number: `TGG-${repSeq++}`,
      report_type: reportTypesByTrade[trade], test_date: date,
      technician_id: TECHS[0], technician_name: 'Mike Fitzgerald',
      technician_certs: 'EPA 608 Universal, OSHA 30',
    })
    db.prepare('UPDATE work_orders SET report_generated = 1 WHERE id = ?').run(woId)
    const locEquip = equipmentIds.filter((e) => e.locId === locId && e.trade === 'hvac')
    for (const eq of locEquip) {
      // ΔT drift story: AHU-3 degrades 19°F → 11°F over the year
      const isDrifter = ahu3 && eq.id === ahu3.id
      const deltaT = isDrifter ? 19 - (4 - q) * 2.7 : between(17, 21)
      const readings = [
        ['Supply Air Temperature', round1(55 + between(-1, 2)), '°F', 'pass'],
        ['Temperature Split (ΔT)', round1(deltaT), '°F', deltaT < 14 ? (deltaT < 12 ? 'fail' : 'marginal') : 'pass'],
        ['Filter Pressure Drop', round1(between(0.3, 0.9)), 'in. w.c.', 'pass'],
        ['Fan Motor Current', round1(between(18, 42)), 'A', 'pass'],
      ]
      readings.forEach(([parameter, value, unit, result], i) =>
        insert('test_readings', {
          id: uuid(), org_id: ORG, report_id: repId, equipment_id: eq.id,
          parameter, value: String(value), unit, result, sort_order: i,
        })
      )
    }
    if (rng() < 0.7) {
      const [severity, description, recommendation, standard_ref, status] = pick(findingsPool)
      insert('findings', {
        id: uuid(), org_id: ORG, report_id: repId,
        equipment_id: pick(locEquip)?.id ?? null,
        severity, description, recommendation, standard_ref, status, sort_order: 0,
      })
    }
  }
}

// Today's schedule + open work orders for the dashboard
const today = daysFromNow(0)
makeWorkOrder(customerIds[0], locationIds[0].id, { date: today, status: 'on_site', workType: 'maintenance', trade: 'hvac', tech: TECHS[0] })
makeWorkOrder(customerIds[1], locationIds[2].id, { date: today, status: 'assigned', workType: 'inspection', trade: 'plumbing', tech: TECHS[1] })
makeWorkOrder(customerIds[3], locationIds[4].id, { date: today, status: 'en_route', workType: 'repair', trade: 'plumbing', priority: 'high', tech: TECHS[1] })
makeWorkOrder(customerIds[2], locationIds[3].id, { date: daysFromNow(1), status: 'assigned', workType: 'inspection', trade: 'fire_protection' })
makeWorkOrder(customerIds[5], locationIds[6].id, { date: daysFromNow(2), status: 'created', workType: 'startup', trade: 'hvac' })
makeWorkOrder(customerIds[4], locationIds[5].id, { date: daysFromNow(-2), status: 'complete', workType: 'emergency', trade: 'hvac', priority: 'emergency' })

// ── construction projects + prefab pipeline ─────────────
const projectsSpec = [
  ['Kendall Square Lab Tower', '26-104', 'Turner Construction', 'Cambridge', 'life_science', 'fabrication', 18_500_000, ['hvac', 'plumbing']],
  ['Longwood Ambulatory Pavilion', '26-098', 'Suffolk', 'Boston', 'healthcare', 'coordination', 24_200_000, ['hvac', 'plumbing', 'fire_protection']],
  ['Allston Innovation Campus B2', '25-141', 'John Moriarty & Associates', 'Allston', 'higher_ed', 'installation', 11_700_000, ['hvac', 'plumbing']],
  ['Seaport Data Center DC-3', '26-112', 'Gilbane', 'Boston', 'data_center', 'preconstruction', 31_000_000, ['hvac', 'fire_protection']],
  ['South Station Air Rights T2', '25-087', 'Consigli', 'Boston', 'commercial_office', 'commissioning', 9_400_000, ['hvac', 'plumbing']],
  ['Assembly Row BioManufacturing', '26-120', 'Turner Construction', 'Somerville', 'life_science', 'pursuit', 15_800_000, ['hvac', 'plumbing', 'fire_protection']],
]
const projectIds = []
for (const [name, num, gc, city, market, phase, value, trades] of projectsSpec) {
  projectIds.push(insert('projects', {
    id: uuid(), org_id: ORG, name, project_number: num, general_contractor: gc,
    city, state: 'MA', market, phase, contract_value_cents: value * 100,
    trades: JSON.stringify(trades),
    bim_model_url: 'https://acc.autodesk.com/docs/files/projects/tgg-' + num,
    project_manager: userIds['James Chen'],
    target_completion: daysFromNow(Math.floor(between(120, 540))),
  }))
}

// Prefab assemblies: est vs actual hours patterned by type so the
// Insights chart tells a story (racks run over, spools run under).
const assemblyPatterns = [
  // type, trade, estRange, actualBias (multiplier), count
  ['pipe_spool', 'hvac', [10, 22], 0.93, 26],
  ['pipe_spool', 'plumbing', [8, 18], 0.97, 18],
  ['duct_section', 'hvac', [6, 14], 1.04, 16],
  ['mech_rack', 'hvac', [38, 64], 1.18, 10],
  ['plumbing_battery', 'plumbing', [20, 34], 1.08, 8],
  ['pump_skid', 'hvac', [45, 70], 1.02, 4],
  ['riser', 'fire_protection', [14, 26], 0.99, 6],
]
const statuses = ['modeled', 'released', 'in_fabrication', 'qc', 'shipped', 'delivered', 'installed']
let asmSeq = 1
for (const [type, trade, [lo, hi], bias, count] of assemblyPatterns) {
  for (let i = 0; i < count; i++) {
    const projId = pick(projectIds.slice(0, 5)) // pursuit project has no fab yet
    const est = round1(between(lo, hi))
    // weight toward the middle/late pipeline so the shop looks busy
    const status = pick([...statuses, 'in_fabrication', 'shipped', 'installed', 'installed'])
    const done = ['shipped', 'delivered', 'installed'].includes(status)
    const shippedDaysAgo = Math.floor(between(1, 56))
    const prefix = { pipe_spool: 'SP', duct_section: 'DS', mech_rack: 'MR', plumbing_battery: 'PB', pump_skid: 'PS', riser: 'RS' }[type]
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

const counts = {}
for (const t of ['customers', 'locations', 'equipment', 'work_orders', 'inspection_reports', 'test_readings', 'findings', 'projects', 'prefab_assemblies']) {
  counts[t] = db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get().c
}
console.log('Seeded TGG Ops demo database:')
console.table ? console.table(counts) : console.log(counts)
console.log('\nLogin: demo@tggallagher.com / gallagher')
