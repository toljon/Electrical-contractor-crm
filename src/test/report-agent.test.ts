// @vitest-environment node
import { generateExecutiveSummary } from '@/lib/agents/report-agent'

// Integration test — requires ANTHROPIC_API_KEY in env
describe.skipIf(!process.env.ANTHROPIC_API_KEY)('report agent', () => {
  it('generates an executive summary', async () => {
    const summary = await generateExecutiveSummary({
      customerName: 'Acme Manufacturing',
      locationName: 'Plant A',
      reportType: 'NFPA 70B Preventative Maintenance',
      testDate: '2026-03-09',
      technicianName: 'J. Smith, NETA Level III',
      findings: [
        { severity: 'major', description: 'Loose connection at bus bar', recommendation: 'Tighten to spec torque', standardRef: 'NFPA 70B 11.17' }
      ],
      readings: [
        { parameter: 'Insulation Resistance', value: '50', unit: 'MΩ', result: 'marginal' }
      ],
    })
    expect(summary.length).toBeGreaterThan(100)
    expect(summary).toContain('Acme')
  }, 30000)
})
