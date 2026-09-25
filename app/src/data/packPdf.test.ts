import { describe, expect, it } from 'vitest'
import { EMPTY_DRAFT } from '../domain/case'
import { approveComplaintPack, createComplaintPack } from '../domain/complaintPack'
import { evaluateInitialRoute } from '../domain/routing'
import type { EvidenceMetadata } from '../domain/evidence'
import { createEvidenceExtraction, reviewCandidate } from '../domain/extraction'
import { createComplaintPackPdf } from './packPdf'

describe('complaint pack PDF localization', () => {
  it('renders Bahasa Malaysia labels and declaration for a BM pack', () => {
    const draft = { ...EMPTY_DRAFT, consumerName: 'Pengguna Contoh', seller: 'Kedai Contoh', issue: 'non_delivery' as const, remedy: 'refund' as const }
    const pack = approveComplaintPack(createComplaintPack(draft, [], evaluateInitialRoute(draft, []), new Date(), 1, [], 'ms'), new Date('2026-09-22T00:00:00Z'))
    const bytes = createComplaintPackPdf(pack).output('arraybuffer')
    const content = new TextDecoder('windows-1252').decode(bytes)
    expect(content).toContain('TRANSAKSI')
    expect(content).toContain('PENYELESAIAN DIMINTA')
    expect(content).toContain('PENGAKUAN PENGGUNA')
    expect(content).toContain('Saya, Pengguna Contoh')
    expect(content).toContain('Tuan/Puan Kedai Contoh')
    expect(content).not.toContain('USER DECLARATION')
  })

  it('labels transaction and refund amounts separately in an exported PDF', () => {
    const draft = { ...EMPTY_DRAFT, seller: 'Example Store' }
    const base = approveComplaintPack(createComplaintPack(draft, [], evaluateInitialRoute(draft, [])), new Date('2026-09-22T00:00:00Z'))
    const pack = { ...base, confirmedDerivedFacts: [
      { field: 'amount', value: '120.00', extractedValue: '120.00', evidenceId: 'e1', extractorVersion: 'plain-text-v6', candidateId: 'c1', amountRole: 'transaction' as const },
      { field: 'amount', value: '25.00', extractedValue: '25.00', evidenceId: 'e1', extractorVersion: 'plain-text-v6', candidateId: 'c2', amountRole: 'refund' as const },
      { field: 'reference', value: 'ADU-1234', extractedValue: 'ADU-1234', evidenceId: 'e1', extractorVersion: 'plain-text-v7', candidateId: 'c3', referenceRole: 'order' as const },
      { field: 'reference', value: 'INV-5678', extractedValue: 'INV-5678', evidenceId: 'e1', extractorVersion: 'plain-text-v7', candidateId: 'c4', referenceRole: 'invoice' as const },
    ] }
    const content = new TextDecoder('windows-1252').decode(createComplaintPackPdf(pack).output('arraybuffer'))
    expect(content).toContain('Possible transaction amount: 120.00')
    expect(content).toContain('Possible refund amount: 25.00')
    expect(content).toContain('Order reference: ADU-1234')
    expect(content).toContain('Invoice number: INV-5678')
  })

  it('exports confirmed extracted dates in the chronology with their provenance', () => {
    const evidence: EvidenceMetadata = { id: 'e1', fileName: 'synthetic-order.txt', mimeType: 'text/plain', size: 30, sha256: 'a'.repeat(64), sourceType: 'receipt', eventDate: null, description: 'Synthetic order record', includeInPack: true, uploadedAt: '2026-09-22T00:00:00Z' }
    const extraction = createEvidenceExtraction(evidence.id, 'Delivery date: 2026-09-10')
    extraction.candidates[0] = reviewCandidate(extraction.candidates[0], 'confirmed')
    const draft = { ...EMPTY_DRAFT, seller: 'Synthetic Store' }
    const pack = approveComplaintPack(createComplaintPack(draft, [evidence], evaluateInitialRoute(draft, []), new Date(), 1, [extraction], 'ms'), new Date('2026-09-22T00:00:00Z'))
    const content = new TextDecoder('windows-1252').decode(createComplaintPackPdf(pack).output('arraybuffer'))
    expect(content).toContain('Tarikh penghantaran dalam bukti')
    expect(content).toContain('fakta daripada bukti yang disahkan pengguna')
    expect(content).toContain('Bukti: synthetic-order.txt')
  })

  it('paginates a long merchant request instead of drawing its lines beyond one page', () => {
    const draft = { ...EMPTY_DRAFT, consumerName: 'Synthetic Consumer', seller: 'Synthetic Store' }
    const base = approveComplaintPack(createComplaintPack(draft, [], evaluateInitialRoute(draft, [])), new Date('2026-09-22T00:00:00Z'))
    const body = Array.from({ length: 180 }, (_, index) => `Synthetic case detail ${index + 1}: the merchant has not delivered the listed item.`).join('\n')
    const pdf = createComplaintPackPdf({ ...base, merchantRequest: { ...base.merchantRequest, body } })
    expect(pdf.getNumberOfPages()).toBeGreaterThan(4)
    expect(new TextDecoder('windows-1252').decode(pdf.output('arraybuffer'))).toContain('Synthetic case detail 180')
  })
})
