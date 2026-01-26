import { describe, expect, it } from 'vitest'
import { EMPTY_DRAFT } from './case'
import { assessTtpmCandidate, evaluateInitialRoute } from './routing'

describe('initial routing', () => {
  it.each([{ sellerLocation: 'unknown' as const }, { sellerLocation: 'outside' as const }, { category: 'other' as const }])('retains uncertain scope for %j', (override) => {
    const route = evaluateInitialRoute({ ...EMPTY_DRAFT, consumerLocation: 'malaysia', sellerLocation: 'malaysia', purpose: 'personal', category: 'general_goods', issue: 'non_delivery', remedy: 'refund', contactHistory: 'none', ...override }, [])
    expect(route.confidence).toBe('uncertain')
    expect(route.routeName).toBe('Manual scope review')
  })

  it('does not approve incomplete scope facts from a saved draft', () => {
    const route = evaluateInitialRoute({ ...EMPTY_DRAFT, consumerLocation: 'malaysia', contactHistory: 'none' }, [])
    expect(route.confidence).toBe('uncertain')
    expect(route.unmetPrerequisites).toContain('Purchase purpose')
    expect(route.unmetPrerequisites).toContain('Seller location')
  })
  it('recommends merchant-first when no contact is recorded', () => {
    const route = evaluateInitialRoute({ ...EMPTY_DRAFT, consumerLocation: 'malaysia', sellerLocation: 'malaysia', purpose: 'personal', category: 'general_goods', issue: 'non_delivery', remedy: 'refund', contactHistory: 'none' }, [])
    expect(route.routeName).toBe('Merchant or platform first')
    expect(route.confidence).toBe('supported')
    expect(route.ruleVersion).toMatch('R010')
    expect(route.sourceUrl).toMatch(/^https:\/\//)
  })

  it('does not force a business purchase into a consumer route', () => {
    const route = evaluateInitialRoute({ ...EMPTY_DRAFT, purpose: 'business' }, [])
    expect(route.routeName).toBe('Manual review')
    expect(route.confidence).toBe('unsupported')
  })

  it('does not guess an escalation after merchant contact', () => {
    const route = evaluateInitialRoute({ ...EMPTY_DRAFT, consumerLocation: 'malaysia', purpose: 'personal', category: 'general_goods', contactHistory: 'contacted' }, [])
    expect(route.routeName).toBe('Manual route review')
    expect(route.unmetPrerequisites).toContain('Date of merchant contact')
    expect(route.confidence).toBe('uncertain')
    expect(route.officialLinks).toEqual([
      { label: 'KPDN e-Aduan', url: 'https://eaduan.kpdn.gov.my/' },
      { label: 'TTPM e-Tribunal', url: 'https://ttpm.kpdn.gov.my/?lang=en' },
    ])
  })

  it('pauses excluded and sector-specific categories', () => {
    expect(evaluateInitialRoute({ ...EMPTY_DRAFT, consumerLocation: 'malaysia', purpose: 'personal', category: 'healthcare' }, []).confidence).toBe('unsupported')
    expect(evaluateInitialRoute({ ...EMPTY_DRAFT, consumerLocation: 'malaysia', purpose: 'personal', category: 'aviation' }, []).routeName).toBe('Sector route review')
  })
})

describe('TTPM candidate check', () => {
  const base = { ...EMPTY_DRAFT, purpose: 'personal' as const, category: 'general_goods' as const, amount: '120.00', purchaseDate: '2026-01-01' }

  it('marks an in-range personal purchase as a candidate without approving it', () => {
    expect(assessTtpmCandidate(base, new Date('2026-09-21T00:00:00Z')).status).toBe('candidate')
  })

  it.each([
    [{ ...base, purpose: 'business' as const }, 'excluded'],
    [{ ...base, amount: '50000.01' }, 'excluded'],
    [{ ...base, purchaseDate: '2022-09-20' }, 'excluded'],
    [{ ...base, amount: '' }, 'uncertain'],
  ] as const)('retains uncertainty or exclusion for %j', (draft, status) => {
    expect(assessTtpmCandidate(draft, new Date('2026-09-21T00:00:00Z')).status).toBe(status)
  })
})
