import { describe, expect, it } from 'vitest'
import { EMPTY_DRAFT } from '../domain/case'
import { approveComplaintPack, createComplaintPack } from '../domain/complaintPack'
import { evaluateInitialRoute } from '../domain/routing'
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
    ] }
    const content = new TextDecoder('windows-1252').decode(createComplaintPackPdf(pack).output('arraybuffer'))
    expect(content).toContain('Possible transaction amount: 120.00')
    expect(content).toContain('Possible refund amount: 25.00')
  })
})
