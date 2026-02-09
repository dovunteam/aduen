import { describe, expect, it } from 'vitest'
import { EMPTY_DRAFT } from './case'
import { buildTimeline, checkCompleteness, findTimelineWarnings } from './caseReview'
import type { EvidenceMetadata } from './evidence'

const evidence = (overrides: Partial<EvidenceMetadata>): EvidenceMetadata => ({ id: crypto.randomUUID(), fileName: 'record.pdf', mimeType: 'application/pdf', size: 100, sha256: 'abc', sourceType: 'receipt', eventDate: null, description: '', includeInPack: true, uploadedAt: '2026-09-20T00:00:00.000Z', ...overrides })

describe('Tuntiva Check', () => {
  it('uses issue-specific evidence rules without inventing evidence', () => {
    const draft = { ...EMPTY_DRAFT, issue: 'non_delivery' as const, remedy: 'refund' as const, remedyAmount: '' }
    const checks = checkCompleteness(draft, [evidence({ sourceType: 'receipt' })])
    expect(checks.find((item) => item.id === 'transaction')?.satisfied).toBe(true)
    expect(checks.find((item) => item.id === 'non_delivery-listing')?.satisfied).toBe(false)
    expect(checks.find((item) => item.id === 'refund-amount')?.satisfied).toBe(false)
  })

  it('ignores records excluded from the pack', () => {
    const checks = checkCompleteness({ ...EMPTY_DRAFT, issue: 'cancellation' }, [evidence({ sourceType: 'payment', includeInPack: false })])
    expect(checks.find((item) => item.id === 'payment')?.satisfied).toBe(false)
  })
})

describe('timeline', () => {
  it('sorts known dates before unknown dates and retains provenance', () => {
    const draft = { ...EMPTY_DRAFT, seller: 'Example', amount: '100', purchaseDate: '2026-05-03' }
    const items = buildTimeline(draft, [evidence({ id: 'later', eventDate: '2026-05-05' }), evidence({ id: 'unknown', eventDate: null })])
    expect(items.map((item) => item.id)).toEqual(['purchase', 'later', 'unknown'])
    expect(items[0].source).toBe('confirmed case detail')
  })

  it('flags unknown and pre-purchase evidence dates', () => {
    const draft = { ...EMPTY_DRAFT, purchaseDate: '2026-05-03' }
    const timeline = buildTimeline(draft, [evidence({ eventDate: '2026-05-01' }), evidence({ eventDate: null })])
    expect(findTimelineWarnings(draft, timeline)).toHaveLength(2)
  })

  it('includes confirmed promise and merchant-contact events', () => {
    const draft = { ...EMPTY_DRAFT, purchaseDate: '2026-05-01', promisedDate: '2026-05-05', contactHistory: 'contacted' as const, contactDate: '2026-05-06' }
    expect(buildTimeline(draft, []).map((item) => item.id)).toEqual(['purchase', 'promised', 'merchant-contact'])
  })
})
