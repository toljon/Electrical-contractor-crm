import {
  REPORT_TYPE_LABELS,
  EQUIPMENT_TYPES,
  SEVERITY_COLORS,
  TRADE_LABELS,
  ASSEMBLY_STATUS_COLORS,
  PROJECT_PHASE_LABELS,
} from '@/types/database'

describe('database types', () => {
  it('has label for every report type', () => {
    expect(REPORT_TYPE_LABELS.ashrae_180).toBe('ASHRAE/ACCA 180 HVAC Preventive Maintenance')
    expect(REPORT_TYPE_LABELS.nfpa_25).toBe('NFPA 25 Fire Protection Inspection & Testing')
    expect(REPORT_TYPE_LABELS.backflow).toContain('Backflow')
  })

  it('has mechanical equipment types across all three trades', () => {
    expect(EQUIPMENT_TYPES.length).toBeGreaterThan(10)
    expect(EQUIPMENT_TYPES.find(e => e.value === 'ahu')).toBeDefined()
    expect(EQUIPMENT_TYPES.find(e => e.value === 'backflow_preventer')).toBeDefined()
    expect(EQUIPMENT_TYPES.find(e => e.value === 'fire_pump')).toBeDefined()
    const trades = new Set(EQUIPMENT_TYPES.map(e => e.trade))
    expect(trades).toContain('hvac')
    expect(trades).toContain('plumbing')
    expect(trades).toContain('fire_protection')
  })

  it('has labels for all trades', () => {
    expect(TRADE_LABELS.hvac).toBe('HVAC')
    expect(TRADE_LABELS.plumbing).toBe('Plumbing')
    expect(TRADE_LABELS.fire_protection).toBe('Fire Protection')
  })

  it('has severity colors for all severities', () => {
    expect(SEVERITY_COLORS.critical).toContain('red')
    expect(SEVERITY_COLORS.observation).toContain('blue')
  })

  it('covers the full prefab pipeline and project phases', () => {
    expect(Object.keys(ASSEMBLY_STATUS_COLORS)).toEqual([
      'modeled', 'released', 'in_fabrication', 'qc', 'shipped', 'delivered', 'installed',
    ])
    expect(PROJECT_PHASE_LABELS.coordination).toBe('BIM Coordination')
  })
})
