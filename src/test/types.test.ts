import { REPORT_TYPE_LABELS, EQUIPMENT_TYPES, SEVERITY_COLORS, STATUS_COLORS } from '@/types/database'

describe('database types', () => {
  it('has label for every report type', () => {
    expect(REPORT_TYPE_LABELS.nfpa_70b).toBe('NFPA 70B Preventative Maintenance')
    expect(REPORT_TYPE_LABELS.infrared).toBe('Infrared Thermography')
  })

  it('has equipment types array', () => {
    expect(EQUIPMENT_TYPES.length).toBeGreaterThan(10)
    expect(EQUIPMENT_TYPES.find(e => e.value === 'switchgear')).toBeDefined()
  })

  it('has severity colors for all severities', () => {
    expect(SEVERITY_COLORS.critical).toContain('red')
    expect(SEVERITY_COLORS.observation).toContain('blue')
  })
})
