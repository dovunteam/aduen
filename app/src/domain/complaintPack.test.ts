import { describe, expect, it } from 'vitest'
import { EMPTY_DRAFT } from './case'
import { approveComplaintPack, confirmedFactLabel, createComplaintPack, packFileName } from './complaintPack'
import type { EvidenceMetadata } from './evidence'
import type { RouteEvaluation } from './routing'
import { createEvidenceExtraction, reviewCandidate } from './extraction'

const route: RouteEvaluation = { routeName: 'Merchant or platform first', recommendedAction: 'Write', matchingFacts: [], unmetPrerequisites: [], exclusionsChecked: [], source: 'R-010', sourceUrl: 'https://example.test/rule', sourceType: 'product-default', sourceChecked: '20 September 2026', ruleVersion: 'MY-R010-2026.09.20', confidence: 'supported', officialLinks: [{ label: 'Example destination', url: 'https://example.test/destination' }] }
const item: EvidenceMetadata = { id: 'e1', fileName: 'receipt.pdf', mimeType: 'application/pdf', size: 100, sha256: 'abc', sourceType: 'receipt', eventDate: '2026-05-01', description: 'Order receipt', includeInPack: true, uploadedAt: '2026-05-01T00:00:00Z' }

describe('complaint pack', () => {
  it('includes only user-selected evidence and retains route version', () => {
    const draft = { ...EMPTY_DRAFT, seller: 'Example Store', purchaseDate: '2026-05-01', amount: '120', issue: 'non_delivery' as const, remedy: 'refund' as const, remedyAmount: '120' }
    const excluded = { ...item, id: 'e2', fileName: 'excluded.pdf', includeInPack: false }
    const pack = createComplaintPack(draft, [item, excluded], route, new Date('2026-05-10T00:00:00Z'))
    expect(pack.evidence.map((entry) => entry.id)).toEqual(['e1'])
    expect(pack.route.ruleVersion).toBe('MY-R010-2026.09.20')
    expect(pack.route.officialLinks).toEqual([{ label: 'Example destination', url: 'https://example.test/destination' }])
    expect(pack.merchantRequest.body).toContain('Example Store')
    expect(pack.approvedAt).toBeNull()
    expect(packFileName(pack)).toBe('Aduen-example-store-v1.pdf')
  })

  it('records explicit approval without altering the source pack', () => {
    const pack = createComplaintPack(EMPTY_DRAFT, [], route)
    const approved = approveComplaintPack(pack, new Date('2026-05-10T10:00:00Z'))
    expect(pack.approvedAt).toBeNull()
    expect(approved.approvedAt).toBe('2026-05-10T10:00:00.000Z')
  })

  it('accepts an explicit immutable version number', () => {
    expect(createComplaintPack(EMPTY_DRAFT, [], route, new Date(), 3).version).toBe(3)
  })

  it('preserves the candidate and possible amount role for distinct confirmed figures', () => {
    const extraction = createEvidenceExtraction(item.id, 'Total RM 120.00\nRefund RM 25.00')
    extraction.candidates = extraction.candidates.map((candidate) => reviewCandidate(candidate, 'confirmed'))
    const pack = createComplaintPack(EMPTY_DRAFT, [item], route, new Date(), 1, [extraction], 'ms')
    expect(pack.confirmedDerivedFacts.map(({ amountRole }) => amountRole)).toEqual(['transaction', 'refund'])
    expect(pack.confirmedDerivedFacts.map(({ candidateId }) => candidateId)).toEqual(extraction.candidates.map(({ id }) => id))
    expect(pack.confirmedDerivedFacts.map((fact) => confirmedFactLabel(fact, 'ms'))).toEqual(['Jumlah transaksi mungkin', 'Jumlah bayaran balik mungkin'])
    expect(confirmedFactLabel({ ...pack.confirmedDerivedFacts[0], amountRole: undefined }, 'en')).toBe('Amount')
  })

  it('adds confirmed extracted dates to the pack timeline only for selected evidence', () => {
    const excluded = { ...item, id: 'e2', includeInPack: false }
    const includedDates = createEvidenceExtraction(item.id, 'Delivery date: 2026-05-03')
    const excludedDates = createEvidenceExtraction(excluded.id, 'Delivery date: 2026-05-04')
    includedDates.candidates[0] = reviewCandidate(includedDates.candidates[0], 'confirmed')
    excludedDates.candidates[0] = reviewCandidate(excludedDates.candidates[0], 'confirmed')
    const pack = createComplaintPack(EMPTY_DRAFT, [item, excluded], route, new Date(), 1, [includedDates, excludedDates])
    expect(pack.timeline).toContainEqual(expect.objectContaining({ date: '2026-05-03', source: 'confirmed extracted fact', detail: 'receipt.pdf' }))
    expect(pack.timeline.some((entry) => entry.date === '2026-05-04')).toBe(false)
  })
})
