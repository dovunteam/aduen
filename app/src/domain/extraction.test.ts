import { describe, expect, it } from 'vitest'
import { createEvidenceExtraction, extractCandidateFacts, isValidEvidenceExtraction, reviewCandidate } from './extraction'

describe('bounded text extraction', () => {
  it('rejects invalid confirmations without changing the original candidate', () => {
    const amount = extractCandidateFacts('RM 25.00')[0]
    for (const value of ['', ' ', 'NaN', '-5', '25.999', 'twenty']) expect(() => reviewCandidate(amount, 'confirmed', value)).toThrow('Invalid')
    const date = extractCandidateFacts('2026-02-28')[0]
    expect(() => reviewCandidate(date, 'confirmed', '2026-02-30')).toThrow('Invalid')
    expect(reviewCandidate(date, 'confirmed', '2028-02-29').confirmedValue).toBe('2028-02-29')
    expect(amount.status).toBe('unconfirmed')
    expect(amount.reviewHistory).toBeUndefined()
  })
  it('retains each correction and rejection without mutating earlier records', () => {
    const original = extractCandidateFacts('RM 25.00')[0]
    const first = reviewCandidate(original, 'confirmed', '24.50', new Date('2026-09-20T10:00:00Z'))
    const reopened = reviewCandidate(first, 'unconfirmed')
    const second = reviewCandidate(reopened, 'confirmed', '24.00')
    const rejected = reviewCandidate(second, 'rejected')
    expect(first.reviewHistory).toHaveLength(1)
    expect(rejected.reviewHistory).toHaveLength(4)
    expect(rejected.reviewHistory?.[1].previousValue).toBe('24.50')
    expect(rejected.reviewHistory?.[3].previousValue).toBe('24.00')
    expect(rejected.value).toBe('25.00')
    expect(rejected.confirmedValue).toBeNull()
    expect(original.reviewHistory).toBeUndefined()
  })
  it('extracts reviewable amounts, dates, and references with source positions', () => {
    const text = 'Order no. SYN-2048 was placed on 2026-08-01. Total RM 1,250.50.'
    const candidates = extractCandidateFacts(text)
    expect(candidates.map(({ field, value }) => ({ field, value }))).toEqual([
      { field: 'amount', value: '1250.50' },
      { field: 'date', value: '2026-08-01' },
      { field: 'reference', value: 'SYN-2048' },
    ])
    expect(candidates.every((item) => item.start >= 0 && item.sourceExcerpt.length > 0)).toBe(true)
  })

  it('extracts only explicit requested remedies', () => {
    const candidates = extractCandidateFacts('The listing mentions a refund, but I requested a replacement.')
    expect(candidates.map(({ field, value }) => ({ field, value }))).toEqual([{ field: 'remedy', value: 'replacement' }])
  })

  it('extracts only explicitly labelled consumer names', () => {
    const candidates = extractCandidateFacts('Customer name: Synthetic Test Consumer. The customer bought a gift.')
    expect(candidates.map(({ field, value }) => ({ field, value }))).toEqual([{ field: 'name', value: 'Synthetic Test Consumer' }])
  })

  it('marks every extracted value unconfirmed by default', () => {
    const extraction = createEvidenceExtraction('evidence-1', 'Paid RM 25.00', new Date('2026-09-20T10:00:00Z'))
    expect(extraction.extractorVersion).toBe('plain-text-v1')
    expect(extraction.candidates[0].status).toBe('unconfirmed')
  })

  it('retains the extracted value when a user confirms or corrects it', () => {
    const original = extractCandidateFacts('Paid RM 25.00')[0]
    const corrected = reviewCandidate(original, 'confirmed', '24.50')
    expect(corrected.value).toBe('25.00')
    expect(corrected.confirmedValue).toBe('24.50')
    expect(reviewCandidate(original, 'rejected').status).toBe('rejected')
  })

  it('validates stored extraction records before review', () => {
    const valid = createEvidenceExtraction('evidence-1', 'Paid RM 25.00', new Date('2026-09-20T10:00:00.000Z'))
    expect(isValidEvidenceExtraction(valid)).toBe(true)
    expect(isValidEvidenceExtraction({ ...valid, createdAt: 'not-a-date' })).toBe(false)
    expect(isValidEvidenceExtraction({ ...valid, candidates: [{ ...valid.candidates[0], confidence: 2 }] })).toBe(false)
  })
})
