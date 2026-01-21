import { describe, expect, it } from 'vitest'
import { scopeHandoff } from './scopeHandoff'

describe('scope handoffs', () => {
  it('provides official links only for the documented sector exceptions', () => {
    expect(scopeHandoff('aviation')).toMatchObject({ destination: 'caam', url: 'https://www.caam.gov.my/consumer/complaints/make-a-complaint/' })
    expect(scopeHandoff('financial_service')).toMatchObject({ destination: 'bnm', url: 'https://www.bnm.gov.my/contact-us/lodge-complaint' })
    expect(scopeHandoff('healthcare')).toBeNull()
  })
})
