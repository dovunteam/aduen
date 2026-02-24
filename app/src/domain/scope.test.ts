import { describe, expect, it } from 'vitest'
import { EMPTY_DRAFT } from './case'
import { assessScope } from './scope'

describe('prototype scope', () => {
  it('supports an ordinary Malaysian consumer purchase', () => {
    expect(assessScope({ ...EMPTY_DRAFT, consumerLocation: 'malaysia', sellerLocation: 'malaysia', purpose: 'personal', category: 'general_goods' }).result).toBe('supported')
  })
  it('stops business, non-Malaysian, and excluded-sector cases', () => {
    const result = assessScope({ ...EMPTY_DRAFT, consumerLocation: 'outside', purpose: 'business', category: 'healthcare' })
    expect(result.result).toBe('unsupported'); expect(result.reasons).toHaveLength(3)
  })
  it.each([
    ['personal_injury', 'personal injury or death'],
    ['wills_estates', 'Wills, inheritance, and estate-rights'],
    ['franchise', 'Franchise disputes'],
    ['goodwill_ip', 'Goodwill, trade-secret, and intellectual-property'],
    ['other_tribunal', 'another tribunal'],
  ] as const)('stops TTPM excluded category %s with a reason', (category, reason) => {
    const assessment = assessScope({ ...EMPTY_DRAFT, consumerLocation: 'malaysia', purpose: 'personal', category })
    expect(assessment.result).toBe('unsupported')
    expect(assessment.reasons.join(' ')).toContain(reason)
  })
  it('marks unknown seller and category facts for review', () => {
    expect(assessScope({ ...EMPTY_DRAFT, consumerLocation: 'malaysia', purpose: 'personal', sellerLocation: 'unknown', category: 'other' }).result).toBe('uncertain')
  })
  it('does not mark incomplete scope facts as supported', () => {
    const assessment = assessScope(EMPTY_DRAFT)
    expect(assessment.result).toBe('uncertain')
    expect(assessment.reasons).toEqual(expect.arrayContaining([
      'The purchase purpose needs confirmation.',
      'The consumer location needs confirmation.',
      'The purchase category needs confirmation.',
      'The seller location needs confirmation.',
    ]))
  })
})
