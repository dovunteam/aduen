import type { CaseDraft } from './case'

export type ScopeHandoff = { destination: 'caam' | 'bnm'; url: string; checked: string }

export function scopeHandoff(category: CaseDraft['category']): ScopeHandoff | null {
  if (category === 'aviation') return { destination: 'caam', url: 'https://www.caam.gov.my/consumer/complaints/make-a-complaint/', checked: '20 September 2026' }
  if (category === 'financial_service') return { destination: 'bnm', url: 'https://www.bnm.gov.my/contact-us/lodge-complaint', checked: '20 September 2026' }
  return null
}
