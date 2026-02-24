import { describe, expect, it } from 'vitest'
import { EMPTY_DRAFT } from './case'
import { assessTtpmPrerequisites, evaluateInitialRoute } from './routing'

describe('initial routing', () => {
  it.each([{ sellerLocation: 'unknown' as const }, { sellerLocation: 'outside' as const }, { category: 'other' as const }])('retains uncertain scope for %j', (override) => {
    const route = evaluateInitialRoute({ ...EMPTY_DRAFT, consumerLocation: 'malaysia', sellerLocation: 'malaysia', purpose: 'personal', category: 'general_goods', issue: 'non_delivery', remedy: 'refund', amount: '125.50', contactHistory: 'none', ...override }, [])
    expect(route.confidence).toBe('uncertain')
    expect(route.routeName).toBe('Manual scope review')
    expect(route.officialLinks).toBeUndefined()
  })

  it('does not route consumers outside Malaysia into a local complaint process', () => {
    const route = evaluateInitialRoute({ ...EMPTY_DRAFT, consumerLocation: 'outside', purpose: 'personal' }, [])
    expect(route.routeName).toBe('Manual review')
    expect(route.confidence).toBe('unsupported')
    expect(route.officialLinks).toBeUndefined()
  })

  it('does not approve incomplete scope facts from a saved draft', () => {
    const route = evaluateInitialRoute({ ...EMPTY_DRAFT, consumerLocation: 'malaysia', amount: '125.50', contactHistory: 'none' }, [])
    expect(route.confidence).toBe('uncertain')
    expect(route.unmetPrerequisites).toContain('Purchase purpose')
    expect(route.unmetPrerequisites).toContain('Seller location')
    expect(route.routeName).toBe('Manual scope review')
    expect(route.officialLinks).toBeUndefined()
  })
  it('recommends merchant-first when no contact is recorded', () => {
    const route = evaluateInitialRoute({ ...EMPTY_DRAFT, consumerLocation: 'malaysia', sellerLocation: 'malaysia', purpose: 'personal', category: 'general_goods', issue: 'non_delivery', remedy: 'refund', amount: '125.50', contactHistory: 'none' }, [])
    expect(route.routeName).toBe('Merchant or platform first')
    expect(route.confidence).toBe('supported')
    expect(route.ruleVersion).toMatch('R010')
    expect(route.sourceUrl).toMatch(/^https:\/\//)
  })

  it('keeps a recently reviewed source supported through the 180-day review window', () => {
    const route = evaluateInitialRoute({ ...EMPTY_DRAFT, consumerLocation: 'malaysia', sellerLocation: 'malaysia', purpose: 'personal', category: 'general_goods', issue: 'non_delivery', remedy: 'refund', amount: '125.50', contactHistory: 'none' }, [], new Date('2027-03-22T12:00:00Z'))
    expect(route.routeName).toBe('Merchant or platform first')
    expect(route.confidence).toBe('supported')
  })

  it.each([new Date('2027-03-23T00:00:00Z'), new Date('2028-01-01T00:00:00Z')])('degrades a supported route when its source check is overdue at %s', (now) => {
    const route = evaluateInitialRoute({ ...EMPTY_DRAFT, consumerLocation: 'malaysia', sellerLocation: 'malaysia', purpose: 'personal', category: 'general_goods', issue: 'non_delivery', remedy: 'refund', amount: '125.50', contactHistory: 'none' }, [], now)
    expect(route.routeName).toBe('Manual source review')
    expect(route.confidence).toBe('uncertain')
    expect(route.unmetPrerequisites).toContain('Review current route source')
    expect(route.matchingFacts).toContain('Rule source last checked: 2026-09-23')
  })

  it('keeps an unsupported route unchanged when its source check is old', () => {
    const route = evaluateInitialRoute({ ...EMPTY_DRAFT, purpose: 'business' }, [], new Date('2028-01-01T00:00:00Z'))
    expect(route.routeName).toBe('Manual review')
    expect(route.confidence).toBe('unsupported')
  })

  it('does not force a business purchase into a consumer route', () => {
    const route = evaluateInitialRoute({ ...EMPTY_DRAFT, purpose: 'business' }, [])
    expect(route.routeName).toBe('Manual review')
    expect(route.confidence).toBe('unsupported')
  })

  it('does not guess an escalation after merchant contact', () => {
    const route = evaluateInitialRoute({ ...EMPTY_DRAFT, consumerLocation: 'malaysia', sellerLocation: 'malaysia', purpose: 'personal', category: 'general_goods', amount: '125.50', contactHistory: 'contacted' }, [])
    expect(route.routeName).toBe('Manual route review')
    expect(route.unmetPrerequisites).toContain('Date of merchant contact')
    expect(route.confidence).toBe('uncertain')
    expect(route.officialLinks).toEqual([
      { label: 'KPDN e-Aduan', url: 'https://eaduan.kpdn.gov.my/' },
      { label: 'TTPM e-Tribunal', url: 'https://ttpm.kpdn.gov.my/?lang=en' },
    ])
  })

  it('does not route a case with a missing transaction amount', () => {
    const route = evaluateInitialRoute({ ...EMPTY_DRAFT, consumerLocation: 'malaysia', sellerLocation: 'malaysia', purpose: 'personal', category: 'general_goods', issue: 'non_delivery', remedy: 'refund', contactHistory: 'none' }, [])
    expect(route.confidence).toBe('uncertain')
    expect(route.unmetPrerequisites).toContain('Transaction amount')
  })

  it('pauses excluded and sector-specific categories', () => {
    expect(evaluateInitialRoute({ ...EMPTY_DRAFT, consumerLocation: 'malaysia', purpose: 'personal', category: 'healthcare' }, []).confidence).toBe('unsupported')
    expect(evaluateInitialRoute({ ...EMPTY_DRAFT, consumerLocation: 'malaysia', purpose: 'personal', category: 'aviation' }, []).routeName).toBe('Sector route review')
  })

  it.each(['personal_injury', 'wills_estates', 'franchise', 'goodwill_ip', 'other_tribunal'] as const)('stops TTPM-excluded category %s before route selection', (category) => {
    const route = evaluateInitialRoute({ ...EMPTY_DRAFT, consumerLocation: 'malaysia', purpose: 'personal', category }, [])
    expect(route.routeName).toBe('Out of supported scope')
    expect(route.confidence).toBe('unsupported')
  })

  it.each(['healthcare', 'professional_service', 'land', 'personal_injury', 'wills_estates', 'franchise', 'goodwill_ip', 'other_tribunal'] as const)('keeps every documented TTPM exclusion outside the supported route: %s', (category) => {
    const draft = { ...EMPTY_DRAFT, consumerLocation: 'malaysia' as const, sellerLocation: 'malaysia' as const, purpose: 'personal' as const, category }
    const route = evaluateInitialRoute(draft, [])
    expect(route.confidence).toBe('unsupported')
    expect(route.routeName).toBe('Out of supported scope')
    expect(route.officialLinks).toBeUndefined()
    expect(assessTtpmPrerequisites(draft).status).toBe('excluded')
  })

  it.each(['outside', 'unknown'] as const)('retains manual review for a %s seller jurisdiction', (sellerLocation) => {
    const route = evaluateInitialRoute({ ...EMPTY_DRAFT, consumerLocation: 'malaysia', sellerLocation, purpose: 'personal', category: 'general_goods', issue: 'non_delivery', remedy: 'refund', amount: '125.50', contactHistory: 'none' }, [])
    expect(route.routeName).toBe('Manual scope review')
    expect(route.confidence).toBe('uncertain')
    expect(route.unmetPrerequisites).toContain('Reviewed category and seller jurisdiction')
    expect(route.officialLinks).toBeUndefined()
  })
})

describe('TTPM prerequisite check', () => {
  const base = { ...EMPTY_DRAFT, purpose: 'personal' as const, category: 'general_goods' as const, amount: '120.00', purchaseDate: '2026-01-01' }

  it('keeps timing uncertain because purchase date is not claim-accrual date', () => {
    const result = assessTtpmPrerequisites(base)
    expect(result.status).toBe('uncertain')
    expect(result.reason).toContain('when the claim accrued')
    expect(result.reason).toContain('claim amount')
  })

  it('does not treat transaction value above RM50,000 as proof the claim amount exceeds the limit', () => {
    const result = assessTtpmPrerequisites({ ...base, amount: '50000.01' })
    expect(result.status).toBe('uncertain')
    expect(result.reason).toContain('cannot assess either limit')
  })

  it('does not treat an old purchase date as proof that the claim is time-barred', () => {
    const result = assessTtpmPrerequisites({ ...base, purchaseDate: '2018-01-01' })
    expect(result.status).toBe('uncertain')
    expect(result.reason).toContain('purchase date only')
  })

  it.each([
    [{ ...base, purpose: 'business' as const }, 'excluded'],
    ...(['healthcare', 'professional_service', 'land', 'aviation', 'personal_injury', 'wills_estates', 'franchise', 'goodwill_ip', 'other_tribunal'] as const).map((category) => [{ ...base, category }, 'excluded'] as const),
    [{ ...base, amount: '50000.01' }, 'uncertain'],
    [{ ...base, purchaseDate: '2022-09-20' }, 'uncertain'],
    [{ ...base, purchaseDate: '2026-02-30' }, 'uncertain'],
    [{ ...base, amount: '' }, 'uncertain'],
    [{ ...base, purpose: '' as const }, 'uncertain'],
  ] as const)('retains uncertainty or exclusion for %j', (draft, status) => {
    expect(assessTtpmPrerequisites(draft).status).toBe(status)
  })
})
