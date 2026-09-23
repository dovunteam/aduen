import { describe, expect, it } from 'vitest'
import { scopeHandoff } from './scopeHandoff'

describe('scope handoffs', () => {
  it('provides official links only for the documented sector exceptions', () => {
    expect(scopeHandoff('aviation')).toMatchObject({ destination: 'caam', url: 'https://www.caam.gov.my/consumer/complaints/make-a-complaint/' })
    expect(scopeHandoff('financial_service')).toMatchObject({ destination: 'bnm', url: 'https://www.bnm.gov.my/contact-us/lodge-complaint' })
    expect(scopeHandoff('healthcare')).toBeNull()
  })

  it.each(['aviation', 'financial_service'] as const)('marks the %s source current through its 180-day review window', (category) => {
    expect(scopeHandoff(category, new Date('2027-03-22T12:00:00Z'))?.current).toBe(true)
  })

  it.each(['aviation', 'financial_service'] as const)('marks the %s source stale after its review window', (category) => {
    expect(scopeHandoff(category, new Date('2027-03-23T00:00:00Z'))).toMatchObject({ checked: '2026-09-23', current: false })
  })
})
