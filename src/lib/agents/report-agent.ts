import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

interface ReportData {
  customerName: string
  locationName: string
  reportType: string
  testDate: string
  technicianName: string
  findings: Array<{
    severity: string
    description: string
    recommendation: string | null
    standardRef: string | null
  }>
  readings: Array<{
    parameter: string
    value: string | null
    unit: string | null
    result: string | null
  }>
}

export async function generateExecutiveSummary(data: ReportData): Promise<string> {
  const findingsSummary = data.findings.length > 0
    ? `Findings: ${data.findings.map(f => `[${f.severity.toUpperCase()}] ${f.description}`).join('; ')}`
    : 'No deficiencies identified.'

  const readingsSummary = data.readings
    .filter(r => r.result === 'fail' || r.result === 'marginal')
    .map(r => `${r.parameter}: ${r.value}${r.unit ? ' ' + r.unit : ''} (${r.result})`)
    .join(', ')

  const message = await client.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: `Write a concise, professional executive summary (2-3 paragraphs) for a mechanical systems inspection report (HVAC, plumbing, or fire protection) issued by TG Gallagher, a mechanical contractor.

Customer: ${data.customerName}
Location: ${data.locationName}
Report type: ${data.reportType}
Test date: ${data.testDate}
Technician: ${data.technicianName}
${findingsSummary}
${readingsSummary ? `Out-of-tolerance readings: ${readingsSummary}` : ''}

Write in third person. Be factual and professional. Lead with the overall condition assessment, then summarize findings, then state recommended next steps. Do not use filler phrases like "It is important to note".`,
      },
    ],
  })

  // A refusal comes back with no content blocks at all
  const block = message.content[0]
  if (!block || block.type !== 'text') {
    throw new Error('The model returned no summary text')
  }

  return block.text
}
