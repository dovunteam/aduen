import { describe, expect, it } from 'vitest'
import { EMPTY_DRAFT } from './case'
import { buildTimeline, checkCompleteness, findFactConflicts, findTimelineWarnings } from './caseReview'
import type { EvidenceMetadata } from './evidence'
import { createEvidenceExtraction, reviewCandidate } from './extraction'

const evidence = (overrides: Partial<EvidenceMetadata>): EvidenceMetadata => ({ id: crypto.randomUUID(), fileName: 'record.pdf', mimeType: 'application/pdf', size: 100, sha256: 'abc', sourceType: 'receipt', eventDate: null, description: '', includeInPack: true, uploadedAt: '2026-09-20T00:00:00.000Z', ...overrides })

describe('Aduen Check', () => {
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

  it('does not require proof of contact before preparing the first merchant request', () => {
    const firstRequest = checkCompleteness({ ...EMPTY_DRAFT, issue: 'non_delivery', contactHistory: 'none' }, [])
    expect(firstRequest.find((item) => item.id === 'non_delivery-message')?.level).toBe('useful')
    const priorContact = checkCompleteness({ ...EMPTY_DRAFT, issue: 'non_delivery', contactHistory: 'contacted' }, [])
    expect(priorContact.find((item) => item.id === 'non_delivery-message')?.level).toBe('required')
  })
})

describe('fact conflicts', () => {
  it('flags confirmed derived values that differ from entered case facts', () => {
    const amountExtraction = createEvidenceExtraction('e1', 'Total RM 130.00')
    amountExtraction.candidates[0] = reviewCandidate(amountExtraction.candidates[0], 'confirmed')
    expect(findFactConflicts({ ...EMPTY_DRAFT, amount: '125.50' }, [amountExtraction])[0]).toContain('differs')
  })
  it('ignores unconfirmed derived values', () => {
    expect(findFactConflicts({ ...EMPTY_DRAFT, amount: '125.50' }, [createEvidenceExtraction('e1', 'Total RM 130.00')])).toEqual([])
  })
  it('flags a confirmed remedy that differs from the case record', () => {
    const extraction = createEvidenceExtraction('e1', 'I requested a replacement.')
    extraction.candidates[0] = reviewCandidate(extraction.candidates[0], 'confirmed')
    expect(findFactConflicts({ ...EMPTY_DRAFT, remedy: 'refund' }, [extraction])[0]).toContain('requested remedy')
  })
  it('flags a single confirmed evidence date that differs from the purchase date', () => {
    const extraction = createEvidenceExtraction('e1', 'Order date: 2026-08-02')
    extraction.candidates[0] = reviewCandidate(extraction.candidates[0], 'confirmed')
    expect(findFactConflicts({ ...EMPTY_DRAFT, purchaseDate: '2026-08-01' }, [extraction])[0]).toContain('purchase date')
  })
  it('does not compare an unclassified event date with the purchase date', () => {
    const extraction = createEvidenceExtraction('e1', 'Delivery date: 2026-08-02')
    extraction.candidates[0] = reviewCandidate(extraction.candidates[0], 'confirmed')
    expect(findFactConflicts({ ...EMPTY_DRAFT, purchaseDate: '2026-08-01' }, [extraction])).toEqual([])
  })
  it('flags a Malay date explicitly labelled as the purchase date', () => {
    const extraction = createEvidenceExtraction('e1', 'Tarikh pembelian: 2026-08-02')
    extraction.candidates[0] = reviewCandidate(extraction.candidates[0], 'confirmed')
    expect(findFactConflicts({ ...EMPTY_DRAFT, purchaseDate: '2026-08-01' }, [extraction])[0]).toContain('purchase date')
  })
  it('flags a confirmed consumer name that differs from the case record', () => {
    const extraction = createEvidenceExtraction('e1', 'Customer name: Another Synthetic Consumer.')
    extraction.candidates[0] = reviewCandidate(extraction.candidates[0], 'confirmed')
    expect(findFactConflicts({ ...EMPTY_DRAFT, consumerName: 'Synthetic Test Consumer' }, [extraction])[0]).toContain('consumer name')
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
