import { describe, expect, it } from 'vitest'
import { EMPTY_DRAFT } from './case'
import { evaluateInitialRoute } from './routing'

describe('initial routing', () => {
  it('recommends merchant-first when no contact is recorded', () => {
    const route = evaluateInitialRoute({ ...EMPTY_DRAFT, consumerLocation: 'malaysia', purpose: 'personal', category: 'general_goods', issue: 'non_delivery', remedy: 'refund', contactHistory: 'none' }, [])
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
  })

  it('pauses excluded and sector-specific categories', () => {
    expect(evaluateInitialRoute({ ...EMPTY_DRAFT, consumerLocation: 'malaysia', purpose: 'personal', category: 'healthcare' }, []).confidence).toBe('unsupported')
    expect(evaluateInitialRoute({ ...EMPTY_DRAFT, consumerLocation: 'malaysia', purpose: 'personal', category: 'aviation' }, []).routeName).toBe('Sector route review')
  })
})
