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
  it('flags different confirmed amounts across evidence even when one matches the case', () => {
    const first = createEvidenceExtraction('e1', 'Total RM 130.00')
    const second = createEvidenceExtraction('e2', 'Total RM 125.50')
    first.candidates[0] = reviewCandidate(first.candidates[0], 'confirmed')
    second.candidates[0] = reviewCandidate(second.candidates[0], 'confirmed')
    expect(findFactConflicts({ ...EMPTY_DRAFT, amount: '125.50' }, [first, second])).toContain('Confirmed evidence contains different transaction amounts.')
  })
  it('ignores unconfirmed derived values', () => {
    expect(findFactConflicts({ ...EMPTY_DRAFT, amount: '125.50' }, [createEvidenceExtraction('e1', 'Total RM 130.00')])).toEqual([])
  })
  it('flags a confirmed remedy that differs from the case record', () => {
    const extraction = createEvidenceExtraction('e1', 'I requested a replacement.')
    extraction.candidates[0] = reviewCandidate(extraction.candidates[0], 'confirmed')
    expect(findFactConflicts({ ...EMPTY_DRAFT, remedy: 'refund' }, [extraction])[0]).toContain('requested remedy')
  })
  it('flags different confirmed references and remedies across evidence', () => {
    const referenceA = createEvidenceExtraction('e1', 'Order no. ADU-1234')
    const referenceB = createEvidenceExtraction('e2', 'Order no. ADU-5678')
    const remedyA = createEvidenceExtraction('e3', 'I requested a refund.')
    const remedyB = createEvidenceExtraction('e4', 'I requested a replacement.')
    for (const extraction of [referenceA, referenceB, remedyA, remedyB]) extraction.candidates[0] = reviewCandidate(extraction.candidates[0], 'confirmed')
    expect(findFactConflicts(EMPTY_DRAFT, [referenceA, referenceB, remedyA, remedyB])).toEqual(expect.arrayContaining([
      'Confirmed evidence contains different order or reference numbers.',
      'Confirmed evidence contains different requested remedies.',
    ]))
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
  it('compares same-event dates and flags contradictory event chronology', () => {
    const deliveryA = createEvidenceExtraction('e1', 'Delivery date: 2026-08-03')
    const deliveryB = createEvidenceExtraction('e2', 'Tarikh penghantaran: 2026-08-04')
    const promised = createEvidenceExtraction('e3', 'Promised delivery date: 2026-08-05')
    const contact = createEvidenceExtraction('e4', 'Complaint date: 2026-08-06')
    for (const extraction of [deliveryA, deliveryB, promised, contact]) extraction.candidates[0] = reviewCandidate(extraction.candidates[0], 'confirmed')
    const draft = { ...EMPTY_DRAFT, promisedDate: '2026-08-05', contactDate: '2026-08-07' }
    const conflicts = findFactConflicts(draft, [deliveryA, deliveryB, promised, contact])
    expect(conflicts).toContain('Confirmed evidence contains multiple dates labelled for delivery.')
    expect(conflicts).toContain('A confirmed date labelled for merchant contact differs from the entered merchant contact date of 2026-08-07.')
    expect(conflicts).toContain('A confirmed delivery date occurs before the promised performance date.')
  })
  it('flags confirmed purchase, promised, and delivery dates that appear out of order', () => {
    const purchase = createEvidenceExtraction('e1', 'Purchase date: 2026-08-04')
    const promised = createEvidenceExtraction('e2', 'Promised delivery date: 2026-08-03')
    const delivery = createEvidenceExtraction('e3', 'Delivery date: 2026-08-02')
    for (const extraction of [purchase, promised, delivery]) extraction.candidates[0] = reviewCandidate(extraction.candidates[0], 'confirmed')

    expect(findFactConflicts(EMPTY_DRAFT, [purchase, promised, delivery])).toEqual(expect.arrayContaining([
      'A confirmed promised performance date occurs before the recorded purchase date.',
      'A confirmed delivery date occurs before the recorded purchase date.',
      'A confirmed delivery date occurs before the promised performance date.',
    ]))
  })
  it('accepts a confirmed purchase, promise, and delivery in chronological order', () => {
    const purchase = createEvidenceExtraction('e1', 'Purchase date: 2026-08-01')
    const promised = createEvidenceExtraction('e2', 'Promised delivery date: 2026-08-02')
    const delivery = createEvidenceExtraction('e3', 'Delivery date: 2026-08-03')
    for (const extraction of [purchase, promised, delivery]) extraction.candidates[0] = reviewCandidate(extraction.candidates[0], 'confirmed')

    expect(findFactConflicts(EMPTY_DRAFT, [purchase, promised, delivery])).toEqual([])
  })
  it('flags a confirmed consumer name that differs from the case record', () => {
    const extraction = createEvidenceExtraction('e1', 'Customer name: Another Synthetic Consumer.')
    extraction.candidates[0] = reviewCandidate(extraction.candidates[0], 'confirmed')
    expect(findFactConflicts({ ...EMPTY_DRAFT, consumerName: 'Synthetic Test Consumer' }, [extraction])[0]).toContain('consumer name')
  })
  it('flags different confirmed consumer names even when the case name is blank', () => {
    const first = createEvidenceExtraction('e1', 'Customer name: Synthetic Consumer One.')
    const second = createEvidenceExtraction('e2', 'Customer name: Synthetic Consumer Two.')
    first.candidates[0] = reviewCandidate(first.candidates[0], 'confirmed')
    second.candidates[0] = reviewCandidate(second.candidates[0], 'confirmed')
    expect(findFactConflicts(EMPTY_DRAFT, [first, second])).toContain('Confirmed evidence contains different consumer names.')
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
