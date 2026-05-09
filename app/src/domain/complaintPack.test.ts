import { describe, expect, it } from 'vitest'
import { EMPTY_DRAFT } from './case'
import { approveComplaintPack, createComplaintPack, packFileName } from './complaintPack'
import type { EvidenceMetadata } from './evidence'
import type { RouteEvaluation } from './routing'

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
    expect(packFileName(pack)).toBe('buktiva-example-store-v1.pdf')
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
})
