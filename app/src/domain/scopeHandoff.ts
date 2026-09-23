import type { CaseDraft } from './case'
import { isSourceCurrent } from './sourceFreshness'

export type ScopeHandoff = { destination: 'caam' | 'bnm'; url: string; checked: string; current: boolean }

export function scopeHandoff(category: CaseDraft['category'], now = new Date()): ScopeHandoff | null {
  if (category === 'aviation') return { destination: 'caam', url: 'https://www.caam.gov.my/consumer/complaints/make-a-complaint/', checked: '2026-09-23', current: isSourceCurrent('2026-09-23', now) }
  if (category === 'financial_service') return { destination: 'bnm', url: 'https://www.bnm.gov.my/contact-us/lodge-complaint', checked: '2026-09-23', current: isSourceCurrent('2026-09-23', now) }
  return null
}
