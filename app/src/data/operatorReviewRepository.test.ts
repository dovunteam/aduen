import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearAuditEvents } from './auditRepository'
import { clearOperatorReviews, isCompleteOperatorReview, readOperatorReview, saveOperatorReview } from './operatorReviewRepository'

describe('operator review storage', () => {
  beforeEach(() => {
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) })
    clearAuditEvents()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('stores a complete review and rejects incomplete release checks', () => {
    const review = { reviewerCode: 'OP-01', reviewedAt: '2026-09-24T00:00:00.000Z', notes: 'Checked synthetic fixture.', checks: { facts: true, route: true, deadlines: true, language: true, evidence: true } }
    expect(isCompleteOperatorReview({ ...review, checks: { ...review.checks, evidence: false } })).toBe(false)
    saveOperatorReview('pack-1', review)
    expect(readOperatorReview('pack-1')).toEqual(review)
    expect(isCompleteOperatorReview(readOperatorReview('pack-1'))).toBe(true)
    clearOperatorReviews()
    expect(readOperatorReview('pack-1')).toBeNull()
  })
})
