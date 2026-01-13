import { describe, expect, it } from 'vitest'
import { createEvidenceExtraction, extractCandidateFacts, reviewCandidate } from './extraction'

describe('bounded text extraction', () => {
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
})
