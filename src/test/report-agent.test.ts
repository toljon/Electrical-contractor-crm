// @vitest-environment node
import { generateExecutiveSummary } from '@/lib/agents/report-agent'

// Integration test — requires ANTHROPIC_API_KEY in env
describe.skipIf(!process.env.ANTHROPIC_API_KEY)('report agent', () => {
  it('generates an executive summary', async () => {
    const summary = await generateExecutiveSummary({
      customerName: 'Longwood Medical Research Center',
      locationName: 'Building C — Central Plant',
      reportType: 'ASHRAE/ACCA 180 HVAC Preventive Maintenance',
      testDate: '2026-03-09',
      technicianName: 'J. Smith, MA Refrigeration Tech',
      findings: [
        { severity: 'major', description: 'AHU-3 supply fan belt fraying and misaligned', recommendation: 'Replace belt set and realign sheaves', standardRef: 'ASHRAE 180 Table 5-3' }
      ],
      readings: [
        { parameter: 'Temperature Split (ΔT)', value: '12', unit: '°F', result: 'marginal' }
      ],
    })
    expect(summary.length).toBeGreaterThan(100)
    expect(summary).toContain('Longwood')
  }, 30000)
})
