import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer'
import type { ERPFullReport } from '@/lib/pdf/generateReport'
import type { FindingSeverity, ReportType } from '@/types/database'
import { REPORT_TYPE_LABELS, SEVERITY_LABELS } from '@/types/database'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#111827',
    padding: 48,
    lineHeight: 1.4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 32,
    paddingBottom: 20,
    borderBottomWidth: 3,
    borderBottomColor: '#facc15',
  },
  logoText: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  reportNumber: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#374151',
  },
  reportDate: {
    fontSize: 9,
    color: '#6b7280',
    marginTop: 2,
  },
  coverBlock: {
    marginBottom: 28,
    padding: 20,
    backgroundColor: '#f9fafb',
    borderRadius: 6,
  },
  coverTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
    marginBottom: 4,
  },
  coverSubtitle: {
    fontSize: 12,
    color: '#4b5563',
    marginBottom: 16,
  },
  coverGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  coverItem: {
    width: '45%',
  },
  coverLabel: {
    fontSize: 8,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  coverValue: {
    fontSize: 10,
    color: '#111827',
    fontFamily: 'Helvetica-Bold',
  },
  sectionHeader: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
    marginTop: 24,
    marginBottom: 10,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  executiveSummary: {
    fontSize: 9,
    color: '#374151',
    backgroundColor: '#f0fdf4',
    padding: 12,
    borderRadius: 4,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#22c55e',
  },
  table: {
    width: '100%',
    marginBottom: 12,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    borderRadius: 4,
    marginBottom: 1,
  },
  tableHeaderCell: {
    color: '#ffffff',
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    padding: '6 8',
    flex: 1,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  tableRowAlt: {
    backgroundColor: '#f9fafb',
  },
  tableCell: {
    fontSize: 9,
    padding: '5 8',
    flex: 1,
    color: '#374151',
  },
  resultPass: { color: '#16a34a', fontFamily: 'Helvetica-Bold' },
  resultFail: { color: '#dc2626', fontFamily: 'Helvetica-Bold' },
  resultMarginal: { color: '#ea580c', fontFamily: 'Helvetica-Bold' },
  resultNA: { color: '#9ca3af' },
  assetBlock: {
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 6,
  },
  assetHeader: {
    backgroundColor: '#f3f4f6',
    padding: '8 12',
    borderRadius: 5,
  },
  assetName: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
  },
  assetMeta: {
    fontSize: 8,
    color: '#6b7280',
    marginTop: 2,
  },
  assetReadings: {
    padding: '8 12',
  },
  findingCard: {
    marginBottom: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: '10 12',
  },
  findingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  severityBadge: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    padding: '2 6',
    borderRadius: 3,
    color: '#ffffff',
  },
  findingAsset: {
    fontSize: 8,
    color: '#6b7280',
  },
  findingStandardRef: {
    fontSize: 8,
    color: '#6b7280',
    fontFamily: 'Helvetica-Bold',
  },
  findingDesc: {
    fontSize: 9,
    color: '#111827',
    marginBottom: 4,
  },
  findingRec: {
    fontSize: 9,
    color: '#374151',
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#22c55e',
  },
  findingRecLabel: {
    fontSize: 7,
    color: '#16a34a',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 48,
    right: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7,
    color: '#9ca3af',
  },
  signatureBlock: {
    marginTop: 40,
    flexDirection: 'row',
    gap: 40,
  },
  signatureLine: {
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: '#374151',
    paddingTop: 4,
  },
  signatureLabel: {
    fontSize: 8,
    color: '#6b7280',
  },
  notes: {
    fontSize: 9,
    color: '#374151',
    backgroundColor: '#f9fafb',
    padding: 10,
    borderRadius: 4,
    marginBottom: 8,
  },
})

const resultStyle = (result: string | null) => {
  switch (result) {
    case 'pass': return styles.resultPass
    case 'fail': return styles.resultFail
    case 'marginal': return styles.resultMarginal
    default: return styles.resultNA
  }
}

const severityBgColors: Record<FindingSeverity, string> = {
  critical: '#dc2626',
  major: '#ea580c',
  minor: '#ca8a04',
  observation: '#2563eb',
}

export default function ReportTemplate({ report }: { report: ERPFullReport }) {
  const reportTypeLabel = report.report_type
    ? (REPORT_TYPE_LABELS[report.report_type as ReportType] ?? report.report_type)
    : 'Electrical Test Report'

  // Group readings by equipment
  const equipmentMap = new Map(report.equipment.map(e => [e.id, e]))
  const readingsByEquipment = new Map<string, typeof report.test_readings>()
  for (const reading of report.test_readings) {
    const key = reading.equipment_id ?? '__unlinked__'
    if (!readingsByEquipment.has(key)) readingsByEquipment.set(key, [])
    readingsByEquipment.get(key)!.push(reading)
  }

  const orderedFindings = [...report.findings].sort((a, b) => {
    const order: Record<string, number> = { critical: 0, major: 1, minor: 2, observation: 3 }
    return (order[a.severity ?? ''] ?? 4) - (order[b.severity ?? ''] ?? 4)
  })

  const criticalCount = orderedFindings.filter(f => f.severity === 'critical').length
  const majorCount = orderedFindings.filter(f => f.severity === 'major').length

  return (
    <Document title={`VoltTrack Report - ${report.customer?.name ?? ''} - ${report.test_date}`}>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header} fixed>
          <Text style={styles.logoText}>⚡ VoltTrack</Text>
          <View style={styles.headerRight}>
            {report.report_number && (
              <Text style={styles.reportNumber}>Report #{report.report_number}</Text>
            )}
            <Text style={styles.reportDate}>
              Generated {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </Text>
          </View>
        </View>

        {/* Cover Block */}
        <View style={styles.coverBlock}>
          <Text style={styles.coverTitle}>{reportTypeLabel}</Text>
          <Text style={styles.coverSubtitle}>
            {report.customer?.name ?? 'Customer'} — {report.location?.name ?? 'Location'}
          </Text>
          <View style={styles.coverGrid}>
            <View style={styles.coverItem}>
              <Text style={styles.coverLabel}>Test Date</Text>
              <Text style={styles.coverValue}>{report.test_date}</Text>
            </View>
            <View style={styles.coverItem}>
              <Text style={styles.coverLabel}>Technician</Text>
              <Text style={styles.coverValue}>
                {report.technician_name ?? '—'}
                {report.technician_certs ? `, ${report.technician_certs}` : ''}
              </Text>
            </View>
            <View style={styles.coverItem}>
              <Text style={styles.coverLabel}>Site Address</Text>
              <Text style={styles.coverValue}>
                {[report.location?.address, report.location?.city, report.location?.state].filter(Boolean).join(', ') || '—'}
              </Text>
            </View>
            <View style={styles.coverItem}>
              <Text style={styles.coverLabel}>Conditions</Text>
              <Text style={styles.coverValue}>
                {[
                  report.ambient_temp_f != null ? `${report.ambient_temp_f}°F` : null,
                  report.humidity_pct != null ? `${report.humidity_pct}% RH` : null,
                  report.weather_conditions,
                ].filter(Boolean).join(', ') || '—'}
              </Text>
            </View>
            <View style={styles.coverItem}>
              <Text style={styles.coverLabel}>Equipment Tested</Text>
              <Text style={styles.coverValue}>{report.equipment.length}</Text>
            </View>
            <View style={styles.coverItem}>
              <Text style={styles.coverLabel}>Findings</Text>
              <Text style={styles.coverValue}>
                {orderedFindings.length} total
                {criticalCount > 0 ? ` · ${criticalCount} Critical` : ''}
                {majorCount > 0 ? ` · ${majorCount} Major` : ''}
              </Text>
            </View>
          </View>
        </View>

        {/* Executive Summary (AI-generated) */}
        {report.executive_summary && (
          <>
            <Text style={styles.sectionHeader}>Executive Summary</Text>
            <Text style={styles.executiveSummary}>{report.executive_summary}</Text>
          </>
        )}

        {/* General Notes */}
        {report.notes && (
          <>
            <Text style={styles.sectionHeader}>General Notes</Text>
            <Text style={styles.notes}>{report.notes}</Text>
          </>
        )}

        {/* Equipment & Readings */}
        {report.equipment.length > 0 && (
          <>
            <Text style={styles.sectionHeader}>Equipment & Test Readings</Text>
            {report.equipment.map((equip) => {
              const readings = readingsByEquipment.get(equip.id) ?? []
              return (
                <View key={equip.id} style={styles.assetBlock} wrap={false}>
                  <View style={styles.assetHeader}>
                    <Text style={styles.assetName}>{equip.name}</Text>
                    <Text style={styles.assetMeta}>
                      {[equip.equipment_type, equip.manufacturer, equip.model, equip.serial_number && `S/N: ${equip.serial_number}`, equip.location_detail].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  {readings.length > 0 && (
                    <View style={styles.assetReadings}>
                      <View style={styles.table}>
                        <View style={styles.tableHeader}>
                          <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Parameter</Text>
                          <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Value</Text>
                          <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Unit</Text>
                          <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Result</Text>
                        </View>
                        {readings.map((reading, idx) => (
                          <View
                            key={reading.id}
                            style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}
                          >
                            <Text style={[styles.tableCell, { flex: 3 }]}>{reading.parameter}</Text>
                            <Text style={[styles.tableCell, { flex: 1.5, fontFamily: 'Courier' }]}>{reading.value ?? '—'}</Text>
                            <Text style={[styles.tableCell, { flex: 1, color: '#6b7280' }]}>{reading.unit ?? ''}</Text>
                            <Text style={[styles.tableCell, { flex: 1 }, resultStyle(reading.result)]}>
                              {reading.result ? reading.result.toUpperCase() : '—'}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              )
            })}
          </>
        )}

        {/* Findings */}
        {orderedFindings.length > 0 && (
          <>
            <Text style={styles.sectionHeader}>
              Findings ({orderedFindings.length})
              {criticalCount > 0 ? ` — ${criticalCount} Critical` : ''}
            </Text>
            {orderedFindings.map((finding) => {
              const equipName = finding.equipment_id ? equipmentMap.get(finding.equipment_id)?.name : null
              return (
                <View key={finding.id} style={styles.findingCard} wrap={false}>
                  <View style={styles.findingHeader}>
                    {finding.severity && (
                      <Text style={[styles.severityBadge, { backgroundColor: severityBgColors[finding.severity as FindingSeverity] }]}>
                        {SEVERITY_LABELS[finding.severity as FindingSeverity]}
                      </Text>
                    )}
                    {equipName && <Text style={styles.findingAsset}>Equipment: {equipName}</Text>}
                    {finding.standard_ref && <Text style={styles.findingStandardRef}>{finding.standard_ref}</Text>}
                  </View>
                  <Text style={styles.findingDesc}>{finding.description}</Text>
                  {finding.recommendation && (
                    <View style={styles.findingRec}>
                      <Text style={styles.findingRecLabel}>RECOMMENDATION</Text>
                      <Text>{finding.recommendation}</Text>
                    </View>
                  )}
                </View>
              )
            })}
          </>
        )}

        {/* Signature Block */}
        <View style={styles.signatureBlock}>
          <View style={styles.signatureLine}>
            <Text style={styles.signatureLabel}>Technician Signature</Text>
          </View>
          <View style={styles.signatureLine}>
            <Text style={styles.signatureLabel}>Date</Text>
          </View>
          <View style={styles.signatureLine}>
            <Text style={styles.signatureLabel}>Customer Acceptance</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            VoltTrack Electrical Testing Platform · Confidential
          </Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
